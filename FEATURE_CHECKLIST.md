# Settlr frontend feature checklist

Last audited: 2026-08-28. A checked item was exercised through the rendered UI with `agent-browser`, not merely inferred from source code.

## Public and authentication

- [x] Landing page renders at desktop and phone widths.
- [x] Landing navigation, “How it works”, and “Features” anchors navigate correctly.
- [x] Landing sign-in, registration, hero, and footer calls to action navigate correctly.
- [x] Registration creates an inactive account, sends verification, and does not create a session until the email is verified.
- [x] Unverified accounts are blocked at sign-in and can request a fresh verification email without exposing whether an address exists.
- [x] Sign-in accepts valid credentials and displays invalid-server responses.
- [x] “Keep me signed in” stores a durable session; leaving it off uses tab-scoped storage.
- [x] Protected deep links return to the originally requested page after sign-in.
- [x] Sign-out clears the session and returns to sign-in.
- [x] Forgot-password submission reaches the API and shows its completion state.
- [x] Reset-password handles an invalid token without crashing.
- [x] Verify-email handles a missing token without crashing.
- [x] Expired sessions refresh automatically; requests fail with a useful timeout instead of waiting forever.

## Shared navigation and presentation

- [x] Desktop sidebar links: Overview, Groups, Friends, Personal, Activity, Search, Notifications, Settings.
- [x] The authenticated shell remains mounted during client-side route changes; DOM identity was verified across Overview → Groups.
- [x] Overview and Groups use session-scoped stale-while-revalidate data; repeated switching paints immediately without loading placeholders or duplicate API requests.
- [x] Mobile bottom navigation: Home, Groups, Add expense, Activity, Account.
- [x] Mobile navigation drawer opens, closes from its controls, closes after navigation, and closes with Escape.
- [x] Profile shortcut opens Settings.
- [x] Notification shortcut opens the inbox.
- [x] Page-level Add expense/New group actions remain available on mobile.
- [x] Light/dark theme toggle works and persists through navigation and reloads.
- [x] Theme is applied before paint to avoid a light flash.
- [x] Every visible button/link icon is an Ant icon and remains visible in both themes.
- [x] Loading, empty, error, disabled, selected, and active states render consistently.

## Overview

- [x] Net position, owed amount, owing amount, and active-group count load from the API.
- [x] Quick actions navigate to add expense, settle up, and create group.
- [x] Recent activity preview and View all link work.
- [x] Friends preview and Manage link work.
- [x] Active group cards show type, currency, and current position and open the ledger.

## Groups and expenses

- [x] Group list loads with active count, type, currency, description, and position.
- [x] New-group dialog opens/closes by button, backdrop, close button, and Escape.
- [x] Group creation saves name, description, currency, type, and information.
- [x] Group types HOME, TRIP, COUPLE, EVENT, and OTHER are selectable; saved type was verified after reload.
- [x] Group detail loads summary totals, current balance, member count, and breadcrumb.
- [x] Expenses, Balances, Members, and Settlements tabs are keyboard/browser-operable on desktop and mobile.
- [x] Expense search filters the visible ledger.
- [x] Add-expense dialog opens on desktop and mobile.
- [x] Expense payer, date, notes, participant selection, and validation work.
- [x] Equal split saves and recalculates balances.
- [x] Exact split saves and recalculates balances.
- [x] Percentage split saves and recalculates balances.
- [x] Shares split saves and recalculates balances.
- [x] Expense deletion requires confirmation, removes the row, and updates balances.
- [x] Suggested repayments display the correct payer, recipient, and amount.
- [x] Settlement dialog is available on desktop and from the mobile Balances tab.
- [x] Partial settlement saves, appears in history, and reduces outstanding debt.
- [x] Member list displays names, roles, and positions.
- [x] Add-member dialog adds an existing user by email.
- [x] Group management edits ledger details and simplify-repayment preferences.
- [x] Email invitations can be sent from the invitation desk or a group control room; pending invites and expiration are shown.
- [x] Secure email invitation links open a dedicated acceptance page and enter the invited group.
- [x] Owners/admins can change member roles and remove members; members can leave a group.
- [x] Owners can archive or delete groups behind confirmation.
- [x] Recurring equal-split expenses can be created, paused/resumed, and deleted.
- [x] Group spending statistics, category breakdown, recent activity, and CSV/JSON exports are available.
- [x] Existing expenses open a dedicated record page and can be edited.
- [x] Expense comments can be added and deleted.
- [x] Receipt/document attachments can be uploaded, downloaded, and deleted.
- [x] Existing settlements can be edited or deleted.
- [x] Dialog focus is trapped, Escape closes, and focus returns to the opener.

## Friends and notifications

- [x] User search by name/email returns results.
- [x] Friends contains the group email-invitation form; invitations no longer occupy a separate sidebar destination.
- [x] Friend request can be sent.
- [x] Incoming friend request can be accepted.
- [x] Incoming friend request can be rejected.
- [x] Accepted friendship appears for both users and creates the direct ledger.
- [x] Friend profiles expose the direct ledger, payment details, remove-friend, and block controls.
- [x] Global search returns matching people, groups, and expenses with links to each record.
- [x] Notification inbox loads read and unread events.
- [x] A single notification can be marked read.
- [x] Mark all read updates every unread notification and the count.
- [x] Empty inbox and empty request states render correctly.

## Personal spending

- [x] Monthly spend, monthly budget, usage progress, and recent expenses load.
- [x] Budget can be created/updated for the current month.
- [x] Personal expense can be added with description, amount, date, category, and notes.
- [x] Personal expenses can be edited and deleted.
- [x] Custom personal categories can be created.
- [x] Personal CSV export downloads and contains the saved row and expected columns.

## Activity and settings

- [x] Global activity displays a responsive chronological timeline.
- [x] Profile name and default currency can be updated and reloaded.
- [x] Email/push/friend-request/settlement notification preferences toggle and expose accessible names/states.
- [x] Password can be changed; sign-in with the new password succeeds; the audit password was restored.
- [x] Active sessions list loads.
- [x] Individual sessions and all other sessions can be revoked.
- [x] Sign out this device revokes the current session.
- [x] Payment bank/handle/QR details can be saved for friends to view.
- [x] Verification email can be resent.
- [x] Complete account data can be exported as CSV or JSON.
- [x] Account deletion is available behind an explicit confirmation.
- [x] Settings anchor navigation works on desktop.

## Mobile application

- [x] Expo sign-in/register mode renders with the shared forest/paper theme and Ant icons.
- [x] Mobile login no longer sends the register-only `name` field.
- [x] Mobile API requests time out with a useful message.
- [x] Overview, Groups, Activity, Account, and Add Expense routes compile and export.
- [x] Group creation and equal-split expense creation are wired to the backend.
- [x] SecureStore persists and refreshes the native session.
- [x] Expo web export, TypeScript, formatting, and tests pass.

## Current backend surface coverage

Every currently implemented backend capability has a routed web interface. This does not claim parity with features the API itself does not yet implement (for example currency conversion or bank payment execution).
