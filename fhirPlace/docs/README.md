# fhirPlace — Integration Guide & API Documentation

Technical documentation for hospital IT teams evaluating or deploying fhirPlace.

---

## Contents

| Document | What it covers |
|----------|---------------|
| [Architecture](./architecture.md) | System components, data flow, SMART on FHIR auth sequence, security controls |
| [API Reference](./api-reference.md) | Every HTTP endpoint, query parameters, response shapes, required FHIR scopes |
| [Environment Variables](./environment-variables.md) | All `VITE_*` variables — type, default, production requirements |
| [Network Requirements](./network-requirements.md) | Ports, outbound domains to allowlist, CSP and CORS settings |
| [Sandbox Setup](./sandbox-setup.md) | Step-by-step guide for local, SMART Health IT sandbox, and Docker testing |
| [Troubleshooting](./troubleshooting.md) | FAQ for common installation, auth, FHIR data, and Docker issues |

---

## Quick navigation by role

**I'm approving deployment** — start with [Architecture](./architecture.md) and [Network Requirements](./network-requirements.md).

**I'm integrating with our EHR** — read [API Reference](./api-reference.md) (FHIR scopes section) and [Environment Variables](./environment-variables.md).

**I'm setting up a dev or staging environment** — follow [Sandbox Setup](./sandbox-setup.md).

**Something isn't working** — check [Troubleshooting](./troubleshooting.md).
