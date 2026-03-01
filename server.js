import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ─── Cache ────────────────────────────────────────────────────────────────────
// patientListCache  – flat summary objects used by GET /api/patients (+ filters)
// patientBundleMap  – full FHIR bundles keyed by patient UUID, for GET /api/patients/:id
let patientListCache = null;
const patientBundleMap = new Map();

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

        // Build the flat summary for the list/search route
        list.push({
          id: patientId,
          name: patientResource?.name?.[0]?.text || file.replace(".json", ""),
          family: patientResource?.name?.[0]?.family || "",
          given: Array.isArray(patientResource?.name?.[0]?.given)
            ? patientResource.name[0].given.join(" ")
            : "",
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

    const { name, family, given } = req.query;
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

loadPatients().then(() => {
  app.listen(PORT, () => {
    console.log(`🏥 FHIR Patient Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET /api/patients - List all patients`);
    console.log(`   GET /api/patients/:id - Get specific patient`);
    console.log(`   GET /api/patients-count - Get total patient count`);
    console.log(`   GET /api/health - Health check`);
  });
});
