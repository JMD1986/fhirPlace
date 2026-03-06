import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

function App() {
  const [patient, setPatient] = useState<Record<string, unknown> | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [files, setFiles] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/synthea/manifest.json");
        if (!mounted) return;
        if (!res.ok) {
          setFiles([]);
          return;
        }
        const m = await res.json();
        const list = Array.isArray(m?.files) ? m.files : [];
        setFiles(list);
        if (list.length > 0) setSelected(list[0]);
      } catch {
        if (!mounted) return;
        setFiles([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  // load the selected file automatically when selection changes
  useEffect(() => {
    let mounted = true;
    if (!selected) return;
    (async () => {
      try {
        setLoadingPatient(true);
        setPatientError(null);
        // files live under /synthea/fhir/<name>
        const url = `/synthea/fhir/${encodeURIComponent(selected)}`;
        const res = await fetch(url);
        if (!mounted) return;
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const contentType = res.headers.get("content-type") || "";
        let json;
        if (
          selected.toLowerCase().endsWith(".ndjson") ||
          contentType.includes("ndjson")
        ) {
          const text = await res.text();
          const firstLine = text.split("\n").find(Boolean);
          if (!firstLine) throw new Error("NDJSON file empty");
          json = JSON.parse(firstLine);
        } else {
          json = await res.json();
        }
        setPatient(json);
      } catch (err: unknown) {
        if (!mounted) return;
        setPatient(null);
        const message = err instanceof Error ? err.message : String(err);
        setPatientError(message || "Failed to load patient");
      } finally {
        if (mounted) setLoadingPatient(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selected]);
  useEffect(() => {
    // reset selected if files change and selected is no longer valid
    // if (files && selected && !files.includes(selected)) {
    //   setSelected(files.length > 0 ? files[0] : null)
    // }
    console.log("files or selected changed", { selected });
  }, [files, selected]);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        {/* <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button> */}
        <div className="synthea-controls">
          <button
            className="synthea-button"
            disabled={loadingPatient}
            onClick={async () => {
              setLoadingPatient(true);
              setPatientError(null);
              try {
                // if manifest available, use selected or first file; otherwise try the simple path
                // if manifest available, use selected or first file; otherwise try the simple path
                let url = "/synthea/patient-0.json";
                if (files && files.length > 0) {
                  const pick = selected ?? files[0];
                  // files live under /synthea/fhir/<name>
                  url = `/synthea/fhir/${encodeURIComponent(pick)}`;
                }

                const res = await fetch(url);
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

                const contentType = res.headers.get("content-type") || "";
                let json;
                if (
                  url.toLowerCase().endsWith(".ndjson") ||
                  contentType.includes("ndjson")
                ) {
                  const text = await res.text();
                  const firstLine = text.split("\n").find(Boolean);
                  if (!firstLine) throw new Error("NDJSON file empty");
                  json = JSON.parse(firstLine);
                } else {
                  json = await res.json();
                }
                setPatient(json);
              } catch (err: unknown) {
                setPatient(null);
                const message =
                  err instanceof Error ? err.message : String(err);
                setPatientError(message || "Failed to load patient");
              } finally {
                setLoadingPatient(false);
              }
            }}
          >
            {loadingPatient ? "Loading…" : "Load patient"}
          </button>

          <div>
            <small className="synthea-label">Generated patients</small>
            {files === null ? (
              <small>manifest not loaded</small>
            ) : files.length === 0 ? (
              <small>No files found in /synthea/fhir</small>
            ) : (
              <select
                aria-label="Synthea generated files"
                className="manifest-select"
                value={selected ?? files[0]}
                onChange={(e) => setSelected(e.target.value)}
              >
                {files.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      {patientError && <div className="error-text">{patientError}</div>}
      {patient &&
        (() => {
          const id =
            typeof patient["id"] === "string"
              ? (patient["id"] as string)
              : undefined;
          const name = (() => {
            const names = patient["name"];
            if (!Array.isArray(names) || names.length === 0) return undefined;
            const first = names[0];
            if (typeof first !== "object" || first === null) return undefined;
            const firstRec = first as Record<string, unknown>;
            const given = firstRec["given"];
            const givenStr = Array.isArray(given)
              ? given.filter((g) => typeof g === "string").join(" ")
              : "";
            const family =
              typeof firstRec["family"] === "string"
                ? (firstRec["family"] as string)
                : "";
            const full = [givenStr, family].filter(Boolean).join(" ");
            return full || undefined;
          })();
          const gender =
            typeof patient["gender"] === "string"
              ? (patient["gender"] as string)
              : undefined;
          const birthDate =
            typeof patient["birthDate"] === "string"
              ? (patient["birthDate"] as string)
              : undefined;

          return (
            <div className="patient-container">
              <h2>Patient (from Synthea)</h2>
              <p>
                <strong>ID:</strong> {id ?? "—"}
              </p>
              <p>
                <strong>Name:</strong> {name ?? "—"}
              </p>
              <p>
                <strong>Gender:</strong> {gender ?? "—"}
              </p>
              <p>
                <strong>Birth date:</strong> {birthDate ?? "—"}
              </p>
              <div className="patient-json-details">
                <small>
                  Selected file: <code>{selected ?? "—"}</code>
                </small>
                <pre className="patient-json">
                  {JSON.stringify(patient, null, 2)}
                </pre>
              </div>
            </div>
          );
        })()}
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
