# Settlr web frontend plan

## Stack and boundaries

Build a strict-TypeScript Next.js App Router application with the current supported Next.js release, React, the private Settlr design packages, TanStack Query, React Hook Form, Zod, and a generated `@nabinkhanal00/settlr-api-client`. Use CSS variables from the design package and keep server-only modules isolated from Client Components. Next’s App Router is the selected file-system and server/client boundary ([documentation](https://nextjs.org/docs/app)).

The browser calls `https://settlrapi.theswissknife.com` with `credentials: include`. Web login/refresh uses a host-only Secure HttpOnly refresh cookie issued by the API and keeps the short-lived access token in memory. No refresh token or secret may appear in local storage, `NEXT_PUBLIC_*`, source maps, logs, or client bundles.

## Routes and flows

Public routes are `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/verify-email`. Protected routes are `/overview`, `/groups`, `/groups/[id]`, `/groups/[id]/expenses/[expenseId]`, `/friends`, `/personal`, `/activity`, `/notifications`, and `/settings` with nested profile, sessions, notifications, payment, and export views.

The authenticated shell performs one refresh-cookie bootstrap, fetches `/me`, then hydrates query caches. Mutations invalidate only affected group, balance, activity, notification, and personal keys. Every financial create operation sends an idempotency key. 401 responses attempt one refresh, then clear the session and return to login; 403/404/409/422 errors map to inline, field-level, or toast messages without exposing server internals.

## UI behavior

Overview leads with “You owe”, “You are owed”, and “Net balance”, followed by next-best settlement action and recent activity. Groups show expenses, balances, members, activity, recurring items, and settings as tabs. Add Expense is a progressive form supporting equal, exact, percentage, and shares splits, currency conversion, category, date, notes, receipt, and comments. Desktop uses the persistent rail; under 900px it collapses to a compact header and bottom action pattern.

Use the design repo for loading skeletons, empty states, destructive dialogs, keyboard navigation, focus return, reduced motion, and long-content handling. Render all user/API text as escaped React content; validate external URLs before using them in links or images; do not use raw HTML sinks.

## Delivery and testing

Vercel project `settlr` remains the production target for `settlr.theswissknife.com`; previews must use explicit API environments and never widen production CORS. CI runs typecheck, lint, unit/component tests with MSW, Storybook build, accessibility checks, Playwright desktop/mobile flows, and dependency/vulnerability checks. Capture a login → dashboard → add expense → settle flow and verify keyboard, screen-reader labels, focus, error, and expired-session states.
