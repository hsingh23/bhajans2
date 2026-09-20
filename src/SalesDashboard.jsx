// @ts-nocheck
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getSalesDashboard } from "./firebase";
import Header from "./Header";
import "./SalesDashboard.css";
const number = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
        value,
      );
const percent = (value) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
const money = (value, currency) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "Not recorded";
const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0);
const tabs = [
  "Revenue",
  "Membership",
  "Retention & engagement",
  "Sources & definitions",
];
function Stat({ label, value, note, testId }) {
  return (
    <div className="sales-stat">
      <span>{label}</span>
      <strong data-testid={testId}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Panel({ title, description, children }) {
  return (
    <section className="sales-panel">
      <h2>{title}</h2>
      {description && <p className="sales-muted">{description}</p>}
      {children}
    </section>
  );
}
function Bars({
  rows,
  labelKey = "label",
  valueKey = "value",
  format = number,
  caption,
}) {
  const max = Math.max(1, ...rows.map((row) => row[valueKey] || 0));
  if (!rows.length)
    return (
      <p className="sales-empty">
        No recorded observations for this selection.
      </p>
    );
  return (
    <figure className="sales-bars">
      <figcaption>{caption}</figcaption>
      {rows.map((row, index) => (
        <div className="sales-bar-row" key={`${row[labelKey]}-${index}`}>
          <span>{row[labelKey]}</span>
          <div className="sales-track">
            <div style={{ width: `${((row[valueKey] || 0) / max) * 100}%` }} />
          </div>
          <strong>
            {row[valueKey] == null ? "No records" : format(row[valueKey])}
          </strong>
        </div>
      ))}
    </figure>
  );
}
function RevenueChart({ rows, currency, granularity, year, generatedAt }) {
  const values = new Map();
  rows.forEach((row) => {
    const label = granularity === "year" ? row.month.slice(0, 4) : row.month;
    values.set(label, (values.get(label) || 0) + Math.round(row.amount * 100));
  });
  const labels = [...values.keys()].sort();
  if (!labels.length)
    return (
      <p className="sales-empty">
        No recorded amounts for this selection. Missing history is not zero
        revenue.
      </p>
    );
  const first =
    year === "all" ? labels[0] : year + (granularity === "month" ? "-01" : "");
  const last =
    year === "all"
      ? new Date(generatedAt)
          .toISOString()
          .slice(0, granularity === "year" ? 4 : 7)
      : year + (granularity === "month" ? "-12" : "");
  const marks = [];
  let cursor = first;
  // Include empty intervals as gaps, never imputed zero receipts.
  while (cursor <= last && marks.length < 240) {
    marks.push({
      label: cursor,
      value: values.has(cursor) ? values.get(cursor) / 100 : null,
    });
    if (granularity === "year") cursor = String(Number(cursor) + 1);
    else {
      const d = new Date(cursor + "-01T00:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + 1);
      cursor = d.toISOString().slice(0, 7);
    }
  }
  const maximum = Math.max(1, ...marks.map((x) => x.value || 0));
  const width = Math.max(640, marks.length * 46),
    height = 248,
    plotHeight = 170;
  return (
    <>
      <div className="sales-chart-scroll">
        <svg
          role="img"
          aria-label={`${granularity === "year" ? "Yearly" : "Monthly"} amounts in ${currency}. Gaps mean no records, not zero.`}
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: width }}
        >
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line
                x1="60"
                x2={width - 10}
                y1={190 - t * plotHeight}
                y2={190 - t * plotHeight}
                stroke="currentColor"
                opacity=".12"
              />
              <text
                x="52"
                y={194 - t * plotHeight}
                textAnchor="end"
                fontSize="11"
                fill="currentColor"
              >
                {number(maximum * t)}
              </text>
            </g>
          ))}
          {marks.map((row, i) => {
            const x = 66 + (i * (width - 76)) / marks.length,
              w = Math.max(6, (width - 76) / marks.length - 8);
            return (
              <g key={row.label}>
                <title>
                  {row.label}:{" "}
                  {row.value === null
                    ? "No records"
                    : money(row.value, currency)}
                </title>
                {row.value !== null ? (
                  <rect
                    x={x}
                    y={190 - (row.value / maximum) * plotHeight}
                    width={w}
                    height={Math.max(
                      row.value === 0 ? 1 : 0,
                      (row.value / maximum) * plotHeight,
                    )}
                    rx="3"
                    fill="var(--sales-accent)"
                  />
                ) : (
                  <line
                    x1={x}
                    x2={x + w}
                    y1="190"
                    y2="190"
                    stroke="currentColor"
                    strokeDasharray="2 3"
                    opacity=".4"
                  />
                )}
                <text
                  transform={`translate(${x + w / 2},207) rotate(-40)`}
                  textAnchor="end"
                  fontSize="10"
                  fill="currentColor"
                >
                  {row.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="sales-chart-note">
        {currency} · UTC calendar periods · dashed gaps = no records · current
        period is incomplete
      </p>
      <details>
        <summary>View exact chart values</summary>
        <div className="sales-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Amount ({currency})</th>
              </tr>
            </thead>
            <tbody>
              {marks.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>
                    {row.value === null
                      ? "No records"
                      : money(row.value, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
function Records({ rows, columns, empty = "No matching records." }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(rows.length / 20);
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  return (
    <>
      {rows.length ? (
        <>
          <div className="sales-table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.label}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice(safePage * 20, (safePage + 1) * 20)
                  .map((row, index) => (
                    <tr key={row.uid + "-" + row.orderKey + "-" + index}>
                      {columns.map((c) => (
                        <td key={c.label}>{c.render(row)}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="sales-pagination">
            <span>
              {number(rows.length)} records · page {safePage + 1} of {pageCount}
            </span>
            <button disabled={!safePage} onClick={() => setPage(safePage - 1)}>
              Previous
            </button>
            <button
              disabled={safePage + 1 >= pageCount}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <p className="sales-empty">{empty}</p>
      )}
    </>
  );
}
export function SalesDashboardView({
  data,
  onRefresh = null,
  refreshing = false,
}) {
  const [tab, setTab] = useState(tabs[0]),
    [selectedCurrency, setCurrency] = useState("USD"),
    [year, setYear] = useState("all"),
    [basis, setBasis] = useState("Recorded gross receipts"),
    [granularity, setGranularity] = useState("month");
  const [status, setStatus] = useState("All"),
    [query, setQuery] = useState(""),
    [purchaseQuery, setPurchaseQuery] = useState("");
  const currencies = [
    ...new Set(
      data.revenue.filter((x) => x.basis === basis).map((x) => x.currency),
    ),
  ].sort();
  const currency = currencies.includes(selectedCurrency)
    ? selectedCurrency
    : currencies[0] || "USD";
  const years = [...new Set(data.revenue.map((x) => x.month.slice(0, 4)))]
    .sort()
    .reverse();
  const revenue = data.revenue.filter(
    (row) =>
      row.currency === currency &&
      row.basis === basis &&
      (year === "all" || row.month.startsWith(year)),
  );
  const ledger = data.purchases
    .filter(
      (row) =>
        row.paidOn &&
        row.paidOn <= data.generatedAt &&
        !row.conflict &&
        (year === "all" ||
          new Date(row.paidOn).getUTCFullYear() === Number(year)),
    )
    .map((row) => ({
      ...row,
      displayAmount:
        basis === "Recorded gross receipts"
          ? row.currency === currency
            ? row.amount
            : null
          : (row.merchandise?.find((x) => x.currency === currency)?.amount ??
            null),
    }))
    .filter(
      (row) =>
        row.displayAmount !== null &&
        (!purchaseQuery ||
          row.uid?.toLowerCase().includes(purchaseQuery.toLowerCase())),
    )
    .sort((a, b) => b.paidOn - a.paidOn);
  const members = data.members
    .filter(
      (row) =>
        (status === "All" ||
          (status === "Due in 30 days"
            ? row.status === "Active" &&
              row.expiresOn <= data.generatedAt + 30 * 86400000
            : row.status === status)) &&
        (!query || row.uid.toLowerCase().includes(query.toLowerCase())),
    )
    .sort((a, b) => (a.expiresOn || Infinity) - (b.expiresOn || Infinity));
  const total =
    revenue.reduce((cents, row) => cents + Math.round(row.amount * 100), 0) /
    100;
  return (
    <div className="sales-dashboard">
      <Header
        back
        title="Sales & engagement"
        rightContent={<a href="/admin">Manage access</a>}
      />
      <main className="sales-main">
        <div className="sales-heading">
          <div>
            <h1>Sales & engagement</h1>
            <p>
              Sing With Amma <span aria-hidden="true">/</span> Admin analytics
            </p>
          </div>
          <div className="sales-freshness">
            <span>
              Updated {date(data.generatedAt)} ·{" "}
              {new Date(data.generatedAt).toISOString().slice(11, 16)} UTC
            </span>
            {onRefresh && (
              <button onClick={onRefresh} disabled={refreshing}>
                {refreshing ? "Refreshing…" : "Refresh data"}
              </button>
            )}
          </div>
        </div>
        <div className="sales-kpis">
          <Stat
            label="Active access"
            value={number(data.summary.active)}
            note="Accounts with a future expiration"
          />
          <Stat
            label="Due within 30 days"
            value={number(data.summary.expiring30)}
            note={`${number(data.summary.expiring90)} due within 90 days`}
          />
          <Stat
            label="Expired access"
            value={number(data.summary.expired)}
            note="Not a count of cancellations"
          />
          <Stat
            label="Repeat recorded buyers"
            value={number(data.summary.repeatBuyers)}
            note={`Of ${number(data.summary.recordedBuyers)} buyers in available records`}
          />
        </div>
        <nav role="tablist" aria-label="Analytics views" className="sales-tabs">
          {tabs.map((name) => (
            <button
              key={name}
              role="tab"
              id={`sales-tab-${tabs.indexOf(name)}`}
              aria-controls="sales-tabpanel"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        <div
          role="tabpanel"
          id="sales-tabpanel"
          aria-labelledby={`sales-tab-${tabs.indexOf(tab)}`}
        >
          {tab === "Revenue" && (
            <>
              <Panel
                title="Revenue history"
                description="Recorded payment amounts and reconstructed Shopify merchandise are separate measures. Neither includes a verified refund, fee, or settlement ledger."
              >
                <div className="sales-controls">
                  <label>
                    Financial measure
                    <select
                      value={basis}
                      onChange={(e) => setBasis(e.target.value)}
                    >
                      <option>Recorded gross receipts</option>
                      <option>Shopify merchandise estimate</option>
                    </select>
                  </label>
                  <label>
                    Currency
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      {(currencies.length ? currencies : ["USD"]).map(
                        (code) => (
                          <option key={code}>{code}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Revenue year
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                    >
                      <option value="all">All available history</option>
                      {years.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Group by
                    <select
                      value={granularity}
                      onChange={(e) => setGranularity(e.target.value)}
                    >
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  </label>
                </div>
                <div className="sales-financial-summary">
                  <Stat
                    label={basis}
                    value={
                      revenue.length ? money(total, currency) : "No records"
                    }
                    testId="revenue-total"
                    note={`${year === "all" ? "All available periods" : year} · ${currency} only`}
                  />
                  <Stat
                    label="Recorded orders in selection"
                    value={
                      revenue.length ? number(sum(revenue, "orders")) : "—"
                    }
                    note="One count per deduplicated order"
                  />
                  <Stat
                    label="Average recorded order"
                    value={
                      revenue.length
                        ? money(total / sum(revenue, "orders"), currency)
                        : "—"
                    }
                    note="Same currency and financial measure"
                  />
                </div>
                {basis === "Shopify merchandise estimate" ? (
                  <p className="sales-caveat">
                    Estimate: recognized subscription line price × quantity,
                    less recorded line discounts, in the customer’s presentment
                    currency. Excludes other products. Order-level adjustments,
                    tax, refunds, and settlement are unavailable.
                  </p>
                ) : (
                  <p className="sales-caveat">
                    Historical coverage is incomplete. Manual grants and test
                    payments are excluded. Current paid records can overwrite
                    earlier purchases; a blank period does not establish zero
                    sales.
                  </p>
                )}
                <RevenueChart
                  rows={revenue}
                  currency={currency}
                  granularity={granularity}
                  year={year}
                  generatedAt={data.generatedAt}
                />
              </Panel>
              <div className="sales-two-col">
                <Panel
                  title="Current subscription mix"
                  description="Active accounts only. Legacy plans are inferred from USD price; access extensions can differ from the original purchased term."
                >
                  <Bars
                    rows={data.mix.filter((x) => x.status === "Active")}
                    labelKey="plan"
                    valueKey="count"
                    caption="Active accounts by latest recorded plan"
                  />
                </Panel>
                <Panel
                  title="Billing geography"
                  description="Current Shopify records only; billing country is not a marketing acquisition source."
                >
                  <Bars
                    rows={data.countries.slice(0, 10)}
                    labelKey="country"
                    valueKey="count"
                    caption="Top billing countries · account count"
                  />
                </Panel>
              </div>
              <Panel
                title="Purchase records"
                description="Filtered to the selected financial measure, currency, and year. First recorded purchase does not necessarily mean first-ever purchase."
              >
                <label className="sales-search">
                  Find account UID
                  <input
                    value={purchaseQuery}
                    onChange={(e) => setPurchaseQuery(e.target.value)}
                    placeholder="Search account UID"
                  />
                </label>
                <Records
                  key={basis + currency + year + purchaseQuery}
                  rows={ledger}
                  columns={[
                    {
                      label: "Account UID",
                      render: (r) => <code>{r.uid || "Unlinked"}</code>,
                    },
                    {
                      label: "Purchase recorded",
                      render: (r) => date(r.paidOn),
                    },
                    { label: "Plan", render: (r) => r.plan },
                    {
                      label: "Amount",
                      render: (r) => money(r.displayAmount, currency),
                    },
                    { label: "Channel", render: (r) => r.channel },
                    { label: "History", render: (r) => r.purchaseKind },
                  ]}
                />
              </Panel>
            </>
          )}
          {tab === "Membership" && (
            <>
              <Panel
                title="Renewals & account access"
                description="Expiration is the date access ends unless extended. These records do not establish an automatic renewal charge or cancellation. Current paid records only; dates are shown in UTC."
              >
                <div className="sales-controls">
                  <label>
                    Membership status
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {[
                        "All",
                        "Active",
                        "Expired",
                        "Due in 30 days",
                        "Unknown",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Account UID
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search account UID"
                    />
                  </label>
                  <button
                    onClick={() => {
                      setStatus("Due in 30 days");
                      setQuery("");
                    }}
                  >
                    Upcoming renewals
                  </button>
                </div>
                <Records
                  key={status + query}
                  rows={members}
                  columns={[
                    {
                      label: "Account UID",
                      render: (r) => <code>{r.uid}</code>,
                    },
                    {
                      label: "Status",
                      render: (r) => (
                        <span
                          className={`sales-badge ${r.status === "Active" ? "is-active" : ""}`}
                        >
                          {r.status}
                        </span>
                      ),
                    },
                    {
                      label: "Plan / access",
                      render: (r) => (
                        <>
                          {r.plan}
                          {r.accessAdjusted && <small>Admin adjusted</small>}
                        </>
                      ),
                    },
                    {
                      label: "Last recorded purchase",
                      render: (r) => date(r.lastRecordedPurchaseOn),
                    },
                    {
                      label: "Expiration / renewal due",
                      render: (r) => date(r.expiresOn),
                    },
                    {
                      label: "Current favorites",
                      render: (r) => number(r.favorites),
                    },
                    {
                      label: "Recorded purchases",
                      render: (r) => number(r.recordedPurchases),
                    },
                  ]}
                />
              </Panel>
              <Panel
                title="Access composition"
                description={`${number(data.summary.manualAccess)} accounts have a latest manual grant. A manual grant is not revenue; valid older purchases remain in the payment history.`}
              >
                <Bars
                  rows={data.mix.map((x) => ({
                    label: `${x.plan} · ${x.status}`,
                    value: x.count,
                  }))}
                  caption="Current accounts by access status and plan"
                />
              </Panel>
            </>
          )}
          {tab === "Retention & engagement" && (
            <>
              <Panel
                title="Monthly access retention"
                description="Prospective measure: accounts active at the opening snapshot that are still active at the following month’s opening snapshot, divided by opening active accounts. Includes granted access; excludes new accounts from the denominator."
              >
                {data.retention.length ? (
                  <Records
                    rows={data.retention}
                    columns={[
                      { label: "Month (UTC)", render: (r) => r.month },
                      {
                        label: "Opening active",
                        render: (r) => number(r.openingActive),
                      },
                      {
                        label: "No longer active",
                        render: (r) => number(r.lost),
                      },
                      {
                        label: "Unknown at close",
                        render: (r) => number(r.unknown),
                      },
                      {
                        label: "Access lapse rate",
                        render: (r) => percent(r.lapseRate),
                      },
                      {
                        label: "Access retention",
                        render: (r) => percent(r.retentionRate),
                      },
                    ]}
                  />
                ) : (
                  <p className="sales-empty">
                    Monthly retention is not yet available. It requires
                    snapshots at both month boundaries; historical churn cannot
                    be reconstructed reliably from overwritten access records.
                  </p>
                )}
                <p className="sales-caveat">
                  Access lapses are not confirmed cancellations. Reactivation
                  before the closing snapshot counts as retained. Daily
                  snapshots run at 00:05 UTC; boundary observations may lag by
                  up to one day.
                </p>
              </Panel>
              <div className="sales-two-col">
                <Panel
                  title="Favorites & current access"
                  description="Current favorites are not favorites at churn. This comparison includes all current paid records and is descriptive, not evidence that favorites prevent churn."
                >
                  <Records
                    rows={data.engagement.filter((x) => x.accounts)}
                    columns={[
                      { label: "Current status", render: (r) => r.status },
                      { label: "Accounts", render: (r) => number(r.accounts) },
                      {
                        label: "With favorites",
                        render: (r) => percent(r.withFavorites / r.accounts),
                      },
                      { label: "Mean", render: (r) => number(r.meanFavorites) },
                      {
                        label: "Median",
                        render: (r) => number(r.medianFavorites),
                      },
                    ]}
                  />
                  {data.engagement
                    .filter((x) => x.accounts)
                    .map((group) => (
                      <Bars
                        key={group.status}
                        rows={group.buckets}
                        labelKey="label"
                        valueKey="count"
                        caption={`${group.status} accounts · current favorite count`}
                      />
                    ))}
                </Panel>
                <Panel
                  title="Expiration history of current records"
                  description="This is a distribution of the latest expiration dates among currently expired accounts. Renewed accounts disappear from past months, so this is not a historical churn series."
                >
                  <Bars
                    rows={data.expirations.slice(-18)}
                    labelKey="month"
                    valueKey="count"
                    caption="Last 18 represented months · expired accounts"
                  />
                </Panel>
              </div>
              <Panel
                title="Favorites around observed access lapses"
                description="Daily observations going forward: favorite counts at the last active snapshot and first inactive snapshot. These bracket the observation interval; neither is an exact event-time favorite count."
              >
                <Records
                  rows={data.lapseObservations}
                  empty="No prospectively observed access lapses yet. Current favorites are never backfilled as historical favorites."
                  columns={[
                    {
                      label: "Account UID",
                      render: (r) => <code>{r.uid}</code>,
                    },
                    {
                      label: "Last active observation",
                      render: (r) => date(r.lastActiveObservedAt),
                    },
                    {
                      label: "Lapse observed",
                      render: (r) => date(r.observedAt),
                    },
                    {
                      label: "Favorites before",
                      render: (r) => number(r.favoritesAtLastActiveSnapshot),
                    },
                    {
                      label: "Favorites at observation",
                      render: (r) => number(r.favoritesAtObservation),
                    },
                  ]}
                />
              </Panel>
              <Panel title="Marketing & finance coverage">
                <p>
                  Repeat recorded buyers and upcoming expirations can inform
                  retention planning. Billing geography describes the available
                  Shopify audience. Acquisition source, visits, campaign spend,
                  conversion rates, cancellation reasons, refunds, fees, profit,
                  and lifetime value are not available in these records.
                </p>
                <p>
                  Favorites measure saved songs, not visits, listening time, or
                  monthly active users. Missing favorites nodes are counted as
                  zero synced favorites; device-only favorites are not included.
                </p>
              </Panel>
            </>
          )}
          {tab === "Sources & definitions" && (
            <>
              <Panel
                title="Data coverage"
                description="The server reads Firebase after checking your authenticated admin role. No customer names, emails, billing addresses, or order-status links are returned by this dashboard."
              >
                <dl className="sales-definitions">
                  <dt>Current access records</dt>
                  <dd>
                    {number(data.coverage.paid)} records from paid. This is not
                    the full Firebase Auth user population.
                  </dd>
                  <dt>Historical transaction records</dt>
                  <dd>
                    {number(data.coverage.transactions)} records from
                    transactions. Earliest available purchase:{" "}
                    {date(data.coverage.firstRecordedPurchaseOn)}.
                  </dd>
                  <dt>Favorite account records</dt>
                  <dd>
                    {number(data.coverage.favoriteAccounts)} synced favorite
                    collections.
                  </dd>
                  <dt>Prospective collection</dt>
                  <dd>
                    {number(data.coverage.archiveEvents)} payment change events;{" "}
                    {number(data.coverage.snapshots)} daily snapshots. First
                    snapshot: {date(data.coverage.snapshotStartedOn)}. Retention
                    views use the latest 400 daily snapshots.
                  </dd>
                  <dt>Deduplication</dt>
                  <dd>
                    {number(data.quality.duplicates)} repeated order records
                    merged by source/order ID. {number(data.quality.conflicts)}{" "}
                    conflicting orders excluded from financial totals.
                  </dd>
                  <dt>Exclusions</dt>
                  <dd>
                    {number(data.quality.excludedManual)} manual records;{" "}
                    {number(data.quality.excludedNonLive)} non-live records;{" "}
                    {number(data.quality.missingOrderIds)} records without a
                    usable order ID.
                  </dd>
                  <dt>Financial gaps</dt>
                  <dd>
                    {number(data.quality.missingAmounts)} dated orders without
                    an attributable gross amount/currency;{" "}
                    {number(data.quality.missingDates)} orders without a valid
                    past purchase date. Shopify merchandise estimates are
                    reported separately.
                  </dd>
                </dl>
              </Panel>
              <Panel title="How to interpret these metrics">
                <ul>
                  <li>
                    All calendar periods and expiration dates use UTC. Financial
                    measures are grouped by currency; no exchange rate or
                    combined currency total is assumed.
                  </li>
                  <li>
                    Gross receipts are the stored gross amount on a live,
                    non-manual, uniquely identified legacy payment. They are not
                    net revenue, recognized accounting revenue, or profit.
                  </li>
                  <li>
                    Shopify estimates use only recognized subscription variants
                    and recorded presentment-currency line amounts and
                    discounts. Tax, order adjustments, refunds, and settlement
                    are unavailable.
                  </li>
                  <li>
                    Legacy 1-, 5-, and 10-year plan labels are inferred from the
                    recorded USD prices 9.99, 39.99, and 49.99. They do not
                    imply the same current access term. Manual and unknown plans
                    remain separate.
                  </li>
                  <li>
                    Renewal evidence means multiple distinct purchases for the
                    same account in the available history. Manual access
                    extensions are not purchases. Historical coverage is
                    incomplete.
                  </li>
                  <li>
                    Prospective payment events preserve old and new metric
                    fields without changing subscriptions. Daily snapshots
                    preserve future access and favorite counts. They do not
                    manufacture pre-collection history.
                  </li>
                </ul>
              </Panel>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
export default function SalesDashboard() {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      setState({ data: null, error: null, loading: true });
      if (!user) {
        setState({
          data: null,
          error: "Sign in with an admin account to view analytics.",
          loading: false,
        });
        return;
      }
      try {
        const result = await getSalesDashboard({});
        if (!cancelled && generation === current)
          setState({ data: result.data, error: null, loading: false });
      } catch (error) {
        if (!cancelled && generation === current)
          setState({
            data: null,
            error:
              error.code === "functions/permission-denied"
                ? "Admin access is required to view analytics."
                : "Analytics could not be loaded. Please try again.",
            loading: false,
          });
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [revision]);
  if (state.loading)
    return (
      <div className="sales-dashboard">
        <Header back title="Sales & engagement" />
        <main className="sales-main">
          <p role="status">Loading protected analytics…</p>
        </main>
      </div>
    );
  if (state.error)
    return (
      <div className="sales-dashboard">
        <Header back title="Sales & engagement" />
        <main className="sales-main">
          <p role="alert">{state.error}</p>
          <button onClick={() => setRevision((x) => x + 1)}>Try again</button>
        </main>
      </div>
    );
  return (
    <SalesDashboardView
      data={state.data}
      onRefresh={() => setRevision((x) => x + 1)}
    />
  );
}
