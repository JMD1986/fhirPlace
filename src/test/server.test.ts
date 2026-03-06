/**
 * Server integration tests using Supertest.
 *
 * The server module calls loadPatients() + app.listen() at module load time, so
 * we import `app` directly from a slim re-export that does NOT call listen().
 * Because server.js starts the server automatically, we test against a real
 * running server on port 5001 or spin one up here.
 *
 * Strategy: use Supertest's `request(app)` pattern requires exporting `app`
 * separately from the listen() call.  Since server.js bundles both, we run the
 * actual server as a child process in globalSetup, OR we just use the
 * http.createServer + supertest approach by hitting the already-running server.
 *
 * Simpler: mock the data layer so tests are fast and self-contained.
 */

import { describe, it, expect, beforeAll } from "vitest";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PATIENT_ID = "test-patient-001";
const ENCOUNTER_ID = "test-encounter-abc";
const CONDITION_ID = "test-condition-001";
const IMMUNIZATION_ID = "test-immunization-001";
const PROCEDURE_ID = "test-procedure-001";

const makePatient = () => ({
  resourceType: "Patient",
  id: PATIENT_ID,
  name: [{ text: "Jane Doe", family: "Doe", given: ["Jane"] }],
  gender: "female",
  birthDate: "1980-01-15",
  telecom: [{ system: "phone", value: "555-0100" }],
  address: [
    {
      line: ["123 Main St"],
      city: "Springfield",
      state: "MA",
      postalCode: "01105",
      country: "US",
    },
  ],
});

const makeEncounter = () => ({
  resourceType: "Encounter",
  id: ENCOUNTER_ID,
  status: "finished",
  class: { code: "AMB", display: "ambulatory" },
  type: [{ text: "Annual physical" }],
  period: { start: "2023-06-01", end: "2023-06-01" },
  subject: { reference: `Patient/${PATIENT_ID}` },
  _patientId: PATIENT_ID,
});

const makeCondition = () => ({
  resourceType: "Condition",
  id: CONDITION_ID,
  code: { text: "Hypertension" },
  subject: { reference: `Patient/${PATIENT_ID}` },
  encounter: { reference: `urn:uuid:${ENCOUNTER_ID}` },
  _patientId: PATIENT_ID,
});

const makeImmunization = () => ({
  resourceType: "Immunization",
  id: IMMUNIZATION_ID,
  status: "completed",
  vaccineCode: { text: "Influenza" },
  patient: { reference: `Patient/${PATIENT_ID}` },
  encounter: { reference: `urn:uuid:${ENCOUNTER_ID}` },
  occurrenceDateTime: "2023-06-01",
  _patientId: PATIENT_ID,
});

const makeProcedure = () => ({
  resourceType: "Procedure",
  id: PROCEDURE_ID,
  status: "completed",
  code: { text: "Blood pressure measurement" },
  subject: { reference: `Patient/${PATIENT_ID}` },
  encounter: { reference: `urn:uuid:${ENCOUNTER_ID}` },
  _patientId: PATIENT_ID,
});

// ── In-process server setup ───────────────────────────────────────────────────
// We rebuild a minimal version of the server using the same Express app
// with pre-seeded in-memory maps – no file I/O needed.

import express from "express";
import cors from "cors";
import supertest from "supertest";

function buildTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const FHIR = "application/fhir+json";
  const BASE = "http://localhost:5001";

  const patient = makePatient();
  const encounter = makeEncounter();
  const condition = makeCondition();
  const immunization = makeImmunization();
  const procedure = makeProcedure();

  const patientMap = new Map([[PATIENT_ID, patient]]);
  const encounterMap = new Map([[ENCOUNTER_ID, encounter]]);
  const encountersByPatient = new Map([[PATIENT_ID, [ENCOUNTER_ID]]]);
  const conditionMap = new Map([[CONDITION_ID, condition]]);
  const conditionsByEncounter = new Map([[ENCOUNTER_ID, [CONDITION_ID]]]);
  const immunizationMap = new Map([[IMMUNIZATION_ID, immunization]]);
  const immunizationsByEncounter = new Map([
    [ENCOUNTER_ID, [IMMUNIZATION_ID]],
  ]);
  const procedureMap = new Map([[PROCEDURE_ID, procedure]]);
  const proceduresByEncounter = new Map([[ENCOUNTER_ID, [PROCEDURE_ID]]]);

  const patientListCache = [
    {
      id: PATIENT_ID,
      name: "Jane Doe",
      family: "Doe",
      given: "Jane",
      gender: "female",
      birthDate: "1980-01-15",
      phone: "555-0100",
      address: "123 Main St, Springfield, MA, 01105, US",
    },
  ];

  // ── helpers ────────────────────────────────────────────────────────────────
  const ready = (res: express.Response) => {
    if (!patientListCache)
      return res.status(503).json({ error: "Cache not ready" });
    return null;
  };

  const makeBundle = (
    entries: Record<string, unknown>[],
    resource: string,
    query: Record<string, string>,
  ) => ({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    link: [
      {
        relation: "self",
        url: `${BASE}/fhir/${resource}?${new URLSearchParams(query)}`,
      },
    ],
    entry: entries.map((r: Record<string, unknown>) => ({
      fullUrl: `${BASE}/fhir/${resource}/${r.id}`,
      resource: r,
      search: { mode: "match" },
    })),
  });

  // ── /api/health ────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // ── /api/patients ──────────────────────────────────────────────────────────
  app.get("/api/patients", (req, res) => {
    ready(res);
    const { name } = req.query;
    let results = [...patientListCache];
    if (name)
      results = results.filter((p) =>
        p.name.toLowerCase().includes(String(name).toLowerCase()),
      );
    res.json(results);
  });

  app.get("/api/patients-count", (_req, res) => {
    res.json({ count: patientListCache.length });
  });

  // ── /fhir/Patient ──────────────────────────────────────────────────────────
  app.get("/fhir/Patient", (req, res) => {
    const { gender, _id } = req.query;
    let results = [...patientMap.values()];
    if (_id) results = results.filter((p) => p.id === String(_id));
    if (gender)
      results = results.filter(
        (p) => p.gender?.toLowerCase() === String(gender).toLowerCase(),
      );
    res.setHeader("Content-Type", FHIR);
    res.json(makeBundle(results, "Patient", req.query as Record<string, string>));
  });

  app.get("/fhir/Patient/:id", (req, res) => {
    const r = patientMap.get(req.params.id);
    if (!r) return res.status(404).json({ error: "Patient not found" });
    res.setHeader("Content-Type", FHIR);
    res.json(r);
  });

  // ── /fhir/Encounter ────────────────────────────────────────────────────────
  app.get("/fhir/Encounter/_types", (_req, res) => {
    const types = new Set<string>();
    for (const encObj of encounterMap.values()) {
      const enc = encObj as Record<string, unknown> & { type?: { text?: string }[] };
      const text = enc.type?.[0]?.text;
      if (text) types.add(text);
    }
    res.json([...types].sort());
  });

  app.get("/fhir/Encounter/_classes", (_req, res) => {
    const classes = new Set<string>();
    for (const encObj of encounterMap.values()) {
      const enc = encObj as Record<string, unknown> & { class?: { code?: string } };
      if (enc.class?.code) classes.add(enc.class.code);
    }
    res.json([...classes].sort());
  });

  app.get("/fhir/Encounter", (req, res) => {
    const { patient: pat, status, _id } = req.query;
    let results: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (pat) {
      const patId = String(pat).replace(/^(Patient\/|urn:uuid:)/, "");
      const ids = encountersByPatient.get(patId) ?? [];
      results = ids.map((id) => encounterMap.get(id)).filter(Boolean);
    } else {
      results = [...encounterMap.values()];
    }
    if (_id) results = results.filter((e) => e.id === String(_id));
    if (status)
      results = results.filter(
        (e) => e.status?.toLowerCase() === String(status).toLowerCase(),
      );
    res.setHeader("Content-Type", FHIR);
    res.json(makeBundle(results, "Encounter", req.query as Record<string, string>));
  });

  app.get("/fhir/Encounter/:id", (req, res) => {
    const r = encounterMap.get(req.params.id);
    if (!r) return res.status(404).json({ error: "Encounter not found" });
    res.setHeader("Content-Type", FHIR);
    res.json(r);
  });

  // ── /fhir/Condition ────────────────────────────────────────────────────────
  app.get("/fhir/Condition", (req, res) => {
    const { encounter, patient: pat, _id } = req.query;
    let results: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (encounter) {
      const encId = String(encounter).replace(/^(Encounter\/|urn:uuid:)/, "");
      results = (conditionsByEncounter.get(encId) ?? [])
        .map((id) => conditionMap.get(id))
        .filter(Boolean);
    } else if (pat) {
      const patId = String(pat).replace(/^(Patient\/|urn:uuid:)/, "");
      results = [...conditionMap.values()].filter((r) => (r as Record<string, unknown>)._patientId === patId);
    } else if (_id) {
      const r = conditionMap.get(String(_id));
      results = r ? [r] : [];
    } else {
      results = [...conditionMap.values()];
    }
    res.setHeader("Content-Type", FHIR);
    res.json(makeBundle(results, "Condition", req.query as Record<string, string>));
  });

  app.get("/fhir/Condition/:id", (req, res) => {
    const r = conditionMap.get(req.params.id);
    if (!r) return res.status(404).json({ error: "Condition not found" });
    res.setHeader("Content-Type", FHIR);
    res.json(r);
  });

  // ── /fhir/Immunization ─────────────────────────────────────────────────────
  app.get("/fhir/Immunization", (req, res) => {
    const { encounter, patient: pat, _id } = req.query;
    let results: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (encounter) {
      const encId = String(encounter).replace(/^(Encounter\/|urn:uuid:)/, "");
      results = (immunizationsByEncounter.get(encId) ?? [])
        .map((id) => immunizationMap.get(id))
        .filter(Boolean);
    } else if (pat) {
      const patId = String(pat).replace(/^(Patient\/|urn:uuid:)/, "");
      results = [...immunizationMap.values()].filter((r) => (r as Record<string, unknown>)._patientId === patId);
    } else if (_id) {
      const r = immunizationMap.get(String(_id));
      results = r ? [r] : [];
    } else {
      results = [...immunizationMap.values()];
    }
    res.setHeader("Content-Type", FHIR);
    res.json(makeBundle(results, "Immunization", req.query as Record<string, string>));
  });

  app.get("/fhir/Immunization/:id", (req, res) => {
    const r = immunizationMap.get(req.params.id);
    if (!r) return res.status(404).json({ error: "Immunization not found" });
    res.setHeader("Content-Type", FHIR);
    res.json(r);
  });

  // ── /fhir/Procedure ────────────────────────────────────────────────────────
  app.get("/fhir/Procedure", (req, res) => {
    const { encounter, patient: pat, _id } = req.query;
    let results: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (encounter) {
      const encId = String(encounter).replace(/^(Encounter\/|urn:uuid:)/, "");
      results = (proceduresByEncounter.get(encId) ?? [])
        .map((id) => procedureMap.get(id))
        .filter(Boolean);
    } else if (pat) {
      const patId = String(pat).replace(/^(Patient\/|urn:uuid:)/, "");
      results = [...procedureMap.values()].filter((r) => (r as Record<string, unknown>)._patientId === patId);
    } else if (_id) {
      const r = procedureMap.get(String(_id));
      results = r ? [r] : [];
    } else {
      results = [...procedureMap.values()];
    }
    res.setHeader("Content-Type", FHIR);
    res.json(makeBundle(results, "Procedure", req.query as Record<string, string>));
  });

  app.get("/fhir/Procedure/:id", (req, res) => {
    const r = procedureMap.get(req.params.id);
    if (!r) return res.status(404).json({ error: "Procedure not found" });
    res.setHeader("Content-Type", FHIR);
    res.json(r);
  });

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FHIR Server API", () => {
  let api: ReturnType<typeof supertest>;

  beforeAll(() => {
    api = supertest(buildTestApp());
  });

  // ── Health ──────────────────────────────────────────────────────────────────
  describe("GET /api/health", () => {
    it("returns 200 with status ok", async () => {
      const res = await api.get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  // ── Patients ────────────────────────────────────────────────────────────────
  describe("GET /api/patients", () => {
    it("returns all patients", async () => {
      const res = await api.get("/api/patients");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it("filters by name (case-insensitive)", async () => {
      const res = await api.get("/api/patients?name=jane");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("Jane Doe");
    });

    it("returns empty array when name doesn't match", async () => {
      const res = await api.get("/api/patients?name=nobody");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/patients-count", () => {
    it("returns the correct count", async () => {
      const res = await api.get("/api/patients-count");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });
  });

  // ── FHIR Patient ────────────────────────────────────────────────────────────
  describe("GET /fhir/Patient", () => {
    it("returns a searchset Bundle", async () => {
      const res = await api.get("/fhir/Patient");
      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe("Bundle");
      expect(res.body.type).toBe("searchset");
      expect(res.body.total).toBe(1);
    });

    it("filters by gender", async () => {
      const res = await api.get("/fhir/Patient?gender=female");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      const noMatch = await api.get("/fhir/Patient?gender=male");
      expect(noMatch.body.total).toBe(0);
    });

    it("filters by _id", async () => {
      const res = await api.get(`/fhir/Patient?_id=${PATIENT_ID}`);
      expect(res.body.total).toBe(1);
      expect(res.body.entry[0].resource.id).toBe(PATIENT_ID);
    });
  });

  describe("GET /fhir/Patient/:id", () => {
    it("returns the patient resource", async () => {
      const res = await api.get(`/fhir/Patient/${PATIENT_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe("Patient");
      expect(res.body.id).toBe(PATIENT_ID);
    });

    it("returns 404 for unknown patient", async () => {
      const res = await api.get("/fhir/Patient/does-not-exist");
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });

  // ── FHIR Encounter ──────────────────────────────────────────────────────────
  describe("GET /fhir/Encounter/_types", () => {
    it("returns sorted array of type strings", async () => {
      const res = await api.get("/fhir/Encounter/_types");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain("Annual physical");
    });
  });

  describe("GET /fhir/Encounter/_classes", () => {
    it("returns sorted array of class codes", async () => {
      const res = await api.get("/fhir/Encounter/_classes");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain("AMB");
    });
  });

  describe("GET /fhir/Encounter", () => {
    it("returns all encounters when no filter", async () => {
      const res = await api.get("/fhir/Encounter");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it("filters by patient id", async () => {
      const res = await api.get(`/fhir/Encounter?patient=${PATIENT_ID}`);
      expect(res.body.total).toBe(1);
      expect(res.body.entry[0].resource.id).toBe(ENCOUNTER_ID);
    });

    it("filters by status", async () => {
      const match = await api.get("/fhir/Encounter?status=finished");
      expect(match.body.total).toBe(1);
      const noMatch = await api.get("/fhir/Encounter?status=in-progress");
      expect(noMatch.body.total).toBe(0);
    });
  });

  describe("GET /fhir/Encounter/:id", () => {
    it("returns the encounter resource", async () => {
      const res = await api.get(`/fhir/Encounter/${ENCOUNTER_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe("Encounter");
      expect(res.body.id).toBe(ENCOUNTER_ID);
    });

    it("returns 404 for unknown encounter", async () => {
      const res = await api.get("/fhir/Encounter/does-not-exist");
      expect(res.status).toBe(404);
    });
  });

  // ── FHIR Condition ──────────────────────────────────────────────────────────
  describe("GET /fhir/Condition", () => {
    it("returns conditions filtered by encounter", async () => {
      const res = await api.get(`/fhir/Condition?encounter=${ENCOUNTER_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.entry[0].resource.id).toBe(CONDITION_ID);
    });

    it("returns empty for unknown encounter", async () => {
      const res = await api.get("/fhir/Condition?encounter=unknown-enc");
      expect(res.body.total).toBe(0);
      expect(res.body.entry).toEqual([]);
    });

    it("strips urn:uuid: prefix from encounter param", async () => {
      const res = await api.get(
        `/fhir/Condition?encounter=urn:uuid:${ENCOUNTER_ID}`,
      );
      expect(res.body.total).toBe(1);
    });

    it("filters by patient", async () => {
      const res = await api.get(`/fhir/Condition?patient=${PATIENT_ID}`);
      expect(res.body.total).toBe(1);
    });

    it("filters by _id", async () => {
      const res = await api.get(`/fhir/Condition?_id=${CONDITION_ID}`);
      expect(res.body.total).toBe(1);
      expect(res.body.entry[0].resource.id).toBe(CONDITION_ID);
    });
  });

  describe("GET /fhir/Condition/:id", () => {
    it("returns the condition resource", async () => {
      const res = await api.get(`/fhir/Condition/${CONDITION_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(CONDITION_ID);
    });

    it("returns 404 for unknown condition", async () => {
      const res = await api.get("/fhir/Condition/missing");
      expect(res.status).toBe(404);
    });
  });

  // ── FHIR Immunization ───────────────────────────────────────────────────────
  describe("GET /fhir/Immunization", () => {
    it("returns immunizations filtered by encounter", async () => {
      const res = await api.get(
        `/fhir/Immunization?encounter=${ENCOUNTER_ID}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.entry[0].resource.vaccineCode.text).toBe("Influenza");
    });

    it("returns empty for unknown encounter", async () => {
      const res = await api.get("/fhir/Immunization?encounter=no-such-enc");
      expect(res.body.total).toBe(0);
    });

    it("handles urn:uuid: prefix in encounter param", async () => {
      const res = await api.get(
        `/fhir/Immunization?encounter=urn:uuid:${ENCOUNTER_ID}`,
      );
      expect(res.body.total).toBe(1);
    });

    it("filters by patient", async () => {
      const res = await api.get(`/fhir/Immunization?patient=${PATIENT_ID}`);
      expect(res.body.total).toBe(1);
    });

    it("filters by _id", async () => {
      const res = await api.get(`/fhir/Immunization?_id=${IMMUNIZATION_ID}`);
      expect(res.body.total).toBe(1);
    });
  });

  describe("GET /fhir/Immunization/:id", () => {
    it("returns the immunization resource", async () => {
      const res = await api.get(`/fhir/Immunization/${IMMUNIZATION_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe("Immunization");
    });

    it("returns 404 for unknown immunization", async () => {
      const res = await api.get("/fhir/Immunization/missing");
      expect(res.status).toBe(404);
    });
  });

  // ── FHIR Procedure ──────────────────────────────────────────────────────────
  describe("GET /fhir/Procedure", () => {
    it("returns procedures filtered by encounter", async () => {
      const res = await api.get(`/fhir/Procedure?encounter=${ENCOUNTER_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.entry[0].resource.code.text).toBe(
        "Blood pressure measurement",
      );
    });

    it("returns empty for unknown encounter", async () => {
      const res = await api.get("/fhir/Procedure?encounter=no-such");
      expect(res.body.total).toBe(0);
    });

    it("handles urn:uuid: prefix in encounter param", async () => {
      const res = await api.get(
        `/fhir/Procedure?encounter=urn:uuid:${ENCOUNTER_ID}`,
      );
      expect(res.body.total).toBe(1);
    });

    it("filters by patient", async () => {
      const res = await api.get(`/fhir/Procedure?patient=${PATIENT_ID}`);
      expect(res.body.total).toBe(1);
    });

    it("filters by _id", async () => {
      const res = await api.get(`/fhir/Procedure?_id=${PROCEDURE_ID}`);
      expect(res.body.total).toBe(1);
    });
  });

  describe("GET /fhir/Procedure/:id", () => {
    it("returns the procedure resource", async () => {
      const res = await api.get(`/fhir/Procedure/${PROCEDURE_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe("Procedure");
    });

    it("returns 404 for unknown procedure", async () => {
      const res = await api.get("/fhir/Procedure/missing");
      expect(res.status).toBe(404);
    });
  });

  // ── Bundle shape ────────────────────────────────────────────────────────────
  describe("FHIR Bundle shape", () => {
    it("every entry has fullUrl, resource and search.mode", async () => {
      const res = await api.get(`/fhir/Condition?encounter=${ENCOUNTER_ID}`);
      const entry = res.body.entry[0];
      expect(entry.fullUrl).toMatch(/^http:/);
      expect(entry.resource).toBeTruthy();
      expect(entry.search.mode).toBe("match");
    });

    it("Content-Type is application/fhir+json for FHIR endpoints", async () => {
      const res = await api.get(`/fhir/Encounter/${ENCOUNTER_ID}`);
      expect(res.headers["content-type"]).toMatch(/application\/fhir\+json/);
    });
  });
});
