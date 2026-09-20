# Admin sales and engagement analytics

Route: `/admin/analytics`, linked from the existing Admin page. This is a live
Firebase-backed feature, not a bundled data export. No production records are
checked in. The local review script accepts private, gitignored snapshots under
`node_modules/.cache/dashboard-data/`, replaces account/order identifiers, builds
into a separate cache directory, and serves only on loopback port 4187.

## Security and runtime

`getSalesDashboard` is a gen2 callable on Node 24. Firebase validates the caller's
ID token, then the handler reads `admin/<request.auth.uid>` and requires the exact
string `"1"` before reading any analytics sources. Caller-supplied roles, paths,
and filters are ignored. Every request rechecks the role. No cross-user response
cache or client persistence is used. The UI clears its data when auth changes and
ignores a response from a previous auth session.

All three new functions explicitly use
`bhajans-588f5@appspot.gserviceaccount.com`. Never remove that setting: the default
Compute identity does not have the existing RTDB permissions. The runtime
regression test and `bun run verify:functions:deployed` cover these exports.

Analytics RTDB nodes deny all client reads and writes, including admin clients;
only server Admin SDK accesses them. The scheduler and database trigger have no
public data endpoint. The callable returns account UIDs for admin investigation,
but no email, name, address, payer data, favorite song names, or order-status URL.
Do not embed its result in public assets or application logs.

## Sources and definitions

| View                                 | Source / grain                                                  | Interpretation                                                                                     |
| ------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Active/expired access, renewal queue | `paid`, one current row per UID                                 | Future expiration vs elapsed expiration; not a cancellation or automatic rebill                    |
| Gross receipts                       | `transactions` + `paid` + prospective archive, unique order     | Live, non-manual, recorded amount and currency; not net or recognized revenue                      |
| Shopify merchandise estimate         | Recognized subscription line items                              | Presentment price × quantity minus stored line discounts; other products excluded                  |
| Plan mix                             | Shopify variant or legacy USD price                             | Explicit variant mapping; legacy 9.99/39.99/49.99 implies 1/5/10 years, disclosed inference        |
| Repeat recorded buyers               | Distinct valid dated orders per UID                             | Lower-bound history; first recorded purchase is not necessarily first-ever                         |
| Current favorites                    | `favorites/<uid>` keys with `1`, `"1"`, or `true`               | Synced saved songs; missing node is zero, device-only favorites excluded                           |
| Geography                            | Current Shopify billing country code                            | Account distribution, not acquisition attribution                                                  |
| Monthly access retention             | Opening active snapshot cohort vs next month's opening snapshot | Still-active fraction; includes grants, excludes new cohort entrants, reactivations count retained |
| Favorites around lapse               | Consecutive daily snapshots at most 36 hours apart              | Last active and first inactive counts, never exact event-time favorites                            |

All dates/periods use UTC. Currencies are never added together. Money is summed in
integer hundredths of the recorded currency. The two financial measures are
separate and must not be combined. Current periods are incomplete; missing
periods are gaps, not zero sales. Unsupported metrics (cancellation churn, visits,
MAU, marketing conversion, CAC, refunds, fees, profit, and LTV) are explicitly
unavailable.

### Deduplication and exclusions

- Legacy/WooCommerce order IDs are namespaced `payment:`, Shopify order numbers
  `shopify:`. Repeated records for one order count once. Transaction history is
  consumed first so its original purchase timestamp takes precedence.
- Conflicting amounts/currencies or different linked UIDs for the same order are
  excluded from all financial totals and counted in the coverage diagnostics.
- Manual grants (including legacy admin payer/order markers), non-live records,
  unusable order IDs, invalid/future purchase dates, and invalid amounts do not
  contribute to gross receipts. Valid older purchases remain even when current
  access is a manual grant.
- WooCommerce access updates may retain older payment fields. Neither old gross
  amounts nor old Shopify lines are attributed to a new WooCommerce order.
- Shopify presentment money is used only when both price and discount currency
  are known and consistent. It is an estimate of subscription merchandise,
  excluding unrecorded order adjustments, tax, refunds, fees, and settlement.
