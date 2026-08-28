# Navigation, invitations, quick actions, and verification QA

Date: 2026-08-28

- Reproduced the supplied quick-action icon overlap and traced it to Ant Design's `.anticon` wrapper being styled as metadata.
- Reviewed `overview-quick-actions-fixed.png`: three icons have independent ledger seals and no overlap in light theme.
- Navigated Overview → Groups → Overview → Groups → Overview after warming the session cache. Mutation/resource instrumentation reported `loadingSeen: 0` and `apiRequests: []`.
- Reviewed `friends-email-invite.png`: email invitation is part of Friends and the sidebar has no Invitations item.
- Registered a fresh QA account through the rendered form. The browser stayed on the verification-required state without receiving a session.
- Confirmed the same unverified credentials receive HTTP 403 at sign-in and expose a working resend-verification action.
- Backend integration coverage verifies registration → blocked login → token verification → successful login.
- Removed the temporary unverified QA account after acceptance testing.
