# AGENTS.md — fhirPlace

Guidance for Cursor and other coding agents working in this repository.

fhirPlace is a React 19 + TypeScript + Vite SPA with an ASP.NET Core 9 API, synthetic FHIR R4 data (Synthea), and SMART on FHIR auth. See [`docs/`](./docs/README.md) for architecture, API reference, and deployment.

---

## Dev environment

- **Full local stack:** `npm install` then `npm run dev:all` — Vite on **5173**, .NET API on **5001**.
- **Frontend only:** `npm run dev` (still needs the API for real data unless you mock).
- **API only:** `npm run server` (`dotnet run --project server`).
- The API lives in **`server/`** (ASP.NET Core 9 + SQLite). There is **no** `server.js`. Some docs still mention Express; trust this file and `server/Program.cs` when they disagree.
- **All backend HTTP from React** must go through [`src/api/fhirApi.ts`](./src/api/fhirApi.ts) (and [`src/api/auditApi.ts`](./src/api/auditApi.ts) for audit routes). Do not add ad-hoc `fetch("http://localhost:5001/...")` in components — use the exported APIs so `VITE_API_BASE` and audit headers stay consistent.
- **Client env vars** must be prefixed with `VITE_` (see [`docs/environment-variables.md`](./docs/environment-variables.md)). Copy `.env.example` to `.env`. Changing `VITE_*` values requires a rebuild.
- **Server env vars** (not exposed to the browser): `FHIRPLACE_DB_PATH`, `ALLOWED_ORIGINS`, `ASPNETCORE_URLS`. See `server/Program.cs` and `docker-compose.yml`.
- **Synthea data:** not in git (`public/synthea/fhir/*.json` is gitignored). Generate locally: `npm run synthea:setup`, `npm run synthea:run -- -p <count> -o public/synthea/fhir`, then `npm run synthea:manifest`. Java 11+ required.
- **Health check** before integration work: `curl http://localhost:5001/api/health` or `docker compose up -d` (see [`docker-compose.yml`](./docker-compose.yml)).
- **Timekeeping:** follow [`docs/timekeeping-design-system.md`](./docs/timekeeping-design-system.md). Authoritative timestamps are server-only (`server/Timekeeping.cs`); client display uses `src/lib/timekeeping.ts` — do not add ad-hoc `new Date()` for audit or clinical display.
- **Key paths:**
  - UI components: `src/Components/`
  - Hooks: `src/hooks/`
  - FHIR types: `src/types/fhir.ts`
  - Auth: `src/context/AuthContext.tsx`

---

## Testing instructions

CI is defined in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml). Run these before opening a PR:

```sh
npx tsc --noEmit
npx eslint src --max-warnings 0
npm test
```

**Integration tests** (require a running API):

```sh
# Terminal 1 — start API (or: docker compose up -d)
npm run server

# Terminal 2
npm run test:integration
```

CI starts the server with `FHIRPLACE_DB_PATH=/tmp/fhir-test.db` and `ASPNETCORE_URLS=http://+:5001`.

### Unit vs integration

| Scope | Location | Command | Server needed? |
|-------|----------|---------|----------------|
| Unit | `src/**/*.test.{ts,tsx}` | `npm test` | No |
| Integration | `tests/**/*.test.ts` | `npm run test:integration` | Yes |

`npm test` runs Vitest on `src/` only. Integration tests are kept out of the default run so unit tests stay fast.

### Writing tests

- Wrap routed or auth-dependent UI in **`TestProviders`** from [`src/test/TestProviders.tsx`](./src/test/TestProviders.tsx).
- **Mock** [`fhirApi`](./src/api/fhirApi.ts) (and `AuthContext` when needed) — see [`src/test/PatientSearch.test.tsx`](./src/test/PatientSearch.test.tsx) for patterns.
- Global setup: [`src/test/setup.ts`](./src/test/setup.ts) (jest-dom + jest-axe).
- Focus one test: `npx vitest run -t "<test name>" src/path/to/file.test.tsx`
- Coverage: `npm run test:coverage`

### Accessibility & performance (also in CI)

- **jsx-a11y** is enforced via ESLint on all TSX — zero warnings in CI.
- Unit a11y smoke: [`src/test/a11y.smoke.test.tsx`](./src/test/a11y.smoke.test.tsx) (jest-axe).
- **pa11y-ci** (production build): `npm run build`, serve `dist/` on 4173, then `npm run a11y:ci` — see [`pa11y-ci.json`](./pa11y-ci.json).
- Perf audit: `npm run perf:audit` (Playwright + [`scripts/perf-audit.js`](./scripts/perf-audit.js)).

### Named compliance tests

Tests prefixed with **`FHIR-5-AC*`** encode product rules (NLM debounce, empty states, session storage, etc.). Read them before changing search, NLM hooks (`useNLMClinicalTables`), or auth/session storage.

### .NET server

- Build: `dotnet build server/ -c Release`
- Restore: `dotnet restore server/`

---

## FHIR, ONC, and accessibility

This app targets hospital IT evaluation and ONC-related criteria documented in [`docs/onc-compliance.md`](./docs/onc-compliance.md).

- **FHIR R4** resource shapes live in `src/types/fhir.ts`. Follow existing view/panel patterns under `src/Components/`.
- **SMART on FHIR:** OAuth 2.0 + PKCE via `fhirclient` in `AuthContext.tsx`. Do not add parallel auth flows.
- **ONC audit (§170.315(d)(2)):** User identity is attached to API calls through `setAuditUser` and `fhirApi` audit headers. Server-side logging is in `server/AuditService.cs`. Do not skip audit headers for FHIR read/search routes.
- **Access control (§170.315(d)(1)):** Patient-role sessions are scoped to `linkedPatientId` via `src/lib/accessControl.ts` and `server/AccessControlService.cs`. Include `linkedPatientId` in `setAuditUser` so `X-Audit-Patient-Context` is sent. Do not add routes that bypass patient-scope checks for patient-role users.
- **CCD export:** server-side `server/CcdGenerator.cs`; triggered from Patient View.
- **Session timeout:** `useInactivityTimeout` + `SessionTimeoutWarning` — see compliance doc before changing timeout behavior.
- **Accessibility is required:** new UI must pass ESLint jsx-a11y rules and should be covered by unit a11y tests where routes are affected. Prefer semantic HTML, labels, and keyboard support consistent with existing MUI usage.

---

## PR instructions

- Run the **Testing instructions** block (`tsc`, `eslint`, `npm test`) before every commit intended for merge.
- If you changed **`server/`** or API contracts, also run `npm run test:integration` and `dotnet build server/ -c Release`.
- If you changed **routing**, **Patient View**, or **Audit** pages, consider `npm run build` + `npm run a11y:ci`.
- Do not commit `.env`, secrets, or `server/bin/` / `server/obj/` build artifacts.
- When touching audit, export, SMART auth, or session timeout, note it in the PR and reference [`docs/onc-compliance.md`](./docs/onc-compliance.md).
- Fix any test, type, or lint errors until the suite is green — do not disable rules or skip CI jobs without explicit user approval.

---

## Quick reference — npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev:all` | Vite + .NET API |
| `npm run dev` | Vite only |
| `npm run server` | .NET API only |
| `npm run build` | `tsc -b` + production Vite build |
| `npm test` | Vitest unit tests (`src/`) |
| `npm run test:integration` | API integration tests (`tests/`) |
| `npm run lint` | ESLint (entire project; CI uses `eslint src`) |
| `npm run synthea:manifest` | Refresh `public/synthea/manifest.json` |
