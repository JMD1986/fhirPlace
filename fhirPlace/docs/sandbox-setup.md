# Testing Sandbox Setup

This guide explains how to run fhirPlace against freely available, no-registration FHIR servers so you can test the full SMART on FHIR authentication flow without touching real patient data or needing an EHR vendor relationship.

---

## Option A — Built-in Synthea dataset (recommended for UI development)

The fastest way to get started. No external connectivity required.

### Steps

1. **Install dependencies and generate data** (if you haven't already):

   ```sh
   npm install
   npm run synthea:setup   # downloads synthea-with-dependencies.jar
   npm run synthea:run -- -p 50   # generate 50 synthetic patients
   npm run synthea:manifest       # rebuild the manifest file
   ```

   Pre-generated patient files are already included in `public/synthea/fhir/`. You can skip the above if they are present.

2. **Start both servers:**

   ```sh
   npm run dev:all
   ```

3. **Open the app:** `http://localhost:5173`

The React app talks to the local Express server on port 5001. No SMART authentication is required — you can browse patients immediately.

---

## Option B — SMART Health IT public R4 sandbox

Uses the [SMART Health IT](https://docs.smarthealthit.org/) public sandbox. No registration needed for the default client ID (`fhirplace-dev`).

### Steps

1. Ensure `.env` contains:

   ```dotenv
   VITE_SMART_ISS=https://r4.smarthealthit.org
   VITE_SMART_CLIENT_ID=fhirplace-dev
   VITE_SMART_REDIRECT_URI=http://localhost:5173/callback
   ```

2. Start the dev server:

   ```sh
   npm run dev:all
   ```

3. Open `http://localhost:5173`, click **Sign in**, and complete the SMART authorization flow.

   - Username: any value (the sandbox accepts any credentials)
   - Password: any value

4. After redirect back to `/callback`, you are authenticated and the app fetches patient data from the remote FHIR server.

### Notes

- The SMART Health IT sandbox uses a shared, public dataset. Do not upload real patient data.
- The sandbox may return different patient IDs on each session; saved searches reference local patient IDs that may not persist across sessions.
- Rate limits may apply during periods of high usage.

---

## Option C — SMART Health IT EHR simulator (embedded launch)

Tests the EHR-embedded launch flow. A "fake" EHR provides a pre-selected patient and encounter context.

### Steps

1. Go to [launch.smarthealthit.org](https://launch.smarthealthit.org/).

2. Fill in the launch configuration:

   | Field | Value |
   |---|---|
   | **App Launch URL** | `http://localhost:5173` |
   | **FHIR Version** | `R4` |
   | **Client ID** | `fhirplace-dev` |
   | **Redirect URIs** | `http://localhost:5173/callback` |

3. Click **Launch**. The simulator opens fhirPlace in a new window with `?iss=…&launch=…` query parameters.

4. Complete the mock login. The app receives patient/encounter context from the EHR.

---

## Option D — HAPI FHIR public test server

[HAPI FHIR](https://hapi.fhir.org/) provides a public R4 server at `https://hapi.fhir.org/baseR4`. It does **not** support SMART on FHIR authentication, so it is useful only for raw FHIR API testing (e.g. with curl or Postman), not for testing the login flow.

```sh
# Example: fetch a list of Patients
curl "https://hapi.fhir.org/baseR4/Patient?_count=5&_format=json"
```

---

## Verifying the local API server

Use these curl commands to confirm the local Express server is working correctly before connecting the React app.

```sh
# Health check
curl http://localhost:5001/api/health

# List patients (first 3)
curl "http://localhost:5001/api/patients?_count=3"

# FHIR Patient search
curl "http://localhost:5001/fhir/Patient?name=smith&_count=5"

# Encounter search for a patient (replace <id> with a real UUID from the above)
curl "http://localhost:5001/fhir/Encounter?patient=<id>&_count=10"
```

---

## Running the test suite

```sh
npm run test:run        # run all unit/integration tests once
npm run test            # watch mode
npm run test:coverage   # generate a coverage report
```

Tests use [Vitest](https://vitest.dev/) with [Testing Library](https://testing-library.com/) and [MSW](https://mswjs.io/) for API mocking. No running server is needed.

---

## Docker smoke test

Verify the production Docker image starts correctly:

```sh
docker build -t fhirplace-api .
docker run --rm -p 5001:5001 fhirplace-api
curl http://localhost:5001/api/health
```

Expected response: `{"status":"ok","patients":<n>,"encounters":<n>}`

> **Note:** The Docker image contains only the API server, not the Vite-built SPA. Serve the SPA separately (e.g. from a CDN or Nginx) and point `VITE_API_BASE` at the container.
