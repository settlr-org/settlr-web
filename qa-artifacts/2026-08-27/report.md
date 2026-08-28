# Settlr UI acceptance report

## Scope

- Local web build connected through the production API proxy.
- Desktop viewport: 1280 × 800. Phone viewport: 390 × 844.
- Light and dark themes across all authenticated routes.
- Two-user shared-ledger flows plus a third isolated account for friend-request rejection.
- Expo mobile web rendering plus native bundle/type/test validation.

## Result

All features marked in `FEATURE_CHECKLIST.md` passed. Automated axe scans reported zero accessibility violations on the landing page and all eight authenticated views in light and dark themes. The remaining two “incomplete” checks are axe’s inability to determine backgrounds behind a decorative overview pseudo-element and a bottom-nav label partially covered by the audit browser’s development overlay.

The icon contrast script inspected 18–26 visible button/link icons per authenticated page in each theme. No icon measured below 3:1 against its effective background.

## Data-changing acceptance flows

- Registered isolated primary, secondary, and rejection-test accounts.
- Created groups and verified the selected TRIP type after reload.
- Added a member, sent/accepted/rejected friend requests, and verified the direct ledger.
- Added equal, exact, percentage, and shares expenses.
- Verified a combined USD 200 debt, recorded a USD 50 partial settlement, and observed USD 150 remaining before deleting the shares test expense.
- Deleted an expense through the confirmation dialog.
- Added a personal NPR 12.50 expense, updated the NPR 3,000 monthly budget, and validated the exported CSV.
- Marked one notification and then all notifications read.
- Updated/restored profile fields and changed/restored the audit password.
- Signed out and signed back in through protected deep links.

## Defects corrected during the pass

- Login payload contained a register-only field rejected by the strict backend.
- Protected deep-link redirect raced the session redirect.
- “Keep me signed in” had no behavior.
- Theme reset on navigation and flashed before hydration.
- Dark primary buttons and several icons failed contrast.
- Dark group summary used the text token as a background and turned white.
- Mobile page actions and mobile settlement entry were unavailable.
- Mobile Activity had no timeline styling.
- Group type selection was not persisted by the create request.
- Static Active/Archived controls implied a filter that did not exist.
- Notification toggles had no accessible names.
- Password update succeeded server-side and then crashed while resetting the form.
- Modal keyboard/focus behavior was incomplete.
- The Features landing link had no valid target.
- API calls could remain pending during an upstream TLS outage.

## Evidence

Screenshots `01`–`75` in `screenshots/` record the public, authentication, shared-ledger, settings, responsive, theme, and Expo views. `settlr-personal-expenses.csv` is the validated export artifact.

Screenshot `76-production-after-push.png` verifies the connected Vercel production deployment after the final push.

## Infrastructure check

`/etc/nginx/nginx.conf` proxies to `127.0.0.1:18080`. Docker publishes `127.0.0.1:18080 -> 8080/tcp`, while the API is configured with `PORT=8080` and `EXPOSE 8080`. The nginx upstream therefore matches the backend’s published listening port.
