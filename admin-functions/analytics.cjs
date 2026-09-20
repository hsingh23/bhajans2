// Pure, deterministic metrics. No Firebase access and no personal billing data in output.
const DAY = 86400000;
const VARIANTS = { 37277000728740: 1, 37277000794276: 5, 37277000827044: 10 };
const entries = (value) =>
  Object.entries(value && typeof value === "object" ? value : {});
const timestamp = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) &&
    number >= Date.UTC(2000, 0, 1) &&
    number <= Date.UTC(2200, 0, 1)
    ? number
    : null;
};
const money = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.round(number * 100) / 100
    : null;
};
const currency = (value) =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value) ? value : null;
const month = (value) => new Date(value).toISOString().slice(0, 7);
const favoriteCount = (value) =>
  entries(value).filter(([, v]) => v === "1" || v === 1 || v === true).length;
const isWoo = (row) =>
  typeof row.orderID === "string" && row.orderID.startsWith("wc_order_");
const lines = (row) => (Array.isArray(row.line_items) ? row.line_items : []);
const manual = (row) =>
  row.manual === true ||
  row.manual === "true" ||
  row.orderID === "admin" ||
  row.payer?.payer_id === "admin" ||
  (!!row.accessUpdatedOn &&
    !row.orderID &&
    row.order_number == null &&
    !row.paidOn);
