# Automatio staging integration
Current architecture: authenticated TanStack server function -> `src/lib/monitoring/automatio.server.ts` -> Supabase JWT-authenticated Edge Function `automatio-search` -> Automatio API. Secrets are only accessed from Supabase Edge Function runtime.

## Current state
- Supabase staging project: `ypwuipicbfsdyihfsrhc`.
- Edge Function `automatio-search`: active, requires a user JWT.
- Source code: `supabase/functions/automatio-search/index.ts`.
- Frontend monitoring already calls `getFeed` via authenticated server function; provider `existing` continues to use old sources, `hybrid` adds Automatio, `automatio` also retains existing sources for resilient fallback.
- No user account or organization has yet been created in the new database (verified on 2026-10-23). Therefore live authenticated search, billable calls and actual credit recording are NOT yet verified.
- New personal organizations default to `provider='existing'`; enabling `hybrid` should be a conscious admin action after signup and cost-cap review. Do not globally enable Automatio for unapproved customers.
- Staging app server needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to run existing server functions. Frontend needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Edge Function reads `AUTOMATIO_API_KEY` from Supabase Edge Functions Secrets and `AUTOMATIO_MAX_CREDITS_PER_CALL` (fallback 10). The secret is never forwarded to browsers or GitHub.
- URL reading deliberately disabled; only `web_search` is available.

## Next steps, no production deployment
1. Configure staging app runtime env vars privately.
2. Complete signup/login in staging, verify personal organization trigger and membership.
3. Enable `provider='hybrid'` for only the authorized test organization by a privileged admin, confirming monthly quotas.
4. Run one authenticated query; verify Edge Function HTTP response, `tenant_credit_usage` status/charged amount, `tenant_monthly_usage` counters, and fallback sources.
5. CI `npm ci`, typecheck, lint and build must pass before preview deployment.

Do not put the Automatio key or Supabase service role key in tracked files.
