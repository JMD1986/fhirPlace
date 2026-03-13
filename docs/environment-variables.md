# Environment Variable Reference

All client-side variables **must** be prefixed with `VITE_` so Vite embeds them at build time. They are read-only at runtime — changing them requires a rebuild (or a redeploy).

Copy `.env.example` to `.env` before starting the development server:

```sh
cp .env.example .env
```

> **Security:** Never commit `.env` to source control. The file is listed in `.gitignore`. In CI/CD, inject values as encrypted secrets.

---

## Variable listing

### `VITE_API_BASE`

| Property | Value |
|---|---|
| Type | `string` (URL) |
| Required | No |
| Default | `http://localhost:5001` |
| Example (production) | `https://api.fhirplace.example.com` |

The base URL of the Express API server. All requests from `fhirApi.ts` are prepended with this value.

**Production requirement:** This value **must** use `https://` in production. The app prints a console warning and may refuse to start if it detects a non-HTTPS URL in a production build.

```dotenv
VITE_API_BASE=http://localhost:5001
```

---

### `VITE_SMART_CLIENT_ID`

| Property | Value |
|---|---|
| Type | `string` |
| Required | No |
| Default | `fhirplace-dev` |
| Example | `my-hospital-client-id` |

The OAuth 2.0 client ID registered with the target EHR or SMART sandbox. When using the public SMART Health IT sandbox (`r4.smarthealthit.org`) the default value `fhirplace-dev` is pre-registered and requires no additional setup.

For production use, register your application with your EHR vendor and replace this with the issued client ID.

```dotenv
VITE_SMART_CLIENT_ID=fhirplace-dev
```

---

### `VITE_SMART_REDIRECT_URI`

| Property | Value |
|---|---|
| Type | `string` (URL) |
| Required | No — derived from `window.location.origin` at runtime |
| Default | *(dynamically derived)* |
| Example | `https://fhirplace.example.com/callback` |

The OAuth 2.0 redirect URI sent to the authorisation server after the user authenticates. The app derives this automatically from the current `window.location.origin`, so this variable is only needed when you want to override it explicitly (e.g. when your callback path differs from `/callback`, or for certain reverse-proxy setups).

**This URI must be registered with your EHR vendor / SMART sandbox.**

```dotenv
VITE_SMART_REDIRECT_URI=http://localhost:5173/callback
```

---

### `VITE_SMART_ISS`

| Property | Value |
|---|---|
| Type | `string` (URL) |
| Required | No |
| Default | `https://r4.smarthealthit.org` |
| Example | `https://ehr.hospital.org/fhir/r4` |

The FHIR server base URL used for standalone launch. This is the "issuer" (`iss`) sent in the SMART authorisation request.

For development and testing, the public SMART Health IT R4 sandbox (`https://r4.smarthealthit.org`) requires no registration and accepts the default client ID.

> **Note:** Do **not** use `https://launch.smarthealthit.org` as `VITE_SMART_ISS` — that URL is the EHR simulator and requires a `launch` token. Use it only when testing the EHR-embedded launch flow via the simulator portal.

```dotenv
VITE_SMART_ISS=https://r4.smarthealthit.org
```

---

### `VITE_VITALS_ENDPOINT`

| Property | Value |
|---|---|
| Type | `string` (HTTPS URL) |
| Required | No |
| Default | *(none — metrics logged to console in development)* |
| Example | `https://analytics.example.com/vitals` |

An HTTPS endpoint that accepts `POST` requests with a JSON body. When set, [Web Vitals](https://web.dev/vitals/) metrics (CLS, FCP, INP, LCP, TTFB) are posted to this URL after each page load.

**Expected payload:**

```json
{
  "name":  "LCP",
  "value": 1234.56,
  "id":    "v4-abc-...",
  "delta": 1234.56
}
```

In development (when this variable is not set) metrics are written to the browser console instead.

```dotenv
VITE_VITALS_ENDPOINT=https://analytics.example.com/vitals
```

---

## Server-side variables (not VITE_)

The Express server reads the following environment variables at startup. These are **not** prefixed with `VITE_` and are never exposed to the browser.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5001` | Port the Express server listens on. Override via `PORT=8080 node server.js`. |

---

## Quick reference table

| Variable | Type | Default | Required in prod |
|---|---|---|---|
| `VITE_API_BASE` | URL string | `http://localhost:5001` | Yes — must be HTTPS |
| `VITE_SMART_CLIENT_ID` | string | `fhirplace-dev` | Yes |
| `VITE_SMART_REDIRECT_URI` | URL string | derived from origin | Recommended |
| `VITE_SMART_ISS` | URL string | `https://r4.smarthealthit.org` | Yes |
| `VITE_VITALS_ENDPOINT` | URL string | none | No |
