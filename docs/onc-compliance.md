# ONC Certification Criteria — fhirPlace Compliance Documentation

This document addresses each of the ONC Health IT Certification criteria required by Epic's App Orchard for third-party application submissions, per [Epic's Developer Terms](https://open.epic.com/Home/DeveloperTerms).

For each criterion, fhirPlace provides one of:
1. Evidence of **equivalent functionality** implemented in the application
2. Documentation of why the criterion is **not applicable**

---

## §170.315(b)(6) — Data Export

**Status: Implemented**

fhirPlace supports CCD (Continuity of Care Document) export in C-CDA XML format. Users can export a complete clinical summary for any patient, which includes:

- Patient demographics
- Conditions / Problem list
- Medications (MedicationRequest)
- Observations (vital signs, lab results)
- Procedures
- Immunizations
- Encounters

The export is generated server-side by `CcdGenerator.cs`, which assembles FHIR resources into a valid C-CDA document. The resulting XML includes a reference to `CDA.xsl` for browser-based rendering. Export is triggered from the Patient View via a download button.

---

## §170.315(d)(1) — Authentication, Access Control, Authorization

**Status: Satisfied (delegated to EHR)**

fhirPlace uses **SMART on FHIR** with OAuth 2.0 for authentication and authorization:

- **Identity verification**: The EHR (Epic) authenticates the user via its own identity provider. fhirPlace receives identity claims via the OIDC `id_token` (name, email, fhirUser reference).
- **Unique identifier**: Each user is identified by their `sub` claim or `email` from the id_token, used as a stable per-user key throughout the application.
- **Access control**: fhirPlace requests specific OAuth scopes (`openid fhirUser patient/*.read`) and operates strictly within the permissions granted by the EHR's authorization server.
- **Role determination**: The application distinguishes between `patient` and `provider` roles based on whether a patient context is supplied in the launch.

The SMART on FHIR launch flow is implemented in `AuthContext.tsx` using the `fhirclient` library. See `docs/architecture.md` for the full authentication flow.

---

## §170.315(d)(2) — Auditable Events and Tamper-Resistance

**Status: Implemented**

fhirPlace maintains a server-side audit log that records all actions on Electronic Health Information (EHI):

- **Who**: User identity (userId, userName, userRole) captured from the authenticated SMART session and sent via custom headers on every API request.
- **What**: Action type (read, search, login, logout, disclosure, export), resource type, resource ID, HTTP method, request path, and query parameters.
- **When**: Server-generated UTC timestamp for each event.

**Tamper-resistance**: Each audit log entry includes an integrity hash computed from the event data and the previous entry's hash, forming a hash chain. Any modification to a historical entry breaks the chain, which can be detected via the `/api/audit/verify` endpoint.

Audit events are stored in the application database via `AuditService.cs`. The audit log captures:
- All FHIR resource access (reads, searches)
- Authentication events (login, logout, session timeout)
- Data disclosures (CCD export downloads)
- Audit log status changes

---

## §170.315(d)(3) — Audit Report(s)

**Status: Implemented**

fhirPlace provides an audit report interface at `/audit` (`AuditLogPage.tsx`) that allows authorized users to:

- **Query by time period**: Filter audit events by start date and end date
- **Filter by criteria**: Filter by user, action type, resource type, and patient ID
- **Sort entries**: Sort by any column (timestamp, user, action, resource, outcome)
- **View details**: Expand individual entries to see full event details including request path, query string, and integrity hash
- **Verify integrity**: Run a chain verification to confirm no audit records have been tampered with
- **View statistics**: Summary counts by action type, user, and time period

---

## §170.315(d)(5) — Automatic Access Time-out

**Status: Implemented**

fhirPlace automatically terminates user sessions after **15 minutes** of inactivity:

- **Activity tracking**: The `useInactivityTimeout` hook monitors `mousedown`, `keydown`, `touchstart`, and `scroll` events on the document.
- **Warning**: A dialog appears at **2 minutes remaining**, showing a live countdown and offering "Stay logged in" or "Log out" options.
- **Timeout behavior**: If the user does not respond, the session is terminated — OAuth tokens are cleared from memory, SMART sessionStorage entries are scrubbed, and the user must re-authenticate via the EHR to resume.
- **Audit logging**: Timeout events are recorded as `"Session timed out due to inactivity"` in the audit log.
- **During warning**: Incidental mouse/keyboard activity does not reset the timer — the user must explicitly click "Stay logged in" to continue.

Implementation: `src/hooks/useInactivityTimeout.ts`, `src/Components/Auth/SessionTimeoutWarning.tsx`, integrated in `src/context/AuthContext.tsx`.

---

## §170.315(d)(7) — End-User Device Encryption

**Status: Not applicable — no EHI stored locally**

fhirPlace does not persist any Electronic Health Information (EHI) on end-user devices. All clinical data is fetched on demand via FHIR API over TLS and held exclusively in JavaScript memory (React component state). When the user navigates away or the session ends, all clinical data is discarded.

**Storage audit results:**

| Storage mechanism | Usage | Contains EHI? |
|---|---|---|
| `sessionStorage` | OAuth PKCE state during SMART handshake — immediately scrubbed after `ready()` resolves via `scrubFhirClientState()` | No |
| `localStorage` | `fhirPlace_lastSearchType` — stores "patient" or "encounter" string | No |
| `localStorage` | `fhirPlace_savedSearches_<email>` — user-authored search query templates (name fragments, date ranges) — not server-fetched patient records | No |
| `IndexedDB` | Not used | N/A |
| `Cache API` | Not used | N/A |

No patient records, clinical data, diagnosis codes, medications, or other server-fetched EHI are ever written to any persistent browser storage.

---

## §170.315(d)(8) — Integrity

**Status: Satisfied**

fhirPlace ensures data integrity through two mechanisms:

1. **Transport integrity**: All FHIR API communication uses HTTPS/TLS 1.2+, which provides cryptographic integrity verification of data in transit. Any modification during transport would be detected by TLS and the connection terminated.

2. **Data versioning**: FHIR resources include `meta.versionId` and `meta.lastUpdated` fields maintained by the EHR server, enabling detection of any modifications to the source data.

fhirPlace operates in **read-only mode** — it does not modify, transform, calculate, or derive clinical values from received health information. Data is displayed as-received from the EHR's FHIR API.

---

## §170.315(d)(9) — Trusted Connection

**Status: Satisfied**

All data exchange in fhirPlace occurs over encrypted, integrity-protected connections:

- **FHIR API calls**: All requests to the EHR's FHIR server use HTTPS/TLS 1.2+
- **OAuth flow**: The SMART on FHIR authorization flow requires TLS — Epic's authorization endpoints reject non-HTTPS requests
- **Production deployment**: fhirPlace is deployed behind TLS termination (Fly.io), ensuring all client-to-server traffic is encrypted end-to-end
- **No plaintext fallback**: The application does not support or fall back to unencrypted HTTP connections in production

---

## §170.315(d)(11) — Accounting of Disclosures

**Status: Implemented**

fhirPlace records all disclosures of patient health information. The only disclosure mechanism is **CCD document export** — each download triggers an audit event with:

- Action: `"disclosure"`
- Resource type: `Patient`
- Patient ID of the exported record
- Request path
- User identity (who initiated the download)
- Timestamp

fhirPlace does not share patient data with any third parties. There is no printing, clipboard copy, email, or external sharing functionality. All other interactions are view-only within the authenticated user's browser session and do not constitute disclosures under HIPAA's accounting requirements.

Implementation: `src/api/fhirApi.ts` (`downloadCcd` function) logs via `logAuditEvent()`.

---

## §170.315(g)(3) — Safety-Enhanced Design

**Status: Documented**

fhirPlace applies user-centered design (UCD) principles throughout development:

### Clinical Workflow Analysis
- Designed around real clinical workflows: patient lookup, encounter review, clinical data browsing, and document export
- Navigation mirrors how clinicians think — patient-first, then drill into encounters, conditions, medications, observations, and procedures
- SMART on FHIR EHR launch provides seamless context handoff so the clinician doesn't re-enter patient context

### Design Standards
- Built on Material UI (MUI), which implements Material Design accessibility and usability guidelines
- Consistent component patterns (search forms, data tables, detail views) reduce cognitive load
- Responsive layout supports desktop and tablet workflows at the point of care

### Safety-Specific Design Decisions
- **Read-only architecture** — fhirPlace cannot modify patient records, eliminating write-related safety risks
- **Session timeout** (15-minute inactivity auto-logout) with a 2-minute warning prevents unauthorized access at unattended workstations
- **No local PHI storage** — data is fetched on demand and held only in memory, reducing exposure from lost/stolen devices
- **Error boundaries** on every route prevent a rendering failure in one view from crashing the entire application

### Risk Mitigations
- Clinical data is displayed as-received from the EHR — fhirPlace does not transform, calculate, or derive clinical values, avoiding interpretation errors
- All data views include resource metadata (dates, status, source) so clinicians can assess data currency

### Iterative Feedback
- GitHub Issues used for defect tracking and feature requests
- Automated test suite validates expected behavior across components

---

## §170.315(g)(4) — Quality Management System

**Status: Documented**

fhirPlace uses the following quality management processes:

### Defect Tracking
- GitHub Issues for bug reports, feature requests, and task tracking
- Pull request workflow with code review before merge to `master`

### Testing
- Automated integration test suite (`tests/api.integration.test.ts`)
- TypeScript strict mode for compile-time type safety
- ESLint for code quality and consistency

### Release Management
- Git-based version control with feature branches
- CI/CD pipeline for build verification
- Docker containerization for consistent deployment environments
- Fly.io deployment with health checks

### Configuration Management
- Environment variables for all deployment-specific settings (documented in `docs/environment-variables.md`)
- Sensitive values (API keys, client secrets) excluded from source control via `.gitignore`

---

## §170.315(g)(5) — Accessibility-Centered Design

**Status: Documented**

fhirPlace targets **WCAG 2.1 Level AA** compliance and **Section 508** of the Rehabilitation Act.

### Standards Applied
- **WCAG 2.1 AA** — Web Content Accessibility Guidelines
- **Section 508** — Federal accessibility requirements
- **WAI-ARIA** — Accessible Rich Internet Applications specification

### Implementation
- Built on **Material UI (MUI)**, which provides built-in accessibility features including proper ARIA attributes, keyboard navigation, focus management, and screen reader support
- Semantic HTML elements used throughout (headings, lists, tables, landmarks)
- Color contrast ratios meet WCAG AA thresholds via the MUI theme system
- All interactive elements are keyboard-accessible
- Form inputs include associated labels

### Accessibility Toolchain
- **eslint-plugin-jsx-a11y**: Lints JSX for accessibility issues at development time
- **jest-axe**: Automated accessibility tests for React components
- **@axe-core/react**: Live accessibility violation logging in the browser during development
- **pa11y-ci**: Automated accessibility CI checks on key routes (`/`, `/patient/:id`, `/audit`)
- **Lighthouse**: Manual and automated accessibility audits for overall conformance

### WCAG 2.1 AA Criteria Addressed
- 1.1.1 Non-text Content: All icons/images have `alt` text or are decorative
- 1.3.1 Info and Relationships: Semantic HTML, ARIA roles, table headers
- 1.3.2 Meaningful Sequence: DOM order matches visual order
- 1.4.3 Contrast (Minimum): All text and UI elements meet 4.5:1/3:1 contrast
- 2.1.1 Keyboard: All functionality is keyboard accessible
- 2.4.1 Bypass Blocks: Skip-to-main-content link
- 2.4.3 Focus Order: Focus managed on route change
- 2.4.4 Link Purpose: All links have clear, descriptive text
- 2.4.7 Focus Visible: Custom focus indicator styles
- 3.3.2 Labels or Instructions: All form fields have accessible labels
- 4.1.2 Name, Role, Value: Proper ARIA labeling for dialogs, widgets
- 4.1.3 Status Messages: Live regions for route changes and loading states

### Known Gaps / Exceptions
- Some dynamic content (e.g., custom modals, tables) may require further manual ARIA review
- Automated tools may not catch all color contrast issues in custom-styled components
- Accessibility is an ongoing process; user feedback and periodic audits are used to identify and address new issues

---

## §170.315(g)(7) — Application Access: Patient Selection

**Status: Satisfied**

fhirPlace supports patient identification and selection through two mechanisms:

1. **SMART on FHIR launch context**: When launched from an EHR, fhirPlace receives a patient ID in the OAuth launch context. This ID is used as the token for all subsequent FHIR data requests for that patient.

2. **Patient search**: The `usePatientSearch` hook and SearchContainer UI allow searching patients by:
   - Name (family, given)
   - Date of birth
   - Gender
   - Phone number
   - Address
   - Identifier

Search returns matching Patient resources with unique FHIR IDs that serve as tokens for subsequent data category requests.

---

## §170.315(g)(8) — Application Access: Data Category Request

**Status: Satisfied**

fhirPlace retrieves and displays individual FHIR resource categories corresponding to the Common Clinical Data Set (CCDS):

| CCDS Category | FHIR Resource | fhirPlace Support |
|---|---|---|
| Patient demographics | Patient | `patientApi.get()` |
| Encounters | Encounter | `encounterApi.search()` |
| Problems / Conditions | Condition | `conditionApi.search()` |
| Medications | MedicationRequest | `medicationRequestApi.search()` |
| Lab results / Vitals | Observation | `observationApi.search()` |
| Procedures | Procedure | `procedureApi.search()` |
| Immunizations | Immunization | `immunizationApi.search()` |
| Clinical notes | DocumentReference | `documentReferenceApi.search()` |
| Diagnostic reports | DiagnosticReport | `diagReportApi.search()` |
| Insurance / Claims | Claim, ExplanationOfBenefit | `claimApi`, `eobApi` |

All data is returned in computable FHIR JSON format via the centralized API client (`src/api/fhirApi.ts`).

---

## §170.315(g)(9) — Application Access: All Data Request

**Status: Implemented**

fhirPlace supports returning all CCDS categories at once via **CCD export** (`/api/patients/{id}/ccd`). This endpoint:

1. Retrieves all clinical data categories for the specified patient (demographics, conditions, medications, observations, procedures, immunizations, encounters)
2. Assembles them into a single **C-CDA (CCD)** XML document
3. Returns the complete document for download

This provides equivalent functionality to a FHIR `$everything` operation, formatted as a standards-compliant CCD document. See §170.315(b)(6) above.

---

## §170.523(k)(1) — Pricing Transparency

**Status: Documented**

fhirPlace is **free and open-source software**. There are no costs associated with:

- Licensing or subscription fees
- Implementation or integration services
- Per-user or per-transaction charges
- Maintenance or support contracts

The source code is available on GitHub. Organizations deploying fhirPlace are responsible for their own hosting infrastructure costs.

---

## §170.523(n) — Complaint Process

**Status: Documented**

### Submitting Complaints
Users and organizations may submit complaints or concerns regarding fhirPlace through:

- **GitHub Issues**: File an issue at the project's GitHub repository with the label `complaint`
- **Email**: Contact the development team at the email address listed in the repository README

### Complaint Handling
- All complaints are acknowledged within 5 business days
- Complaints are tracked in the GitHub Issues system with resolution status
- A quarterly summary of complaints is compiled and available for ONC reporting

### Quarterly Reporting
Complaint reports are compiled at the end of each calendar quarter and include:
- Total number of complaints received
- Categories of complaints
- Resolution status and actions taken
- Trends and systemic issues identified
