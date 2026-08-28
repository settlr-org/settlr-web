# Missing-surface acceptance report

Date: 2026-08-28  
Target: local production-equivalent web frontend at `http://localhost:3000`, connected through the existing API proxy to the Docker backend.

## Verified in agent-browser

- Authenticated navigation keeps the existing sidebar DOM node mounted from Overview to Groups (`data-persistence-probe` survived the route change).
- Email invitation was sent for **QA Pokhara Audit** and the success status rendered; the pending invitation also appeared in the group control room.
- A fresh QA account opened the token route, accepted the invitation, landed in the correct ledger, left the group, and was deleted afterward.
- Global search returned the QA secondary user and opened the new friend profile/direct-ledger page.
- Group control room loaded settings, pending invitations, members, recurring expenses, statistics, exports, activity, and destructive controls.
- A recurring expense was created, appeared in the schedule list, and was deleted after confirmation.
- Expense record loaded editable details and percentage splits.
- A comment was created, displayed, and deleted after confirmation.
- A PNG receipt was uploaded, displayed, downloaded, and deleted after confirmation.
- Settlement history exposed edit/delete controls; edit opened with the original amount/note and locked payer/recipient.
- Personal expense edit opened with the saved amount, category, date, currency, and notes.
- Settings loaded payment details, individual/all-session revocation, account exports, resend-verification, and account deletion controls.
- Account deletion completed and cleared the temporary QA session.
- No browser page errors were reported during the acceptance flows.

## Visual review

- `group-control-room-light.png`: desktop group management in the paper/forest theme.
- `expense-record-light.png`: desktop expense record with visible Ant icons.
- `expense-record-dark.png`: dark theme icon and control contrast.
- `invitations-mobile-dark.png`: 390 × 844 invitation flow and bottom navigation.
- `settings-complete-dark.png`: complete settings/account surface.

## Automated checks

- Prettier: pass
- TypeScript: pass
- Vitest: 2 files / 6 tests pass
- Next.js production build: pass, 17 routes generated

## Backend ingress

Nginx proxies to host port `18080`; Docker maps `127.0.0.1:18080` to the API container's listening port `8080`. Both direct and Nginx-proxied `/health` requests returned `{"status":"ok"}`.
