# Network Requirements

This page lists every port and external domain that must be reachable for fhirPlace to function. Provide these to your network or firewall team before deployment.

---

## Ports

### Development

| Port | Direction | Protocol | Purpose |
|------|-----------|----------|---------|
| **5173** | Inbound (workstation) | HTTP | Vite dev server — React SPA hot-reload |
| **5001** | Inbound (workstation) | HTTP | ASP.NET Core API (local dev only) |

### Production

| Port | Direction | Protocol | Purpose |
|------|-----------|----------|---------|
| **443** | Inbound | HTTPS | Reverse proxy / load balancer (SPA + API) |
| **80** | Inbound | HTTP | Optional redirect to 443 |
| **5001** | Internal only | HTTP | API container (Kestrel) — do **not** expose publicly; traffic should flow through the reverse proxy |

> The container's `EXPOSE 5001` directive is informational. Bind it to `127.0.0.1:5001` (or a private network) on the host and route `/api` and `/fhir` via the reverse proxy.

---

## Outbound domains to allowlist

The browser and/or the API server make outbound HTTPS requests to the following domains. Add them to your egress firewall / proxy allowlist.

### Always required

| Domain | Port | Who calls it | Purpose |
|--------|------|-------------|---------|
| `r4.smarthealthit.org` | 443 | Browser | Default SMART on FHIR R4 sandbox (standalone launch) |
| `launch.smarthealthit.org` | 443 | Browser | EHR simulator for embedded launch testing |

> **Production EHR:** If you are deploying against a real EHR, replace these with the EHR's FHIR base URL and authorization server URL (obtained from the SMART `.well-known/smart-configuration` endpoint).

### Epic on FHIR sandbox (Option E)

When testing against [Epic on FHIR](https://fhir.epic.com/), allow browser HTTPS egress to:

| Domain | Port | Who calls it | Purpose |
|--------|------|-------------|---------|
| `fhir.epic.com` | 443 | Browser | OAuth authorize/token + FHIR R4 API (`interconnect-fhir-oauth`) |

OAuth endpoints (same host): `/interconnect-fhir-oauth/oauth2/authorize`, `/interconnect-fhir-oauth/oauth2/token`.

### Optional — depends on features used

| Domain | Port | Who calls it | Purpose |
|--------|------|-------------|---------|
| `npiregistry.cms.hhs.gov` | 443 | API server (proxy) | NPPES NPI Registry lookups — provider search panel |
| `clinicaltables.nlm.nih.gov` | 443 | Browser (direct) | NLM Clinical Tables — autocomplete for clinical terms |
| `rxnav.nlm.nih.gov` | 443 | Browser (direct) | RxNorm drug information |
| `api.fda.gov` | 443 | Browser (direct) | OpenFDA drug labels and adverse events |

### Web Vitals reporting (optional)

If `VITE_VITALS_ENDPOINT` is configured, the browser will POST to that custom domain. Add it to your CSP `connect-src` directive and firewall allowlist accordingly.

---

## Content Security Policy

The API enforces the following CSP in production (`server/Program.cs`); the Vite dev server applies equivalent headers locally:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
connect-src 'self' https:;
font-src 'self' data:;
object-src 'none';
frame-ancestors 'none';
```

Key points for IT teams:

- `connect-src 'self' https:` — allows the app to call any HTTPS endpoint (external FHIR servers, NLM, FDA, NPI Registry). If you need a stricter policy, replace `https:` with an explicit domain list.
- `frame-ancestors 'none'` — prevents embedding fhirPlace in an iframe on another origin. Remove this directive only if EHR-embedded launch requires iframe embedding (some EHRs use this pattern).
- `style-src 'unsafe-inline'` — required by MUI/Emotion CSS-in-JS. This cannot be removed without replacing the UI framework.

---

## CORS

The API server allows cross-origin requests from:

```
http://localhost:5173
http://localhost:3000
```

For production, set the `ALLOWED_ORIGINS` environment variable to include your production SPA origin (comma-separated). Example:

```js
origin: ["https://fhirplace.example.com"]
```

---

## Time synchronization (NTP / SNTP)

fhirPlace does not run an in-container NTP daemon. All authoritative audit and export timestamps use the **API host** UTC clock via `GET /api/health` → `serverTimeUtc`. Clinician workstations must also keep correct time for SMART OAuth token validity.

| Environment | Guidance |
|-------------|----------|
| Linux API host | `chronyd` or `systemd-timesyncd`; verify with `timedatectl status` |
| Windows server | Windows Time service (`w32tm`); check with `w32tm /query /status` |
| Docker | Container inherits the **host** clock — sync the host, not the container |
| Cloud (Azure / AWS / GCP) | Use provider hypervisor time sync |
| Clinician browsers | Workstation OS time sync (SMART `exp` / `nbf` rely on correct client clock) |

Self-managed NTP on the API host may require outbound **UDP port 123** to your time source. Cloud VMs often sync via the hypervisor without opening UDP 123.

**Ops check:** Compare `curl http://localhost:5001/api/health` → `serverTimeUtc` with your NTP source. See [Timekeeping design system](./timekeeping-design-system.md) for application rules (server-authoritative audit time, monotonic session timeout).

---

## TLS / HTTPS requirements

| Requirement | Notes |
|---|---|
| Production API must use HTTPS | `VITE_API_BASE` must be set to an `https://` URL; the SPA throws at startup if missing or non-HTTPS (`src/lib/productionSecurity.ts`) |
| Production SPA | Must be served over HTTPS (browser `location.protocol`); localhost exempt for local preview |
| API edge | Reverse proxy / Fly.io terminates TLS; Kestrel listens on HTTP internally with `X-Forwarded-Proto` |
| API HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` on HTTPS responses in Production |
| Cleartext API requests | Production returns 403 except `GET /api/health` (container health probes) |
| Redirect URI must match registration | The OAuth callback URL must exactly match what is registered with the EHR |
| Self-signed certificates | Not supported in production; the `fhirclient` library performs standard TLS validation |
| Minimum TLS version | TLS 1.2+ at the edge proxy / load balancer (Fly.io, nginx, CDN) |
| CI guard | `npm run check:tls` — no hardcoded `http://localhost:5001` in `src/` (excluding tests) |
