# Settlr web plan

This repository contains the implementation-ready web product plan. It targets the existing Vercel project and custom domain but does not alter production during the design phase.

## Delivery

Pull requests run formatting, TypeScript, unit tests, and a production Next.js build. A push to `main` deploys the verified prebuilt output to the protected `production` GitHub environment.

Configure repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. The optional `NEXT_PUBLIC_API_URL` repository variable controls the upstream used by the server-side API proxy; it defaults to the production Settlr API.
