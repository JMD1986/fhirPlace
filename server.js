import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5001;

// Configure CORS explicitly
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// ─── Cache ────────────────────────────────────────────────────────────────────
// patientListCache         – flat summary objects used by GET /api/patients (+ filters)
// patientBundleMap         – full transaction Bundles keyed by patient UUID
// patientResourceMap       – lean FHIR Patient resources keyed by UUID (for /fhir/Patient)
// encounterResourceMap     – all Encounter resources keyed by encounter UUID
// encountersByPatient      – encounter UUID[] keyed by patient UUID
// docRefResourceMap        – all DocumentReference resources keyed by docRef UUID
// docRefsByEncounter       – docRef UUID[] keyed by encounter UUID
// conditionResourceMap     – all Condition resources keyed by UUID
// conditionsByEncounter    – condition UUID[] keyed by encounter UUID
// diagReportResourceMap    – all DiagnosticReport resources keyed by UUID
// diagReportsByEncounter   – diagReport UUID[] keyed by encounter UUID
// claimResourceMap         – all Claim resources keyed by UUID
// claimsByEncounter        – claim UUID[] keyed by encounter UUID
// eobResourceMap           – all ExplanationOfBenefit resources keyed by UUID
// eobsByEncounter          – eob UUID[] keyed by encounter UUID (via claim link)
let patientListCache = null;
const patientBundleMap = new Map();
const patientResourceMap = new Map();
const encounterResourceMap = new Map();
const encountersByPatient = new Map();
const docRefResourceMap = new Map();
const docRefsByEncounter = new Map();
const conditionResourceMap = new Map();
const conditionsByEncounter = new Map();
const diagReportResourceMap = new Map();
const diagReportsByEncounter = new Map();
const claimResourceMap = new Map();
const claimsByEncounter = new Map();
const eobResourceMap = new Map();
const eobsByEncounter = new Map();