function planFor(row) {
  if (isWoo(row))
    return { plan: "1 year", planBasis: "WooCommerce product integration" };
  let years;
  for (const item of lines(row))
    if (VARIANTS[item.variant_id]) years = VARIANTS[item.variant_id];
  if (years)
    return {
      plan: `${years} year${years === 1 ? "" : "s"}`,
      planBasis: "Shopify variant",
    };
  const amount = money(row.gross_total_amount?.value);
  // A price mapping is an inference, not evidence of the current access duration.
  if (
    currency(row.gross_total_amount?.currency) === "USD" &&
    [9.99, 39.99, 49.99].includes(amount)
  ) {
    years = { 9.99: 1, 39.99: 5, 49.99: 10 }[amount];
    return {
      plan: `${years} year${years === 1 ? "" : "s"}`,
      planBasis: "Inferred from legacy USD price",
    };
  }
  return { plan: "Unknown", planBasis: "No verified product identifier" };
}
function normalizePayment(row, uid, source, sourceKey = "") {
  const woo = isWoo(row);
  const shopify =
    !woo && (Array.isArray(row.line_items) || row.order_number != null);
  const orderKey =
    shopify && row.order_number != null
      ? `shopify:${row.order_number}`
      : typeof row.orderID === "string" &&
          row.orderID &&
          row.orderID !== "admin"
        ? `payment:${row.orderID}`
        : null;
  // WooCommerce preserves older metadata when extending access; old gross amounts
  // cannot be attributed to a new WooCommerce order.
  return {
    uid: uid || null,
    orderKey,
    source,
    sourceKey,
    channel: shopify ? "Shopify" : woo ? "Amritabooks" : "Legacy payment",
    manual: manual(row),
    live: row.mode === "live",
    paidOn: timestamp(row.paidOn),
    expiresOn: timestamp(row.expiresOn),
    amount: shopify || woo ? null : money(row.gross_total_amount?.value),
    currency:
      shopify || woo ? null : currency(row.gross_total_amount?.currency),
    ...planFor(row),
  };
}
function shopifyMerchandise(row) {
  if (isWoo(row)) return [];
  const groups = new Map();
  for (const item of lines(row)) {
    if (!VARIANTS[item.variant_id]) continue;
    const price = item.price_set?.presentment_money;
    const discount = item.total_discount_set?.presentment_money;
    const code = currency(price?.currency_code);
    const amount = money(price?.amount),
      quantity = Number(item.quantity);
    const reduction = money(discount?.amount);
    if (
      !code ||
      amount === null ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      reduction === null ||
      discount.currency_code !== code ||
      amount * quantity < reduction
    )
      return [];
    groups.set(
      code,
      (groups.get(code) || 0) +
        Math.round((amount * quantity - reduction) * 100),
    );
  }
  return [...groups].map(([currency, cents]) => ({
    currency,
    amount: cents / 100,
  }));
}
function summarizeRetention(snapshots, now) {
  const result = [];
  for (const [key, start] of entries(snapshots).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (!/^\d{4}-\d{2}-01$/.test(key)) continue;
    const boundary = Date.parse(key + "T00:00:00Z");
    const next = new Date(boundary);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const end = snapshots[next.toISOString().slice(0, 10)];
    if (
      !end ||
      next.getTime() > now ||
      !timestamp(start.observedAt) ||
      !timestamp(end.observedAt) ||
      Math.abs(start.observedAt - boundary) > DAY ||
      Math.abs(end.observedAt - next.getTime()) > DAY
    )
      continue;
    const cohort = entries(start.members).filter(([, value]) => value.active);
    // Missing people are unknown, not automatically churned.
    const unknown = cohort.filter(
      ([uid]) => typeof end.members?.[uid]?.active !== "boolean",
    ).length;
    const lost = cohort.filter(
      ([uid]) => end.members?.[uid]?.active === false,
    ).length;
    result.push({
      month: key.slice(0, 7),
      openingActive: cohort.length,
      lost,
      unknown,
      retentionRate:
        cohort.length && !unknown
          ? (cohort.length - lost) / cohort.length
          : null,
      lapseRate: cohort.length && !unknown ? lost / cohort.length : null,
    });
  }
  return result;
}
function aggregateDashboard(
  {
    paid = {},
    transactions = {},
    favorites = {},
    events = {},
    snapshots = {},
  } = {},
  now = Date.now(),
) {
  const quality = {
    duplicates: 0,
    conflicts: 0,
    excludedManual: 0,
    excludedNonLive: 0,
    missingOrderIds: 0,
    missingAmounts: 0,
    missingDates: 0,
  };
  const orders = new Map();
  const consume = (row, uid, source, key) => {
    if (!row || typeof row !== "object") return;
    const item = normalizePayment(row, uid, source, key);
    if (item.manual) {
      quality.excludedManual++;
      return;
    }
    if (!item.live) {
      quality.excludedNonLive++;
      return;
    }
    if (!item.orderKey) {
      quality.missingOrderIds++;
      return;
    }
    item.merchandise = shopifyMerchandise(row);
    const previous = orders.get(item.orderKey);
    if (previous) {
      quality.duplicates++;
      if (
        (previous.amount !== null &&
          item.amount !== null &&
          (previous.amount !== item.amount ||
            previous.currency !== item.currency)) ||
        (previous.merchandise.length &&
          item.merchandise.length &&
          JSON.stringify(previous.merchandise) !==
            JSON.stringify(item.merchandise)) ||
        (previous.uid && item.uid && previous.uid !== item.uid)
      ) {
        if (!previous.conflict) quality.conflicts++;
        previous.conflict = true;
        previous.amount = null;
        previous.merchandise = [];
      }
      if (!previous.conflict) {
        if (previous.amount === null && item.amount !== null) {
          previous.amount = item.amount;
          previous.currency = item.currency;
        }
        if (!previous.merchandise.length)
          previous.merchandise = item.merchandise;
        if (!previous.uid) previous.uid = item.uid;
      }
      return;
    }
    orders.set(item.orderKey, item);
  };
  // Original transaction date wins over current paid metadata for the same order.
  entries(transactions).forEach(([key, row]) =>
    consume(row, row.uid, "transactions", key),
  );
  entries(events)
    .sort(([, a], [, b]) => (a.observedAt || 0) - (b.observedAt || 0))
    .forEach(([key, event]) => {
      if (event.before)
        consume(event.before, event.uid, "payment archive", key);
      if (event.after) consume(event.after, event.uid, "payment archive", key);
    });
  entries(paid).forEach(([uid, row]) => consume(row, uid, "paid", uid));
  const purchases = [...orders.values()].sort(
    (a, b) => (a.paidOn || 0) - (b.paidOn || 0),
  );
  const byUser = new Map();
  const series = new Map();
  for (const item of purchases) {
    if (item.uid && item.paidOn && item.paidOn <= now && !item.conflict) {
      const list = byUser.get(item.uid) || [];
      item.purchaseKind = list.length
        ? "Repeat recorded purchase"
        : "First recorded purchase";
      list.push(item);
      byUser.set(item.uid, list);
    } else item.purchaseKind = "Unlinked";
    if (!item.paidOn || item.paidOn > now) {
      quality.missingDates++;
      continue;
    }
    if (item.amount === null || !item.currency) quality.missingAmounts++;
    const add = (basis, code, amount) => {
      const key = [month(item.paidOn), code, basis].join("|");
      const row = series.get(key) || {
        month: month(item.paidOn),
        currency: code,
        basis,
        cents: 0,
        orders: 0,
      };
      row.cents += Math.round(amount * 100);
      row.orders++;
      series.set(key, row);
    };
    if (!item.conflict && item.amount !== null && item.currency)
      add("Recorded gross receipts", item.currency, item.amount);
    if (!item.conflict)
      for (const line of item.merchandise)
        add("Shopify merchandise estimate", line.currency, line.amount);
  }
  const revenue = [...series.values()]
    .map(({ cents, ...row }) => ({ ...row, amount: cents / 100 }))
    .sort(
      (a, b) =>
        a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency),
    );
  const members = entries(paid).map(([uid, row]) => {
    const expiresOn = timestamp(row.expiresOn);
    const records = byUser.get(uid) || [];
    const status =
      expiresOn === null ? "Unknown" : expiresOn > now ? "Active" : "Expired";
    const current = normalizePayment(row, uid, "paid");
    return {
      uid,
      status,
      expiresOn,
      lastRecordedPurchaseOn:
        records.filter((x) => x.paidOn && x.paidOn <= now).at(-1)?.paidOn ||
        null,
      paidOn: timestamp(row.paidOn),
      manual: manual(row),
      accessAdjusted: !!row.accessUpdatedOn,
      plan: manual(row) ? "Manual grant" : current.plan,
      planBasis: manual(row) ? "Admin grant" : current.planBasis,
      channel: manual(row) ? "Manual grant" : current.channel,
      favorites: favoriteCount(favorites[uid]),
      favoritesAtChurn: null,
      recordedPurchases: records.length,
      daysUntilExpiry:
        expiresOn === null ? null : Math.ceil((expiresOn - now) / DAY),
    };
  });
  const active = members.filter((x) => x.status === "Active"),
    expired = members.filter((x) => x.status === "Expired");
  const mix = [];
  for (const status of ["Active", "Expired", "Unknown"])
    for (const plan of [
      ...new Set(members.filter((x) => x.status === status).map((x) => x.plan)),
    ])
      mix.push({
        status,
        plan,
        count: members.filter((x) => x.status === status && x.plan === plan)
          .length,
      });
  const engagement = ["Active", "Expired", "Unknown"].map((status) => {
    const values = members
      .filter((x) => x.status === status)
      .map((x) => x.favorites)
      .sort((a, b) => a - b);
    const total = values.reduce((a, b) => a + b, 0),
      n = values.length;
    return {
      status,
      accounts: n,
      withFavorites: values.filter((x) => x > 0).length,
      meanFavorites: n ? total / n : null,
      medianFavorites: n
        ? (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2
        : null,
      buckets: ["0", "1–5", "6–20", "21+"].map((label, index) => ({
        label,
        count: values.filter((x) =>
          index === 0
            ? x === 0
            : index === 1
              ? x >= 1 && x <= 5
              : index === 2
                ? x >= 6 && x <= 20
                : x > 20,
        ).length,
      })),
    };
  });
  const expirations = new Map();
  expired.forEach((x) => {
    const key = month(x.expiresOn);
    expirations.set(key, (expirations.get(key) || 0) + 1);
  });
  const countries = new Map();
  entries(paid).forEach(([, row]) => {
    if (!Array.isArray(row.line_items)) return;
    const code = row.billing_address?.country_code;
    const safe =
      typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : "Unknown";
    countries.set(safe, (countries.get(safe) || 0) + 1);
  });
  const snapshotList = entries(snapshots).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const lapseObservations = [];
  for (let i = 1; i < snapshotList.length; i++) {
    const [, before] = snapshotList[i - 1],
      [day, after] = snapshotList[i];
    if (
      after.observedAt - before.observedAt > 36 * 60 * 60 * 1000 ||
      after.observedAt <= before.observedAt
    )
      continue;
    for (const [uid, previous] of entries(before.members)) {
      const current = after.members?.[uid];
      if (previous.active && current?.active === false)
        lapseObservations.push({
          uid,
          day,
          observedAt: after.observedAt,
          lastActiveObservedAt: before.observedAt,
          favoritesAtLastActiveSnapshot: previous.favorites,
          favoritesAtObservation: current.favorites,
          expiresOn: current.expiresOn,
        });
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: now,
    coverage: {
      paid: entries(paid).length,
      transactions: entries(transactions).length,
      favoriteAccounts: entries(favorites).length,
      archiveEvents: entries(events).length,
      snapshots: snapshotList.length,
      snapshotStartedOn: snapshotList[0]?.[1]?.observedAt || null,
      firstRecordedPurchaseOn:
        purchases.find((x) => x.paidOn && x.paidOn <= now)?.paidOn || null,
    },
    quality,
    summary: {
      active: active.length,
      expired: expired.length,
      unknown: members.length - active.length - expired.length,
      manualAccess: members.filter((x) => x.manual).length,
      expiring30: active.filter((x) => x.expiresOn <= now + 30 * DAY).length,
      expiring90: active.filter((x) => x.expiresOn <= now + 90 * DAY).length,
      repeatBuyers: [...byUser.values()].filter((x) => x.length > 1).length,
      recordedBuyers: byUser.size,
    },
    revenue,
    purchases: purchases.map(({ sourceKey, ...row }) => row),
    members,
    mix,
    engagement,
    expirations: [...expirations]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
    countries: [...countries]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count),
    retention: summarizeRetention(snapshots, now),
    lapseObservations,
  };
}
// An allowlist keeps addresses, names, payer emails and order-status tokens out of
// the prospective archive. Only fields used for deduplication/metrics are retained.
function paymentEvidence(row) {
  if (!row) return null;
  const presentment = (value) =>
    value
      ? {
          presentment_money: {
            amount: value.presentment_money?.amount,
            currency_code: value.presentment_money?.currency_code,
          },
        }
      : undefined;
  return JSON.parse(
    JSON.stringify({
      expiresOn: row.expiresOn,
      paidOn: row.paidOn,
      mode: row.mode,
      manual: manual(row),
      orderID: row.orderID,
      order_number: row.order_number,
      gross_total_amount: row.gross_total_amount
        ? {
            currency: row.gross_total_amount.currency,
            value: row.gross_total_amount.value,
          }
        : undefined,
      accessUpdatedOn: row.accessUpdatedOn,
      line_items: Array.isArray(row.line_items)
        ? lines(row)
            .filter((x) => VARIANTS[x.variant_id])
            .map((x) => ({
              variant_id: x.variant_id,
              quantity: x.quantity,
              price_set: presentment(x.price_set),
              total_discount_set: presentment(x.total_discount_set),
            }))
        : undefined,
    }),
  );
}
function createSnapshot(paid, favorites, now) {
  return {
    observedAt: now,
    members: Object.fromEntries(
      entries(paid).map(([uid, row]) => {
        const expiresOn = timestamp(row.expiresOn);
        return [
          uid,
          {
            active: expiresOn === null ? null : expiresOn > now,
            expiresOn,
            favorites: favoriteCount(favorites?.[uid]),
          },
        ];
      }),
    ),
  };
}
module.exports = {
  aggregateDashboard,
  normalizePayment,
  summarizeRetention,
  paymentEvidence,
  createSnapshot,
};
