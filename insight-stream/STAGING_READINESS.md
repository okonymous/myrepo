# Insight Stream Pro — staging readiness (2026-10-23)

The canonical working copy is `okonymous/myrepo` branch `insight-stream-pro`, directory `insight-stream/`. Do not publish to production.

## Verified connection blockers

- The Supabase project referenced by `supabase/config.toml` is `bhqkpqyusxfetlwkzppr`. It is **not** among the projects currently accessible to the connected Supabase account. Do **not** apply `supabase/migrations/20261023040500_tenant_monitoring.sql` to any other project.
- The Automatio API credential is not installed in an accessible staging backend. Configure `AUTOMATIO_API_KEY` and `AUTOMATIO_MAX_CREDITS_PER_CALL` as server-only secrets after selecting a staging environment; never commit them. `web_read_url` intentionally fails closed until safe egress and redirects can be guaranteed.
- The GitHub workflow `.github/workflows/insight-stream-ci.yml` is configured for `npm ci`, `tsc --noEmit`, ESLint and Vite build. Actual passing run output is not yet confirmed.
- The connected Vercel account lists no project named Insight Stream. Do not repurpose other Vercel projects, or create production deployments, for CI verification.

## Required validation

1. Inspect GitHub Actions run logs for this branch; repair installation, typecheck, lint and build failures in order. Avoid claiming that a green workflow exists without an actual run.
2. Check the full tenant migration, its service-role-only RPC grants, seven RLS-enabled tables, and existing archive policies against a *non-production copy of the correct database*. Run negative cross-tenant access tests before enabling paid features.
3. Validate Automatio response parsing, 429/5xx accounting, reservation/settlement, idempotency and fallback using mocked HTTP responses. Run one bounded live request only after adding API secrets securely.
4. Deploy **staging only** after code CI passes and database authorization checks succeed.

## Security gates

- Preserve existing Google News, GDELT, NewsAPI and social sources.
- Keep service-role keys and Automatio credentials on the server.
- Require authenticated and authorized tenant membership for paid endpoints.
- Do not expose arbitrary URL fetching until SSRF-resistant egress exists.
- Current GitHub repository is public; consider moving this app to a dedicated private repository before adding commercial IP.