const loadPatients = async () => {
  const fhirDir = path.join(__dirname, "public/synthea/fhir");
  const files = fs.readdirSync(fhirDir).filter((f) => f.endsWith(".json"));

  const list = [];

  await Promise.all(
    files.map(async (file) => {
      try {
        const data = await fs.promises.readFile(
          path.join(fhirDir, file),
          "utf-8",
        );
        const bundle = JSON.parse(data);

        // The FHIR files are Bundles – dig out the Patient resource
        const patientResource = bundle.entry?.find(
          (e) => e.resource?.resourceType === "Patient",
        )?.resource;

        const patientId = patientResource?.id;
        if (!patientId) return; // skip malformed files

        // Index the full bundle for the detail route
        patientBundleMap.set(patientId, bundle);
        // Index the lean Patient resource for the FHIR /fhir/Patient routes
        patientResourceMap.set(patientId, patientResource);

        // Index every Encounter resource from this bundle
        const encounterIds = [];
        bundle.entry?.forEach((e) => {
          const r = e.resource;
          if (r?.resourceType === "Encounter" && r.id) {
            encounterResourceMap.set(r.id, { ...r, _patientId: patientId });
            encounterIds.push(r.id);
          }
        });
        encountersByPatient.set(patientId, encounterIds);

        // Index every DocumentReference resource from this bundle
        bundle.entry?.forEach((e) => {
          const r = e.resource;
          if (r?.resourceType === "DocumentReference" && r.id) {
            docRefResourceMap.set(r.id, { ...r, _patientId: patientId });
            // Associate with each encounter listed in context.encounter[]
            const encRefs = r.context?.encounter ?? [];
            encRefs.forEach((ref) => {
              const encId = String(ref.reference ?? "").replace(
                /^urn:uuid:/,
                "",
              );
              if (encId) {
                const existing = docRefsByEncounter.get(encId) ?? [];
                existing.push(r.id);
                docRefsByEncounter.set(encId, existing);
              }
            });
          }
        });

        // Index every Condition (encounter ref in condition.encounter.reference)
        bundle.entry?.forEach((e) => {
          const r = e.resource;
          if (r?.resourceType === "Condition" && r.id) {
            conditionResourceMap.set(r.id, { ...r, _patientId: patientId });
            const encId = String(r.encounter?.reference ?? "").replace(
              /^urn:uuid:/,
              "",
            );
            if (encId) {
              const existing = conditionsByEncounter.get(encId) ?? [];
              existing.push(r.id);
              conditionsByEncounter.set(encId, existing);
            }
          }
        });

        // Index every DiagnosticReport (encounter ref in report.encounter.reference)
        bundle.entry?.forEach((e) => {
          const r = e.resource;
          if (r?.resourceType === "DiagnosticReport" && r.id) {
            diagReportResourceMap.set(r.id, { ...r, _patientId: patientId });
            const encId = String(r.encounter?.reference ?? "").replace(
              /^urn:uuid:/,
              "",
            );
            if (encId) {
              const existing = diagReportsByEncounter.get(encId) ?? [];
              existing.push(r.id);
              diagReportsByEncounter.set(encId, existing);
            }
          }
        });

        // Index every Claim (encounter ref buried in item[].encounter[].reference)
        bundle.entry?.forEach((e) => {
          const r = e.resource;
          if (r?.resourceType === "Claim" && r.id) {
            claimResourceMap.set(r.id, { ...r, _patientId: patientId });
            const encIds = new Set();
            (r.item ?? []).forEach((item) => {
              (item.encounter ?? []).forEach((ref) => {
                const encId = String(ref.reference ?? "").replace(
                  /^urn:uuid:/,
                  "",
                );
                if (encId) encIds.add(encId);
              });
            });
            encIds.forEach((encId) => {
              const existing = claimsByEncounter.get(encId) ?? [];
              existing.push(r.id);
              claimsByEncounter.set(encId, existing);
            });
          }
        });

        // Index every ExplanationOfBenefit (links to encounter via EOB.claim → Claim → item[].encounter)
        // We do a second pass after Claims are indexed for this bundle.
        const bundleClaims = new Map();
        bundle.entry?.forEach((e) => {
          const r = e.resource;
          if (r?.resourceType === "Claim" && r.id) bundleClaims.set(r.id, r);
        });
        bundle.entry?.forEach((e) => {
          const r = e.resource;
          if (r?.resourceType === "ExplanationOfBenefit" && r.id) {
            eobResourceMap.set(r.id, { ...r, _patientId: patientId });
            const claimId = String(r.claim?.reference ?? "").replace(
              /^urn:uuid:/,
              "",
            );
            const claim = bundleClaims.get(claimId);
            const encIds = new Set();
            (claim?.item ?? []).forEach((item) => {
              (item.encounter ?? []).forEach((ref) => {
                const encId = String(ref.reference ?? "").replace(
                  /^urn:uuid:/,
                  "",
                );
                if (encId) encIds.add(encId);
              });
            });
            encIds.forEach((encId) => {
              const existing = eobsByEncounter.get(encId) ?? [];
              existing.push(r.id);
              eobsByEncounter.set(encId, existing);
            });
          }
        });

        // Build the flat summary for the list/search route
        const phone =
          patientResource?.telecom?.find((t) => t.system === "phone")?.value ||
          "";

        const addr = patientResource?.address?.[0];
        const address = addr
          ? [
              addr.line?.join(" "),
              addr.city,
              addr.state,
              addr.postalCode,
              addr.country,
            ]
              .filter(Boolean)
              .join(", ")
          : "";

        const findExt = (url) =>
          patientResource?.extension?.find((e) => e.url?.includes(url));

        const raceExt = findExt("us-core-race");
        const race =
          raceExt?.extension?.find((e) => e.url === "text")?.valueString || "";

        const ethnicityExt = findExt("us-core-ethnicity");
        const ethnicity =
          ethnicityExt?.extension?.find((e) => e.url === "text")?.valueString ||
          "";

        const birthPlaceExt = findExt("birthPlace");
        const birthPlaceAddr = birthPlaceExt?.valueAddress;
        const birthPlace = birthPlaceAddr
          ? [birthPlaceAddr.city, birthPlaceAddr.state, birthPlaceAddr.country]
              .filter(Boolean)
              .join(", ")
          : "";

        const language =
          patientResource?.communication?.[0]?.language?.text ||
          patientResource?.communication?.[0]?.language?.coding?.[0]?.display ||
          "";

        const ssn =
          patientResource?.identifier?.find(
            (i) =>
              i.system === "http://hl7.org/fhir/sid/us-ssn" ||
              i.type?.coding?.[0]?.code === "SS",
          )?.value || "";

        const mrn =
          patientResource?.identifier?.find(
            (i) => i.type?.coding?.[0]?.code === "MR",
          )?.value || patientId;

        list.push({
          id: patientId,
          name: patientResource?.name?.[0]?.text || file.replace(".json", ""),
          family: patientResource?.name?.[0]?.family || "",
          given: Array.isArray(patientResource?.name?.[0]?.given)
            ? patientResource.name[0].given.join(" ")
            : "",
          gender: patientResource?.gender || "",
          birthDate: patientResource?.birthDate || "",
          maritalStatus:
            patientResource?.maritalStatus?.text ||
            patientResource?.maritalStatus?.coding?.[0]?.display ||
            "",
          phone,
          address,
          race,
          ethnicity,
          birthPlace,
          language,
          ssn,
          mrn,
          filename: file,
          resourceType: "Patient",
        });
      } catch (e) {
        console.error(`Failed to parse ${file}:`, e);
      }
    }),
  );

  patientListCache = list;
  console.log(`Loaded ${patientListCache.length} patients into cache`);
  console.log(`Loaded ${encounterResourceMap.size} encounters into cache`);
};
// ──────────────────────────────────────────────────────────────────────────────