- Long or admin-extended access is never used to infer the purchased plan.

## Prospective collection

`archiveDashboardPayment` watches `/paid/{uid}`. It stores a minimal allowlisted
before/after event at `analytics/paymentEvents/<sha256 event ID>`. A transaction
makes retries idempotent. It does not modify payments, subscriptions, customer
accounts, or emails. It captures overwritten records going forward and does not
claim to restore earlier overwritten history.

`captureDashboardSnapshot` runs daily at 00:05 UTC. It reads current access and
synced favorites, then records one immutable first observation for that UTC date
at `analytics/snapshots/YYYY-MM-DD`. Only UID, active state, expiration, favorite
count, and observation timestamp are stored. Reads are near-contemporaneous, not
an atomic historic event. There is no client-triggered snapshot API.

The dashboard reads the latest 400 snapshots. Monthly retention requires both
calendar-boundary snapshots with observations within one day of the boundaries.
Unknown/missing closing status suppresses the rate. Missing snapshots never
produce synthetic historical churn. Daily lapse comparisons skip gaps over 36
hours. Counts at exact churn time remain unavailable; the UI labels the actual
observation interval. Records are retained server-side; define a longer-term
retention/deletion policy before this archive becomes large. The callable reads
the entire order archive and is suitable for the current ~thousand-account scale;
move financial aggregates to incremental monthly materializations as it grows.

## Deployment

Fetch and integrate current `origin/master` before pushing. Do not deploy an old
checkout or overwrite recovered Shopify handlers. The payment code is unchanged.

After `bun run test:functions`, `bun run validate`, and `bun run build` pass:

```sh
bunx --package node@24 node functions/node_modules/firebase-tools/lib/bin/firebase.js deploy --project bhajans-588f5 --only functions:admin --non-interactive
bun run verify:functions:deployed
```

**Do not blindly deploy `database.rules.json`.** Production has known existing
rule differences on `admin`, `paid`, and `users`. Its current root grants neither
read nor write and has no analytics node, so analytics is already denied. Either
leave production rules unchanged or merge only the explicit analytics deny node
into a freshly read live rules document while preserving every other live rule.
The repository change adds only that node; it does not reconcile unrelated drift.

No historical baseline is backfilled. An authorized operator can optionally run
the newly deployed Cloud Scheduler job once to capture today's first real
snapshot, or let the next 00:05 UTC run initialize it. Do not invoke payment
webhooks, change a subscription, or send an email to test analytics.

After Netlify deploys the pushed commit, verify `/admin/analytics` with an actual
admin session, and call the callable without auth and with an authenticated
non-admin token to confirm rejection. Verify runtime identity for all exports.
Successful build/deploy alone does not prove production auth or IAM works.

## Validation and local review

- Pure metric tests: duplicates, grants, sandbox, conflicting orders, currencies,
  missing/invalid/future dates and amounts, Shopify discounts/quantity/products,
  preserved WooCommerce metadata, zero favorites, and retention boundaries.
- Handler tests: no data reads before auth/role check, exact role comparison,
  no writes from callable, idempotent archive/snapshot, PII allowlist, identity.
- React tests: currency/year totals, member filtering, historical caveats,
  access-denied state, and refresh.
- `node scripts/preview-sales-dashboard.mjs` creates a separately built review
  using anonymized private snapshot aggregates. It is never included in `dist/`.
  Browser rendering must be checked separately; compilation is not visual proof.

### Verification in this implementation task

The final implementation passes the Node 24 backend suite, root type/lint/unit
validation, production Vite/PWA build, and Yarn Functions syntax build. An
independent calculation over the private source snapshots reconciled legacy
receipts by year with the dashboard aggregation, including conflict exclusions.
No raw records were added to Git.

Rendered browser acceptance remains **unverified**: CUA returned “The
admin-enforced policy could not be verified, so access was not granted” and
instructed the agent not to bypass browser security controls. The compiled local
preview is available, but compilation does not establish rendered correctness.
Production deployment/API checks are a separate operator verification step.
