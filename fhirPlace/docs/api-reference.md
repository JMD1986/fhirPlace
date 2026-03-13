# API Reference

All requests are made against the Express API server (default `http://localhost:5001`).  
Every FHIR search endpoint returns a **FHIR R4 `Bundle` of type `searchset`**.  
Individual-resource endpoints return the raw FHIR JSON object.

**Content-Type returned:** `application/fhir+json; charset=utf-8`

---

## Utility endpoints

### `GET /api/health`

Returns the server status and basic cache statistics.

**Response**

```json
{
  "status": "ok",
  "patients": 150,
  "encounters": 4823
}
```

---

### `GET /`

Returns a plain-text startup message confirming the server is running.

---

## Patient endpoints

### `GET /api/patients`

Returns a lightweight summary list (id + display name). Intended for the legacy search dropdown.

| Query param | Type | Default | Description |
|---|---|---|---|
| `name` | string | — | Case-insensitive substring match against full name |
| `_count` | integer | 10 | Maximum results to return |

**Response** — array of summary objects

```json
[
  { "id": "abc-123", "name": "John Smith" }
]
```

---

### `GET /api/patients/:id`

Returns the full Synthea FHIR Transaction Bundle for one patient (all resource types).

| Path param | Description |
|---|---|
| `id` | Patient UUID |

---

### `GET /api/patients-count`

Returns the total number of loaded patients.

**Response**

```json
{ "count": 150 }
```

---

## FHIR R4 endpoints

### Patient

#### `GET /fhir/Patient`

Search for patients using FHIR search parameters.

| Query param | Type | Description |
|---|---|---|
| `name` | string | Matches family name, given name, or full display name (case-insensitive) |
| `family` | string | Family (last) name |
| `given` | string | Given (first) name |
| `gender` | string | `male`, `female`, `other`, `unknown` |
| `birthdate` | string | ISO date, e.g. `1985-03-20` |
| `identifier` | string | MRN or other identifier value |
| `_count` | integer | Page size (default 20, max 200) |
| `_offset` | integer | Pagination offset (default 0) |

**Example**

```
GET /fhir/Patient?family=smith&gender=female&_count=5
```

---

#### `GET /fhir/Patient/:id`

Returns a single FHIR `Patient` resource.

---

### Encounter

#### `GET /fhir/Encounter`

Search encounters. At least one of `patient`, `date`, `status`, `type`, or `class` should be provided for efficient results; omitting all parameters returns every encounter.

| Query param | Type | Description |
|---|---|---|
| `patient` | string | Patient UUID or `Patient/<uuid>` reference |
| `status` | string | FHIR encounter status (e.g. `finished`, `in-progress`) |
| `class` | string | Encounter class code (e.g. `AMB`, `IMP`) |
| `type` | string | Encounter type description (substring match) |
| `date` | string | ISO date or range (e.g. `ge2020-01-01`, `le2022-12-31`) |
| `_count` | integer | Page size (default 20, max 500) |
| `_offset` | integer | Pagination offset (default 0) |

---

#### `GET /fhir/Encounter/_types`

Returns a deduplicated list of all encounter type strings in the dataset. Useful for populating filter dropdowns.

**Response** — `string[]`

---

#### `GET /fhir/Encounter/_classes`

Returns a deduplicated list of all encounter class codes.

**Response** — `string[]`

---

#### `GET /fhir/Encounter/:id`

Returns a single FHIR `Encounter` resource.

---

### DocumentReference

#### `GET /fhir/DocumentReference`

| Query param | Description |
|---|---|
| `encounter` | Encounter UUID or `Encounter/<uuid>` |
| `patient` | Patient UUID or `Patient/<uuid>` |
| `_id` | DocumentReference UUID (exact) |
| `_count` / `_offset` | Pagination |

#### `GET /fhir/DocumentReference/:id`

---

### Condition

#### `GET /fhir/Condition`

| Query param | Description |
|---|---|
| `encounter` | Filter by encounter |
| `patient` | Filter by patient |
| `_id` | Exact ID |
| `_count` / `_offset` | Pagination |

#### `GET /fhir/Condition/:id`

---

### DiagnosticReport

#### `GET /fhir/DiagnosticReport`

