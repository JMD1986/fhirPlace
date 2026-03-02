import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SearchIcon from "@mui/icons-material/Search";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Autocomplete from "@mui/material/Autocomplete";

// ── SNOMED CT encounter reason codes (HL7 FHIR STU3 encounter-reason value set)
const ENCOUNTER_REASONS: { code: string; display: string }[] = [
  { code: "1023001", display: "Apnea" },
  { code: "25064002", display: "Headache" },
  { code: "38341003", display: "Hypertensive disorder" },
  { code: "44054006", display: "Diabetes mellitus type 2" },
  { code: "84114007", display: "Heart failure" },
  { code: "195967001", display: "Asthma" },
  { code: "267036007", display: "Dyspnea" },
  { code: "62106007", display: "Concussion" },
  { code: "22298006", display: "Myocardial infarction" },
  { code: "230690007", display: "Stroke" },
  { code: "233604007", display: "Pneumonia" },
  { code: "40055000", display: "Chronic sinusitis" },
  { code: "271737000", display: "Anemia" },
  { code: "73211009", display: "Diabetes mellitus" },
  { code: "57676002", display: "Joint pain" },
  { code: "82423001", display: "Chronic pain" },
  { code: "68496003", display: "Polyp of colon" },
  { code: "236077008", display: "Urinary tract infection" },
  { code: "40480006", display: "Appendicitis" },
  { code: "55822004", display: "Hyperlipidemia" },
  { code: "50043002", display: "Respiratory disorder" },
  { code: "73595000", display: "Stress" },
  { code: "35489007", display: "Depression" },
  { code: "197480006", display: "Anxiety disorder" },
  { code: "386661006", display: "Fever" },
  { code: "49727002", display: "Cough" },
  { code: "74474003", display: "Gastrointestinal disorder" },
  { code: "125605004", display: "Fracture of bone" },
  { code: "71620000", display: "Fracture of leg" },
  { code: "48694002", display: "Anxiety" },
  { code: "15724005", display: "Backache" },
  { code: "162397003", display: "Pain in throat" },
  { code: "267102003", display: "Sore throat" },
  { code: "9826008", display: "Conjunctivitis" },
  { code: "3110003", display: "Acute otitis media" },
  { code: "75498004", display: "Acute bronchitis" },
  { code: "386689009", display: "Rash" },
  { code: "2472002", display: "Anuria" },
  { code: "267064002", display: "Dizziness" },
  { code: "57335002", display: "Nausea and vomiting" },
];

// ── FHIR STU3 Encounter resource (fields we use) ──────────────────────────────
interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}
interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  status?: string;
  class?: FhirCoding;
  type?: { text?: string; coding?: FhirCoding[] }[];
  subject?: { reference?: string; display?: string };
  participant?: {
    individual?: { display?: string };
  }[];
  period?: { start?: string; end?: string };
  location?: { location?: { display?: string } }[];
  serviceProvider?: { display?: string };
  _patientId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const stripNums = (s: string) => s.replace(/\d+/g, "").trim();

const getType = (enc: FhirEncounter) =>
  enc.type?.[0]?.text ?? enc.type?.[0]?.coding?.[0]?.display ?? "—";

const getPatientDisplay = (enc: FhirEncounter) => {
  const raw = enc.subject?.display ?? "";
  // strip trailing numbers that Synthea adds to names
  return raw
    .split(" ")
    .map((w) => stripNums(w))
    .filter(Boolean)
    .join(" ");
};

const getPractitioner = (enc: FhirEncounter) =>
  enc.participant?.[0]?.individual?.display ?? "—";

const getLocation = (enc: FhirEncounter) =>
  enc.location?.[0]?.location?.display ?? enc.serviceProvider?.display ?? "—";

const formatDate = (iso?: string) => (iso ? iso.slice(0, 10) : "—");

