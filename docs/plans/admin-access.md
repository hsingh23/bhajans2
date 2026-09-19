# Admin access repair

Completed: pulled the default branch (`master`), confirmed the reported account exists in Firebase Auth, and identified the missing deployed lookup function.

Implemented: email/UID lookup with explicit errors; auth readiness; atomic 1-year, 10-year, custom-year extensions and date overrides; preserved payment metadata; Node 24/gen2 functions with current dependencies; recovered and tested production Shopify behavior; modern responsive payment emails with subscription, purchase date and expiration; bounded artifact cleanup.

Validation: backend behavior/runtime tests, frontend validation, production build, browser E2E, mobile admin render with mocked backend boundaries, signed/unsigned live webhook smoke checks, deployed source comparisons, actual test-email delivery through Mailjet and IMAP, and desktop/mobile email screenshots. No customer's account or subscription was changed during validation.

See [deployment notes](../DEPLOYMENT.md) and [email review](../email-review/README.md).
