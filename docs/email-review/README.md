# Payment email review — September 19, 2026

The before screenshots render a historical activation email received on August 29, 2026, recovered with the IMAP Gmail skill. The after screenshots render the revised activation email actually delivered to the operator on September 19. Email addresses were redacted for this report. These are browser renders of received HTML at 390px and 800px, not screenshots of the Gmail application. Scripts and AMP boilerplate were removed for the historical HTML render, approximating a standard HTML email client; full cross-client testing remains separate.

| Check | Before | After |
| --- | --- | --- |
| Phone viewport | 390px viewport / 708px document; horizontal overflow and clipped header | 390px viewport / 390px document; no horizontal overflow |
| Images | AMP elements and background photo | Standard `img` with descriptive alt text; loaded successfully |
| Mobile photo | Oversized background crop | 280px wide, centered (55px from either viewport edge) |
| Account details | Expiration buried in copy | Email, subscription term, purchase date, expiration together |
| Closing | Dense left-aligned text | Centered thank-you, italic Georgia sign-off, small spaced team signature |
| New account credentials | Generated password in email | Password-setup link plus email magic-link option |
| Delivery | Historical production email | All three revised templates delivered and verified through IMAP |

## Mobile comparison

[Before](before-mobile.png) · [After](after-mobile.png)

## Desktop comparison

[Before](before-desktop.png) · [After](after-desktop.png)

The final delivered test batch used marker `BHAJANS-TEST-2026-09-19T22-44-05-286Z`. The conspicuous test banner is added only by the smoke-test script and does not appear in customer emails. Tests do not create accounts or modify subscriptions. Shopify welcome and activation templates use the original production product mapping; the India template retains its regional notice.

Purchase date comes from Shopify `processed_at`, falling back to `created_at`, or WooCommerce `date_paid_gmt`. Missing dates show “Not recorded” rather than substituting the email date. Dates are formatted in UTC. Subscription duration comes from the recognized product variant/SKU.
