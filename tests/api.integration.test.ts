// @vitest-environment node
/**
 * Integration tests for the fhirPlace C# API.
 *
 * These tests hit the REAL server — requires `docker compose up -d` first.
 * Run with:  npm run test:integration
 *
 * They are kept out of src/ so the regular `npm test` (unit tests) doesn't
 * require a running server. vite.config.ts includes 'tests/**' so vitest
 * picks them up when explicitly invoked.
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.API_BASE ?? "http://localhost:5001";

// Resolved from seeded Synthea data at runtime (IDs vary per dataset).
let KNOWN_PATIENT_ID = "";
let KNOWN_ENCOUNTER_ID = "";
let KNOWN_FAMILY = "";

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json() };
}

// ── Pre-flight: skip all tests if the server isn't up ────────────────────────
beforeAll(async () => {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Health check ${res.status}`);
  } catch {
    throw new Error(
      `\n\nServer not reachable at ${BASE}.\nRun: docker compose up -d\n`
    );
  }

  const patients = (await get("/api/patients")).body as Array<{
    id: string;
    family: string;
  }>;
  if (!patients.length) {
    throw new Error(
      "\n\nNo patients in DB. Generate Synthea data:\n" +
        "  npm run synthea:setup && npm run synthea:run -- -p 20 -o public/synthea/fhir\n" +
        "Then restart the API server.\n",
    );
  }
  KNOWN_PATIENT_ID = patients[0].id;
  KNOWN_FAMILY = patients[0].family;

  const encounters = (
    await get(`/fhir/Encounter?patient=${KNOWN_PATIENT_ID}&_count=1`)
  ).body as { entry?: Array<{ resource: { id: string } }> };
  KNOWN_ENCOUNTER_ID = encounters.entry?.[0]?.resource.id ?? "";
  if (!KNOWN_ENCOUNTER_ID) {
    throw new Error(`No encounters found for patient ${KNOWN_PATIENT_ID}`);
  }
});

// ── /api/health ───────────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  it("returns { status: 'ok' } and authoritative serverTimeUtc", async () => {
    const { status, body } = await get("/api/health");
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(typeof body.serverTimeUtc).toBe("string");
    expect(Number.isNaN(Date.parse(body.serverTimeUtc as string))).toBe(false);
    expect(body.serverTimeUtc as string).toMatch(/Z$/);
  });
});

// ── /api/patients-count ────────────────────────────────────────────────────────
describe("GET /api/patients-count", () => {
  it("returns a positive count", async () => {
    const { status, body } = await get("/api/patients-count");
    expect(status).toBe(200);
    expect(body.count).toBeGreaterThan(0);
  });
});

// ── /api/patients ─────────────────────────────────────────────────────────────
describe("GET /api/patients", () => {
  it("returns all patients when no filter", async () => {
    const { status, body } = await get("/api/patients");
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toMatchObject({ resourceType: "Patient" });
  });

  it("filters by family name", async () => {
    const { status, body } = await get(`/api/patients?family=${encodeURIComponent(KNOWN_FAMILY)}`);
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(
      body.every((p: { family: string }) => p.family.includes(KNOWN_FAMILY)),
    ).toBe(true);
  });

  it("filters by gender", async () => {
    const { body } = await get("/api/patients?gender=male");
    expect(body.every((p: { gender: string }) => p.gender === "male")).toBe(true);
  });

  it("returns empty array for non-existent name", async () => {
    const { status, body } = await get("/api/patients?family=ZZZNOTEXIST");
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});

// ── /api/patients/:id ─────────────────────────────────────────────────────────
describe("GET /api/patients/:id", () => {
  it("returns the full FHIR Bundle for a known patient", async () => {
    const { status, body } = await get(`/api/patients/${KNOWN_PATIENT_ID}`);
    expect(status).toBe(200);
    expect(body.resourceType).toBe("Bundle");
    expect(body.entry).toBeDefined();
  });

  it("returns 404 for unknown id", async () => {
    const { status, body } = await get("/api/patients/not-a-real-id");
    expect(status).toBe(404);
    expect(body.error).toBeDefined();
  });
});

// ── /fhir/Patient ─────────────────────────────────────────────────────────────
describe("GET /fhir/Patient", () => {
  it("returns a FHIR searchset Bundle", async () => {
    const { status, body } = await get("/fhir/Patient?_count=5");
    expect(status).toBe(200);
    expect(body.resourceType).toBe("Bundle");
    expect(body.type).toBe("searchset");
    expect(body.total).toBeGreaterThan(0);
    expect(Array.isArray(body.entry)).toBe(true);
    expect(body.entry.length).toBeLessThanOrEqual(5);
  });

  it("paginates with _count and _offset", async () => {
    const page1 = (await get("/fhir/Patient?_count=3&_offset=0")).body;
    const page2 = (await get("/fhir/Patient?_count=3&_offset=3")).body;
    const ids1 = page1.entry.map((e: { resource: { id: string } }) => e.resource.id);
    const ids2 = page2.entry.map((e: { resource: { id: string } }) => e.resource.id);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
  });

  it("filters by _id (known patient)", async () => {
    const { body } = await get(`/fhir/Patient?_id=${KNOWN_PATIENT_ID}`);
    expect(body.total).toBe(1);
    expect(body.entry[0].resource.id).toBe(KNOWN_PATIENT_ID);
  });

  it("includes a next link when more results exist", async () => {
    const { body } = await get("/fhir/Patient?_count=1");
    const next = body.link?.find((l: { relation: string }) => l.relation === "next");
    expect(next).toBeDefined();
  });
});

// ── /fhir/Patient/:id ────────────────────────────────────────────────────────
describe("GET /fhir/Patient/:id", () => {
  it("returns the FHIR Patient resource", async () => {
    const { status, body } = await get(`/fhir/Patient/${KNOWN_PATIENT_ID}`);
    expect(status).toBe(200);
    expect(body.resourceType).toBe("Patient");
    expect(body.id).toBe(KNOWN_PATIENT_ID);
  });

  it("returns 404 for unknown id", async () => {
    const { status } = await get("/fhir/Patient/unknown-id-xyz");
    expect(status).toBe(404);
  });
});

// ── /fhir/Encounter ──────────────────────────────────────────────────────────
describe("GET /fhir/Encounter", () => {
  it("filters by patient", async () => {
    const { body } = await get(`/fhir/Encounter?patient=${KNOWN_PATIENT_ID}&_count=5`);
    expect(body.resourceType).toBe("Bundle");
    expect(body.total).toBeGreaterThan(0);
  });

  it("filters by _id (known encounter)", async () => {
    const { body } = await get(`/fhir/Encounter?_id=${KNOWN_ENCOUNTER_ID}`);
    expect(body.total).toBe(1);
    expect(body.entry[0].resource.id).toBe(KNOWN_ENCOUNTER_ID);
  });
});

// ── /fhir/:resourceType (generic) ────────────────────────────────────────────
describe("Generic FHIR resource endpoints", () => {
  const types = ["Condition", "Observation", "Procedure", "MedicationRequest", "Immunization"];

  for (const rt of types) {
    it(`GET /fhir/${rt}?patient=... returns a Bundle`, async () => {
      const { status, body } = await get(`/fhir/${rt}?patient=${KNOWN_PATIENT_ID}&_count=3`);
      expect(status).toBe(200);
      expect(body.resourceType).toBe("Bundle");
      expect(body.type).toBe("searchset");
    });
  }
});
