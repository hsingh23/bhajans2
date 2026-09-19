# Deploying Sing with Amma

The default GitHub branch is `master`. Netlify site `bhajans` builds that branch with `bun run build` and publishes `dist` to https://sing.withamma.com. `netlify.toml` pins Node 24 and keeps service workers uncached.

## Functions

Both `functions/` (payments/notifications) and `admin-functions/` (admin callables) run on Node 24, Firebase Functions generation 2 / Cloud Run. They use firebase-admin 14.4.x, firebase-functions 7.4.x, native fetch, and CommonJS directly; Babel and obsolete client SDK/fetch dependencies were removed. `functions/` uses Yarn, not Bun, for its dependencies.

```sh
# Use Node 24 in the shell first.
yarn --cwd functions install --frozen-lockfile
yarn --cwd admin-functions install --frozen-lockfile
yarn --cwd functions build
bun run test:functions
bun run validate
bun run build

# Authenticate with Firebase CLI or appropriate Application Default Credentials.
bunx --package node@24 node functions/node_modules/firebase-tools/lib/bin/firebase.js login
bun run deploy:functions
```

`deploy:functions` deliberately selects only the six maintained functions. Do not replace it with an unscoped `firebase deploy --only functions --force`: the Firebase project also contains other legacy services.

Maintained endpoints:

- `getUserByEmail`: admin-only callable, accepts email or UID, reports real not-found/auth/permission failures.
- `updateUserAccess`: admin-only callable, atomically extends from the later of now and existing expiration, or sets an explicit end-of-day UTC date. Existing payment metadata is preserved. Manual access changes do not fabricate payment amounts.
- `manuallyAddUser`: compatibility HTTP endpoint, now requires a verified Firebase bearer token and admin role.
- `shopifyWebhook`: signed Shopify order processing. Original variants: `37277000728740` = 1 year; `37277000794276` = 5 years; `37277000827044` = 10 years. Existing behavior chooses the last matching variant and grants its duration from processing time. The email prefers contact_email, then email; missing accounts get setup mail, existing accounts get activation mail.
- `amritabooks`: signed WooCommerce order processing; one-year SKU, duplicate-order protection, persisted pending welcome email for retries.
- `paidNotification`: RTDB trigger replacing the old `paid` function. Handles deletion/manual grants safely and uses current FCM multicast APIs.

The original `cloudfunctions.net` URLs for Shopify, Amritabooks, and manuallyAddUser are preserved. The migration first updated those endpoints through Node 22, then used `gcloud functions upgrade` to build/test Node 24 copies, redirect traffic, and commit with `--skip-detach`. Future updates use the Firebase CLI normally.

## Secrets and identities

Secrets are in Secret Manager: `SHOPIFY_SECRET`, `AMRITABOOKS_SECRET`, `MAILJET_AUTH_HEADER`. They were migrated from the deployed configuration, never printed or committed. The runtime uses the existing `bhajans-588f5@appspot.gserviceaccount.com` identity with Firebase access and scoped secret access. Its Eventarc event-receiver role is required for the notification trigger.

Local recovered configuration lives in `functions/.env.local` and `functions/.runtimeconfig.json`, both gitignored and owner-readable. Deployment ignores also explicitly exclude these files. `.env.local` is for local tests only; production functions use Secret Manager. Do not commit downloaded source archives, which can contain historical runtime configuration.

## Email smoke tests

The following command sends three clearly marked test emails only to the operator. The test transport removes all CC/BCC recipients and never writes account or payment data:

```sh
bunx --package node@24 node --env-file=functions/.env.local scripts/test-payment-emails.cjs
```

Use the IMAP Gmail skill to sync and verify delivery. See [email comparison](email-review/README.md) for received-message screenshots and mobile layout measurements.

## Production-source audit

Before migration, the live functions used Node 16. Their executable entry was `dist/index.js`, while this repository had substantially different `src`:

- `getUserByEmail` existed locally but was not deployed, causing the broken admin lookup.
- Production `shopifyWebhook` and two Shopify email templates were absent from the repository; they were recovered from its deployed source archive. Its sourcemap exactly matched the archived `src`.
- Production `paid` and `manuallyAddUser` had minor `dist`/`src` drift: the compiled sourcemap included unused Firebase client initialization absent from archived `src`. The relevant payment/notification handlers matched.
- `process` (legacy PayPal) and `shopify_paid` (logging-only endpoint) also exist in the shared project but were absent from the checked-out implementation. They were inspected and left unchanged, along with the unrelated `shruti-sheets` service. They require a separate retirement decision; they are not part of this deployment command.

Original source SHA-256 prefixes: Shopify `0eccbcf5fdf20672`, Amritabooks `a7ef823fc22d362c`, paid/manual `b0035efd27828253`, PayPal process `9f00d7ef502d2c32`, logging-only Shopify endpoint `dc340d1ac3841c81`.

After deployment, downloaded Cloud Run source archives were compared byte-for-byte with the maintained local source and package files. Both admin and payment archives matched, and local secret files were absent.

## Artifact cleanup

Nine obsolete 2022–2023 build-cache images were deleted from the us-central1 `gcf-artifacts` repository. A cleanup policy now deletes artifacts older than 30 days while retaining the three newest versions per package. Current services and unrelated repositories were preserved. The old `paid` function was deleted only after `paidNotification` was deployed successfully.