const statusColor = (
  status?: string,
): "success" | "warning" | "error" | "default" => {
  if (status === "finished") return "success";
  if (status === "in-progress") return "warning";
  if (status === "cancelled") return "error";
  return "default";
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function EncounterSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    patient: "",
    status: "",
    classCode: "",
    type: "",
    dateFrom: "",
    dateTo: "",
    reason: "",
  });
  const [encounters, setEncounters] = useState<FhirEncounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);

  // Fetch dropdown options from server on mount
  useEffect(() => {
    Promise.all([
      fetch("http://localhost:5001/fhir/Encounter/_types").then((r) =>
        r.json(),
      ),
      fetch("http://localhost:5001/fhir/Encounter/_classes").then((r) =>
        r.json(),
      ),
    ])
      .then(([types, classes]) => {
        setTypeOptions(types);
        setClassOptions(classes);
      })
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append("_count", "1000");
      if (searchParams.patient) params.append("patient", searchParams.patient);
      if (searchParams.status) params.append("status", searchParams.status);
      if (searchParams.classCode)
        params.append("class", searchParams.classCode);
      if (searchParams.type) params.append("type", searchParams.type);
      // Build FHIR date range params
      if (searchParams.dateFrom)
        params.append("date", `ge${searchParams.dateFrom}`);
      if (searchParams.dateTo)
        params.append("date", `le${searchParams.dateTo}`);
      if (searchParams.reason) params.append("reason", searchParams.reason);

      const url = `http://localhost:5001/fhir/Encounter?${params.toString()}`;
      console.log("[EncounterSearch] fetching:", url);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Search request failed");
      const bundle = await response.json();
      console.log(
        "[EncounterSearch] bundle total:",
        bundle.total,
        "entries:",
        bundle.entry?.length,
      );
      const results: FhirEncounter[] = (bundle.entry ?? []).map(
        (e: { resource: FhirEncounter }) => e.resource,
      );
      setEncounters(results);
      setTotal(bundle.total ?? null);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearchParams({
      patient: "",
      status: "",
      classCode: "",
      type: "",
      dateFrom: "",
      dateTo: "",
      reason: "",
    });
    setSearched(false);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* ── Search Form ── */}
      <Box component="form" onSubmit={handleSearch} noValidate>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Patient ID"
              name="patient"
              value={searchParams.patient}
              onChange={handleChange}
              placeholder="Enter patient UUID"
              variant="outlined"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                name="status"
                value={searchParams.status}
                onChange={(e) =>
                  setSearchParams((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
              >
                <MenuItem value="">
                  <em>Any</em>
                </MenuItem>
                {[
                  "planned",
                  "arrived",
                  "triaged",
                  "in-progress",
                  "onleave",
                  "finished",
                  "cancelled",
                ].map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Class</InputLabel>
              <Select
                label="Class"
                name="classCode"
                value={searchParams.classCode}
                onChange={(e) =>
                  setSearchParams((prev) => ({
                    ...prev,
                    classCode: e.target.value,
                  }))
                }
              >
                <MenuItem value="">
                  <em>Any</em>
                </MenuItem>
                {classOptions.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Encounter Type</InputLabel>
              <Select
                label="Encounter Type"
                name="type"
                value={searchParams.type}
                onChange={(e) =>
                  setSearchParams((prev) => ({ ...prev, type: e.target.value }))
                }
              >
                <MenuItem value="">
                  <em>Any</em>
                </MenuItem>
                {typeOptions.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Date From"
              name="dateFrom"
              value={searchParams.dateFrom}
              onChange={handleChange}
              type="date"
              variant="outlined"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Date To"
              name="dateTo"
              value={searchParams.dateTo}
              onChange={handleChange}
              type="date"
              variant="outlined"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Autocomplete
              options={ENCOUNTER_REASONS}
              getOptionLabel={(o) => o.display}
              value={
                ENCOUNTER_REASONS.find((r) => r.code === searchParams.reason) ??
                null
              }
              onChange={(_e, val) =>
                setSearchParams((prev) => ({
                  ...prev,
                  reason: val?.code ?? "",
                }))
              }
              isOptionEqualToValue={(o, v) => o.code === v.code}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Reason for Visit"
                  placeholder="Type to filter reasons…"
                  variant="outlined"
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={
                  loading ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <SearchIcon />
                  )
                }
                disabled={loading}
              >
                Search Encounters
              </Button>
              <Button
                variant="outlined"
                onClick={handleReset}
                disabled={loading}
              >
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* ── Feedback ── */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* ── Results ── */}
      {searched && !loading && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {searched
              ? `${total ?? encounters.length} encounter(s) found`
              : `Showing ${encounters.length} of ${total ?? "?"} encounters`}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "primary.main" }}>
                  {[
                    "Patient",
                    "Type",
                    "Class",
                    "Status",
                    "Date",
                    "Practitioner",
                    "Location",
                    "",
                  ].map((h) => (
                    <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {encounters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      {searched ? "No encounters found." : "Loading…"}
                    </TableCell>
                  </TableRow>
                ) : (
                  encounters.map((enc) => (
                    <TableRow
                      key={enc.id}
                      hover
                      sx={{ "&:last-child td": { border: 0 } }}
                    >
                      <TableCell>{getPatientDisplay(enc)}</TableCell>
                      <TableCell>{getType(enc)}</TableCell>
                      <TableCell>
                        <Chip
                          label={enc.class?.code ?? "—"}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={enc.status ?? "—"}
                          size="small"
                          color={statusColor(enc.status)}
                        />
                      </TableCell>
                      <TableCell>{formatDate(enc.period?.start)}</TableCell>
                      <TableCell>{getPractitioner(enc)}</TableCell>
                      <TableCell>{getLocation(enc)}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/encounter/${enc.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}
