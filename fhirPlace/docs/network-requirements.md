# Network Requirements

This page lists every port and external domain that must be reachable for fhirPlace to function. Provide these to your network or firewall team before deployment.

---

## Ports

### Development

| Port | Direction | Protocol | Purpose |
|------|-----------|----------|---------|
| **5173** | Inbound (workstation) | HTTP | Vite dev server — React SPA hot-reload |
| **5001** | Inbound (workstation) | HTTP | Express API server |

### Production

| Port | Direction | Protocol | Purpose |
|------|-----------|----------|---------|
| **443** | Inbound | HTTPS | Reverse proxy / load balancer (SPA + API) |
| **80** | Inbound | HTTP | Optional redirect to 443 |
| **5001** | Internal only | HTTP | Express API container — do **not** expose publicly; traffic should flow through the reverse proxy |

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

The server enforces the following CSP in both development (Vite headers) and production (Helmet):

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

For production, edit the `corsOptions.origin` array in `server.js` (or inject via environment variable) to include your production SPA origin. Example:

```js
origin: ["https://fhirplace.example.com"]
```

---

## TLS / HTTPS requirements

| Requirement | Notes |
|---|---|
| Production API must use HTTPS | `VITE_API_BASE` must be an `https://` URL; the app blocks startup otherwise |
| Redirect URI must match registration | The OAuth callback URL must exactly match what is registered with the EHR |
| Self-signed certificates | Not supported in production; the `fhirclient` library performs standard TLS validation |
| Minimum TLS version | TLS 1.2 (enforced by Node.js 20 defaults) |