| Query param | Description |
|---|---|
| `encounter` | Filter by encounter |
| `patient` | Filter by patient |
| `_id` | Exact ID |
| `_count` / `_offset` | Pagination |

#### `GET /fhir/DiagnosticReport/:id`

---

### Immunization

#### `GET /fhir/Immunization`

| Query param | Description |
|---|---|
| `encounter` | Filter by encounter |
| `patient` | Filter by patient |
| `_id` | Exact ID |
| `_count` / `_offset` | Pagination |

#### `GET /fhir/Immunization/:id`

---

### Procedure

#### `GET /fhir/Procedure`

| Query param | Description |
|---|---|
| `encounter` | Filter by encounter |
| `patient` | Filter by patient |
| `_id` | Exact ID |
| `_count` / `_offset` | Pagination |

#### `GET /fhir/Procedure/:id`

---

### Observation

#### `GET /fhir/Observation`

| Query param | Description |
|---|---|
| `encounter` | Filter by encounter |
| `patient` | Filter by patient |
| `_id` | Exact ID |
| `code` | LOINC code or display text (exact match) |
| `_count` | Page size (default 500, max 2000) |
| `_offset` | Pagination offset |

#### `GET /fhir/Observation/:id`

---

### MedicationRequest

#### `GET /fhir/MedicationRequest`

| Query param | Description |
|---|---|
| `encounter` | Filter by encounter |
| `patient` | Filter by patient |
| `_id` | Exact ID |
| `_count` | Page size (default 50, max 500) |
| `_offset` | Pagination offset |

#### `GET /fhir/MedicationRequest/:id`

---

### Claim

#### `GET /fhir/Claim`

| Query param | Description |
|---|---|
| `encounter` | Filter by encounter (matches items' encounter references) |
| `patient` | Filter by patient |
| `_id` | Exact ID |
| `_count` / `_offset` | Pagination |

#### `GET /fhir/Claim/:id`

---

### ExplanationOfBenefit

#### `GET /fhir/ExplanationOfBenefit`

| Query param | Description |
|---|---|
| `encounter` | Filter by linked encounter (via Claim) |
| `patient` | Filter by patient |
| `_id` | Exact ID |
| `_count` / `_offset` | Pagination |

#### `GET /fhir/ExplanationOfBenefit/:id`

---

## Proxy endpoints

### `GET /api/nppes`

Proxies requests to the [NPI Registry API](https://npiregistry.cms.hhs.gov/api-page) (CMS NPPES). The registry does not send CORS headers, so browser requests would be blocked; this route forwards any query parameters server-to-server.

**Example**

```
GET /api/nppes?number=1234567890&enumeration_type=NPI-1&version=2.1
```

All query parameters are forwarded verbatim to `https://npiregistry.cms.hhs.gov/api/`.

---

## Error responses

| HTTP status | Meaning |
|---|---|
| `404` | Resource not found |
| `503` | Server cache is still initialising; retry after a few seconds |
| `502` | Upstream proxy error (NPPES) |

Error body:

```json
{ "error": "Human-readable message" }
```

---

## FHIR resource types used

The following FHIR R4 resource types are indexed and searchable:

| Resource type | Searchable by |
|---|---|
| `Patient` | name, family, given, gender, birthdate, identifier |
| `Encounter` | patient, status, class, type, date |
| `Condition` | encounter, patient |
| `DiagnosticReport` | encounter, patient |
| `DocumentReference` | encounter, patient |
| `Immunization` | encounter, patient |
| `MedicationRequest` | encounter, patient |
| `Observation` | encounter, patient, LOINC code |
| `Procedure` | encounter, patient |
| `Claim` | encounter, patient |
| `ExplanationOfBenefit` | encounter, patient |

### Required scopes (SMART on FHIR)

When connecting to a live EHR the application requests these OAuth 2.0 scopes:

```
launch openid fhirUser
patient/Patient.read
patient/Encounter.read
patient/Condition.read
patient/DiagnosticReport.read
patient/DocumentReference.read
patient/Immunization.read
patient/MedicationRequest.read
patient/Observation.read
patient/Procedure.read
patient/Claim.read
patient/ExplanationOfBenefit.read
```

> **Note:** The bundled local server does **not** require SMART authentication — it serves synthetic data only. Scopes are required only when `VITE_SMART_ISS` points to a real EHR.
