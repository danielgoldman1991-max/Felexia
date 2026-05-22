<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Anchored Summary

### Goal
Complete Felexia ERP: onboarding company search, commercial documents, dashboard, branding, welcome checklist, reference data, Stripe subscriptions, user management, SaaS tunnel, demo data seeding, TVA export anomalies, supplier receipts, TVA declarations, RH module, runtime fixes.

### Done (most recent first)
- **Company search provider switched to synta-iq** — `src/lib/ice/providers/syntaiq.ts` uses `GET https://www.synta-iq.com/api/ma/search?q=<ice>` (REST JSON, no scraping/CSRF). Provider chain simplified to call synta-iq exclusively.
- **HR payroll period duplicate fix** — `createHrPayrollPeriodAction` checks for existing period before insert, redirects to existing if found.
- **HR embed ambiguity fix** — replaced ambiguous Supabase embeds (`department:hr_departments`, `position:hr_positions`) with separate queries.
- **Company search feature** — `CompanyLookupStep.tsx` modal popup flow, `company-search.ts` cache (SHA-256, TTL 30j/7j, no stale "not_found"), `rate-limit.ts` (1 req/30s), `/api/company/search` (Zod + rate limits).
- **RH module** — sidebar between Trésorerie and Comptabilité, migration 082, `upsertBusinessModulesForOrganization` checks `modules_catalog`.
- **TVA declarations** — migration 080/081, full CRUD, auto-fix, DGI export integration, anomaly classification badges.
- **Supplier receipts** — stock moves, invoice link/create, financial totals, archive guard, signature blocks.
- **TVA export anomalies** — actionable `correctionUrl`/`correctionLabel`/`returnTo`, validation panel.

### Key Decisions
- synta-iq is the single company lookup source: clean JSON, no scraping, no cheerio, no CSRF
- `past_due` = grace period; only `canceled` blocks access
- `canAccessApp()` is single source of truth for subscription access
- Cache never returns "not_found" — always re-queries providers

### Relevant Files
- `src/lib/ice/providers/syntaiq.ts` — synta-iq provider (sole lookup source)
- `src/lib/ice/company-lookup-provider.ts` — simplified, delegates to synta-iq
- `src/lib/company-lookup/types.ts` — includes `"synta-iq"` source
- `src/lib/hr/hr.ts` / `src/lib/hr/actions.ts` — HR embed + payroll fixes
- `src/components/onboarding/CompanyLookupStep.tsx` — search UI with modal confirmation
- `src/lib/company-search.ts` — cache facade
- `src/lib/rate-limit.ts` — IP rate limiter
- `src/app/api/company/search/route.ts` — POST endpoint
