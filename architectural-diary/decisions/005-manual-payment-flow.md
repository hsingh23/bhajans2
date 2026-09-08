# 005 — Manual, admin-approved membership payments

**Date:** 2017-07 → ongoing · **Status:** active (by choice)

## Context

The app charges a small membership (originally $4.99 lifetime, later 1/5/10-year
plans at $9.99/$39.99/$49.99) whose net proceeds go to the Embracing the World
charity. Payment providers kept changing (PayPal → Amazon digital → CD Baby →
Amma Shop/WooCommerce), and each automation attempt (PayPal webhooks in
`functions/src/index.js` `amritabooks`, a `shopify_paid` stub) ended up
commented out or abandoned.

## Decision

Keep payment **external and manual**:

1. User buys a plan on the external shop (PayPal/Amma Shop), autofilled with
   their account email (`071fbd4`).
2. A webhook or manual entry writes `paid/<uid>` in the Realtime Database.
3. The `paid` DB trigger (`functions/src/index.js`) pushes an FCM notification
   to **admins** ("X signed up! paid $9.99").
4. An admin verifies the transaction in the Admin UI and confirms access
   (`confirmPayment` → `confirmedPayment` nodes; the beta flow
   `confirmBeta`/`confirmedBeta` works the same way).
5. `syncUserData` on the client reads `expiresOn` and gates the app; the Pay
   page explains the two-business-day manual delay.

## Consequences

- Zero payment-automation maintenance; provider churn costs only a link swap
  (`158a9bf`, `b248292`, `27f4df0`).
- Users wait for a human; the Pay page sets expectations and offers a support
  mailto pre-filled with the user's `uid`/`expiresOn` (`f23cebb`).
- Admin tooling became product surface: `getUserByEmail` callable + React
  Query lookup (`40cd2e1`), activation email templates (`b561d68`), and the
  wrong-email failure mode ("DO NOT change this email at checkout") is
  documented in the Pay page copy.

## Rule for agents

Do not automate this flow without explicit instruction; the manual step is the
point (fraud-checking by a human for a charity).

## Evidence

`b1d339b` (self-serve PayPal), `61f084b` (reset page era pay fixes),
`158a9bf`/`b248292` (provider swaps), `7066c68` (10-year plan), `40cd2e1`
(admin lookup), `f23cebb` (pay page identity), `2eb170c` (Woo webhook).
