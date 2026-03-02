import { useState, useEffect } from "react";
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
  const [searchParams, setSearchParams] = useState({
    patient: "",
    status: "",
    classCode: "",
    type: "",
    dateFrom: "",
    dateTo: "",
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
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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