// Serve index.html at root and other static assets if needed
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serve static files from public/synthea
app.use("/synthea", express.static(path.join(__dirname, "public/synthea")));

// Get all patients
app.get("/api/patients", (req, res) => {
  try {
    if (!patientListCache) {
      return res.status(503).json({ error: "Cache not ready" });
    }

    const { name, family, given, gender, birthDate, phone, address } =
      req.query;
    let results = patientListCache;

    if (name) {
      const q = String(name).toLowerCase();
      results = results.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (family) {
      const q = String(family).toLowerCase();
      results = results.filter((p) => p.family.toLowerCase().includes(q));
    }
    if (given) {
      const q = String(given).toLowerCase();
      results = results.filter((p) => p.given.toLowerCase().includes(q));
    }
    if (gender) {
      const q = String(gender).toLowerCase();
      results = results.filter((p) => p.gender.toLowerCase().includes(q));
    }
    if (birthDate) {
      results = results.filter((p) => p.birthDate === String(birthDate));
    }
    if (phone) {
      const q = String(phone).toLowerCase();
      results = results.filter((p) => p.phone.toLowerCase().includes(q));
    }
    if (address) {
      const q = String(address).toLowerCase();
      results = results.filter((p) => p.address.toLowerCase().includes(q));
    }

    res.json(results);
  } catch (error) {
    console.error("Error returning patients:", error);
    res.status(500).json({ error: "Failed to return patients" });
  }
});

// Get a specific patient by ID
app.get("/api/patients/:id", (req, res) => {
  try {
    if (!patientListCache) {
      return res.status(503).json({ error: "Cache not ready" });
    }

    const bundle = patientBundleMap.get(req.params.id);
    if (!bundle) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json(bundle);
  } catch (error) {
    console.error("Error reading patient:", error);
    res.status(500).json({ error: "Failed to read patient" });
  }
});

// Get patient count
app.get("/api/patients-count", (req, res) => {
  try {
    if (!patientListCache) {
      return res.status(503).json({ error: "Cache not ready" });
    }
    res.json({ count: patientListCache.length });
  } catch (error) {
    console.error("Error counting patients:", error);
    res.status(500).json({ error: "Failed to count patients" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ─── FHIR STU3 Routes ─────────────────────────────────────────────────────────
const FHIR_CONTENT_TYPE = "application/fhir+json";
const BASE_URL = `http://localhost:${PORT}`;

// GET /fhir/Patient  – FHIR STU3 search, returns searchset Bundle
// Supported params: family, given, name, gender, birthdate, _id, _count, _offset
app.get("/fhir/Patient", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const { family, given, name, gender, birthdate, _id, address, phone } =
    req.query;
  const count = parseInt(req.query._count ?? "20", 10);
  const offset = parseInt(req.query._offset ?? "0", 10);

  let results = [...patientResourceMap.values()];

  if (_id) results = results.filter((p) => p.id === String(_id));
  if (family)
    results = results.filter((p) =>
      p.name?.[0]?.family?.toLowerCase().includes(String(family).toLowerCase()),
    );
  if (given)
    results = results.filter((p) =>
      p.name?.[0]?.given
        ?.join(" ")
        .toLowerCase()
        .includes(String(given).toLowerCase()),
    );
  if (name)
    results = results.filter((p) => {
      const q = String(name).toLowerCase();
      const r = p.name?.[0];
      return (
        r?.text?.toLowerCase().includes(q) ||
        r?.family?.toLowerCase().includes(q) ||
        r?.given?.join(" ").toLowerCase().includes(q)
      );
    });
  if (gender)
    results = results.filter(
      (p) => p.gender?.toLowerCase() === String(gender).toLowerCase(),
    );
  if (birthdate)
    results = results.filter((p) => p.birthDate === String(birthdate));
  if (address) {
    const q = String(address).toLowerCase();
    results = results.filter((p) =>
      p.address?.some((a) =>
        [a.line?.join(" "), a.city, a.state, a.postalCode, a.country]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      ),
    );
  }
  if (phone) {
    const q = String(phone).toLowerCase();
    results = results.filter((p) =>
      p.telecom?.some(
        (t) => t.system === "phone" && t.value?.toLowerCase().includes(q),
      ),
    );
  }

  const total = results.length;
  const page = results.slice(offset, offset + count);
  const selfUrl = `${BASE_URL}/fhir/Patient?${new URLSearchParams(req.query).toString()}`;

  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link: [
      { relation: "self", url: selfUrl },
      ...(offset + count < total
        ? [
            {
              relation: "next",
              url: `${BASE_URL}/fhir/Patient?_count=${count}&_offset=${offset + count}`,
            },
          ]
        : []),
    ],
    entry: page.map((resource) => ({
      fullUrl: `${BASE_URL}/fhir/Patient/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };

  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(bundle);
});

// GET /fhir/Patient/:id  – returns the lean Patient resource (not the full Bundle)
app.get("/fhir/Patient/:id", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const resource = patientResourceMap.get(req.params.id);
  if (!resource) return res.status(404).json({ error: "Patient not found" });

  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(resource);
});

// ─── FHIR Encounter Routes ────────────────────────────────────────────────────
// GET /fhir/Encounter
// Supported params: patient, status, date (prefix: eq/ge/le/gt/lt), type (text),
//                   class (code), _id, _count, _offset
app.get("/fhir/Encounter", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const { patient, status, date, type, _id, reason } = req.query;
  const classCode = req.query["class"];
  const count = parseInt(req.query._count ?? "20", 10);
  const offset = parseInt(req.query._offset ?? "0", 10);

  // If patient param given, restrict to that patient's encounters only
  let results;
  if (patient) {
    const patId = String(patient).replace(/^(Patient\/|urn:uuid:)/, "");
    const ids = encountersByPatient.get(patId) ?? [];
    results = ids.map((id) => encounterResourceMap.get(id)).filter(Boolean);
  } else {
    results = [...encounterResourceMap.values()];
  }

  if (_id) results = results.filter((e) => e.id === String(_id));

  if (status) {
    const q = String(status).toLowerCase();
    results = results.filter((e) => e.status?.toLowerCase() === q);
  }

  if (classCode) {
    const q = String(classCode).toLowerCase();
    results = results.filter((e) => e.class?.code?.toLowerCase() === q);
  }

  if (type) {
    const q = String(type).toLowerCase();
    results = results.filter((e) =>
      e.type?.some(
        (t) =>
          t.text?.toLowerCase().includes(q) ||
          t.coding?.some((c) => c.display?.toLowerCase().includes(q)),
      ),
    );
  }

  if (reason) {
    const q = String(reason).toLowerCase();
    results = results.filter((e) =>
      e.reason?.some(
        (r) =>
          r.text?.toLowerCase().includes(q) ||
          r.coding?.some(
            (c) =>
              c.code === String(reason) || c.display?.toLowerCase().includes(q),
          ),
      ),
    );
  }

  // date param – supports prefix (eq/ge/le/gt/lt) or bare YYYY-MM-DD (eq)
  if (date) {
    const dateStr = String(date);
    const match = dateStr.match(/^(eq|ge|le|gt|lt)?(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const prefix = match[1] ?? "eq";
      const target = match[2];
      results = results.filter((e) => {
        const start = e.period?.start?.slice(0, 10);
        if (!start) return false;
        if (prefix === "eq") return start === target;
        if (prefix === "ge") return start >= target;
        if (prefix === "le") return start <= target;
        if (prefix === "gt") return start > target;
        if (prefix === "lt") return start < target;
        return false;
      });
    }
  }

  const total = results.length;
  const page = results.slice(offset, offset + count);
  const selfUrl = `${BASE_URL}/fhir/Encounter?${new URLSearchParams(req.query).toString()}`;

  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link: [
      { relation: "self", url: selfUrl },
      ...(offset + count < total
        ? [
            {
              relation: "next",
              url: `${BASE_URL}/fhir/Encounter?_count=${count}&_offset=${offset + count}`,
            },
          ]
        : []),
    ],
    entry: page.map((resource) => ({
      fullUrl: `${BASE_URL}/fhir/Encounter/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };

  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(bundle);
});

// GET /fhir/Encounter/_types  – distinct encounter type strings from cached data
app.get("/fhir/Encounter/_types", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const types = new Set();
  for (const enc of encounterResourceMap.values()) {
    const text = enc.type?.[0]?.text ?? enc.type?.[0]?.coding?.[0]?.display;
    if (text) types.add(text);
  }

  res.json([...types].sort());
});

// GET /fhir/Encounter/_classes  – distinct class codes from cached data
app.get("/fhir/Encounter/_classes", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const classes = new Set();
  for (const enc of encounterResourceMap.values()) {
    if (enc.class?.code) classes.add(enc.class.code);
  }

  res.json([...classes].sort());
});

// GET /fhir/Encounter/:id  – returns a single Encounter resource
app.get("/fhir/Encounter/:id", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const resource = encounterResourceMap.get(req.params.id);
  if (!resource) return res.status(404).json({ error: "Encounter not found" });

  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(resource);
});

// GET /fhir/DocumentReference?encounter=<id>  – list docRefs for an encounter
// GET /fhir/DocumentReference?patient=<id>    – list docRefs for a patient
// GET /fhir/DocumentReference?_id=<id>        – specific docRef
app.get("/fhir/DocumentReference", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const { encounter, patient, _id, _count = 50, _offset = 0 } = req.query;
  const count = Math.min(parseInt(_count, 10) || 50, 500);
  const offset = parseInt(_offset, 10) || 0;

  let results;

  if (encounter) {
    const encId = String(encounter).replace(/^(Encounter\/|urn:uuid:)/, "");
    const ids = docRefsByEncounter.get(encId) ?? [];
    results = ids.map((id) => docRefResourceMap.get(id)).filter(Boolean);
  } else if (patient) {
    const patId = String(patient).replace(/^(Patient\/|urn:uuid:)/, "");
    results = [...docRefResourceMap.values()].filter(
      (r) => r._patientId === patId,
    );
  } else if (_id) {
    const r = docRefResourceMap.get(String(_id));
    results = r ? [r] : [];
  } else {
    results = [...docRefResourceMap.values()];
  }

  const total = results.length;
  const page = results.slice(offset, offset + count);
  const selfUrl = `${BASE_URL}/fhir/DocumentReference?${new URLSearchParams(req.query).toString()}`;

  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link: [{ relation: "self", url: selfUrl }],
    entry: page.map((resource) => ({
      fullUrl: `${BASE_URL}/fhir/DocumentReference/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };

  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(bundle);
});

// GET /fhir/DocumentReference/:id  – single DocumentReference resource
app.get("/fhir/DocumentReference/:id", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const resource = docRefResourceMap.get(req.params.id);
  if (!resource)
    return res.status(404).json({ error: "DocumentReference not found" });

  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(resource);
});

// ── Condition ─────────────────────────────────────────────────────────────────
// GET /fhir/Condition?encounter=<id>  |  ?patient=<id>  |  ?_id=<id>
app.get("/fhir/Condition", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const { encounter, patient, _id, _count = 50, _offset = 0 } = req.query;
  const count = Math.min(parseInt(_count, 10) || 50, 500);
  const offset = parseInt(_offset, 10) || 0;
  let results;

  if (encounter) {
    const encId = String(encounter).replace(/^(Encounter\/|urn:uuid:)/, "");
    const ids = conditionsByEncounter.get(encId) ?? [];
    results = ids.map((id) => conditionResourceMap.get(id)).filter(Boolean);
  } else if (patient) {
    const patId = String(patient).replace(/^(Patient\/|urn:uuid:)/, "");
    results = [...conditionResourceMap.values()].filter(
      (r) => r._patientId === patId,
    );
  } else if (_id) {
    const r = conditionResourceMap.get(String(_id));
    results = r ? [r] : [];
  } else {
    results = [...conditionResourceMap.values()];
  }

  const total = results.length;
  const page = results.slice(offset, offset + count);
  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link: [
      {
        relation: "self",
        url: `${BASE_URL}/fhir/Condition?${new URLSearchParams(req.query)}`,
      },
    ],
    entry: page.map((resource) => ({
      fullUrl: `${BASE_URL}/fhir/Condition/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };
  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(bundle);
});

app.get("/fhir/Condition/:id", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });
  const resource = conditionResourceMap.get(req.params.id);
  if (!resource) return res.status(404).json({ error: "Condition not found" });
  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(resource);
});

// ── DiagnosticReport ──────────────────────────────────────────────────────────
// GET /fhir/DiagnosticReport?encounter=<id>  |  ?patient=<id>  |  ?_id=<id>
app.get("/fhir/DiagnosticReport", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const { encounter, patient, _id, _count = 50, _offset = 0 } = req.query;
  const count = Math.min(parseInt(_count, 10) || 50, 500);
  const offset = parseInt(_offset, 10) || 0;
  let results;

  if (encounter) {
    const encId = String(encounter).replace(/^(Encounter\/|urn:uuid:)/, "");
    const ids = diagReportsByEncounter.get(encId) ?? [];
    results = ids.map((id) => diagReportResourceMap.get(id)).filter(Boolean);
  } else if (patient) {
    const patId = String(patient).replace(/^(Patient\/|urn:uuid:)/, "");
    results = [...diagReportResourceMap.values()].filter(
      (r) => r._patientId === patId,
    );
  } else if (_id) {
    const r = diagReportResourceMap.get(String(_id));
    results = r ? [r] : [];
  } else {
    results = [...diagReportResourceMap.values()];
  }

  const total = results.length;
  const page = results.slice(offset, offset + count);
  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link: [
      {
        relation: "self",
        url: `${BASE_URL}/fhir/DiagnosticReport?${new URLSearchParams(req.query)}`,
      },
    ],
    entry: page.map((resource) => ({
      fullUrl: `${BASE_URL}/fhir/DiagnosticReport/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };
  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(bundle);
});

app.get("/fhir/DiagnosticReport/:id", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });
  const resource = diagReportResourceMap.get(req.params.id);
  if (!resource)
    return res.status(404).json({ error: "DiagnosticReport not found" });
  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(resource);
});

// ── Claim ─────────────────────────────────────────────────────────────────────
// GET /fhir/Claim?encounter=<id>  |  ?patient=<id>  |  ?_id=<id>
app.get("/fhir/Claim", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const { encounter, patient, _id, _count = 50, _offset = 0 } = req.query;
  const count = Math.min(parseInt(_count, 10) || 50, 500);
  const offset = parseInt(_offset, 10) || 0;
  let results;

  if (encounter) {
    const encId = String(encounter).replace(/^(Encounter\/|urn:uuid:)/, "");
    const ids = claimsByEncounter.get(encId) ?? [];
    results = ids.map((id) => claimResourceMap.get(id)).filter(Boolean);
  } else if (patient) {
    const patId = String(patient).replace(/^(Patient\/|urn:uuid:)/, "");
    results = [...claimResourceMap.values()].filter(
      (r) => r._patientId === patId,
    );
  } else if (_id) {
    const r = claimResourceMap.get(String(_id));
    results = r ? [r] : [];
  } else {
    results = [...claimResourceMap.values()];
  }

  const total = results.length;
  const page = results.slice(offset, offset + count);
  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link: [
      {
        relation: "self",
        url: `${BASE_URL}/fhir/Claim?${new URLSearchParams(req.query)}`,
      },
    ],
    entry: page.map((resource) => ({
      fullUrl: `${BASE_URL}/fhir/Claim/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };
  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(bundle);
});

app.get("/fhir/Claim/:id", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });
  const resource = claimResourceMap.get(req.params.id);
  if (!resource) return res.status(404).json({ error: "Claim not found" });
  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(resource);
});

// ── ExplanationOfBenefit ──────────────────────────────────────────────────────
// GET /fhir/ExplanationOfBenefit?encounter=<id>  |  ?patient=<id>  |  ?_id=<id>
app.get("/fhir/ExplanationOfBenefit", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });

  const { encounter, patient, _id, _count = 50, _offset = 0 } = req.query;
  const count = Math.min(parseInt(_count, 10) || 50, 500);
  const offset = parseInt(_offset, 10) || 0;
  let results;

  if (encounter) {
    const encId = String(encounter).replace(/^(Encounter\/|urn:uuid:)/, "");
    const ids = eobsByEncounter.get(encId) ?? [];
    results = ids.map((id) => eobResourceMap.get(id)).filter(Boolean);
  } else if (patient) {
    const patId = String(patient).replace(/^(Patient\/|urn:uuid:)/, "");
    results = [...eobResourceMap.values()].filter(
      (r) => r._patientId === patId,
    );
  } else if (_id) {
    const r = eobResourceMap.get(String(_id));
    results = r ? [r] : [];
  } else {
    results = [...eobResourceMap.values()];
  }

  const total = results.length;
  const page = results.slice(offset, offset + count);
  const bundle = {
    resourceType: "Bundle",
    type: "searchset",
    total,
    link: [
      {
        relation: "self",
        url: `${BASE_URL}/fhir/ExplanationOfBenefit?${new URLSearchParams(req.query)}`,
      },
    ],
    entry: page.map((resource) => ({
      fullUrl: `${BASE_URL}/fhir/ExplanationOfBenefit/${resource.id}`,
      resource,
      search: { mode: "match" },
    })),
  };
  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(bundle);
});

app.get("/fhir/ExplanationOfBenefit/:id", (req, res) => {
  if (!patientListCache)
    return res.status(503).json({ error: "Cache not ready" });
  const resource = eobResourceMap.get(req.params.id);
  if (!resource)
    return res.status(404).json({ error: "ExplanationOfBenefit not found" });
  res.setHeader("Content-Type", FHIR_CONTENT_TYPE);
  res.json(resource);
});
// ──────────────────────────────────────────────────────────────────────────────

loadPatients().then(() => {
  app.listen(PORT, () => {
    console.log(`🏥 FHIR Patient Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET /api/patients - List all patients`);
    console.log(`   GET /api/patients/:id - Get specific patient`);
    console.log(`   GET /api/patients-count - Get total patient count`);
    console.log(`   GET /api/health - Health check`);
    console.log(
      `   GET /fhir/Encounter - Search encounters (patient, status, date, type, class)`,
    );
    console.log(`   GET /fhir/Encounter/:id - Get specific encounter`);
  });
});
