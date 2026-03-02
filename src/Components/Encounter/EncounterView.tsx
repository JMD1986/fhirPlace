import { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useParams, useNavigate, Link } from "react-router-dom";
import DocumentReferencePanel from "./DocumentReferencePanel";

// ── Types ──────────────────────────────────────────────────────────────────────
interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}
interface EncounterResource {
  resourceType: "Encounter";
  id: string;
  status?: string;
  class?: FhirCoding;
  type?: { text?: string; coding?: FhirCoding[] }[];
  subject?: { reference?: string; display?: string };
  participant?: {
    type?: { text?: string; coding?: FhirCoding[] }[];
    period?: { start?: string; end?: string };
    individual?: { display?: string };
  }[];
  period?: { start?: string; end?: string };
  location?: { location?: { display?: string }; status?: string }[];
  serviceProvider?: { display?: string };
  reason?: { text?: string; coding?: FhirCoding[] }[];
  diagnosis?: {
    condition?: { display?: string };
    role?: { text?: string };
    rank?: number;
  }[];
  hospitalization?: {
    admitSource?: { text?: string };
    dischargeDisposition?: { text?: string };
  };
  identifier?: { system?: string; value?: string }[];
  _patientId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const stripNums = (s: string) => s.replace(/\d+/g, "").trim();

const formatDateTime = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
};

const statusColor = (
  status?: string,
): "success" | "warning" | "error" | "default" => {
  if (status === "finished") return "success";
  if (status === "in-progress") return "warning";
  if (status === "cancelled") return "error";
  return "default";
};

const cleanDisplay = (s?: string) =>
  s
    ? s
        .split(" ")
        .map((w) => stripNums(w))
        .filter(Boolean)
        .join(" ")
    : "—";

// ── Component ──────────────────────────────────────────────────────────────────
export default function EncounterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [encounter, setEncounter] = useState<EncounterResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchEncounter = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`http://localhost:5001/fhir/Encounter/${id}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Encounter not found"
              : "Failed to fetch encounter",
          );
        }
        const data: EncounterResource = await res.json();
        setEncounter(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchEncounter();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!encounter) return null;

  const type =
    encounter.type?.[0]?.text ??
    encounter.type?.[0]?.coding?.[0]?.display ??
    "—";
  const patientDisplay = cleanDisplay(encounter.subject?.display);
  const patientId =
    encounter._patientId ??
    encounter.subject?.reference?.replace(/^urn:uuid:/, "");

  const mainRows = [
    { label: "Encounter ID", value: encounter.id, mono: true },
    {
      label: "Status",
      value: (
        <Chip
          label={encounter.status ?? "—"}
          size="small"
          color={statusColor(encounter.status)}
        />
      ),
    },
    {
      label: "Class",
      value: encounter.class?.code ? (
        <Chip label={encounter.class.code} size="small" variant="outlined" />
      ) : (
        "—"
      ),
    },
    { label: "Type", value: type },
    {
      label: "Patient",
      value: patientId ? (
        <Link
          to={`/patient/${patientId}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <Typography
            variant="body2"
            sx={{
              color: "primary.main",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {patientDisplay}
          </Typography>
        </Link>
      ) : (
        patientDisplay
      ),
    },
    { label: "Start", value: formatDateTime(encounter.period?.start) },
    { label: "End", value: formatDateTime(encounter.period?.end) },
    {
      label: "Duration",
      value: formatDuration(encounter.period?.start, encounter.period?.end),
    },
    {
      label: "Location",
      value:
        encounter.location?.[0]?.location?.display ??
        encounter.serviceProvider?.display ??
        "—",
    },
    {
      label: "Service Provider",
      value: encounter.serviceProvider?.display ?? "—",
    },
  ];

  const practitioners = encounter.participant ?? [];
  const diagnoses = encounter.diagnosis ?? [];
  const reasons = encounter.reason ?? [];

  return (
    <Box sx={{ p: 3, mt: 2 }}>
      <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        &larr; Back to search
      </Button>

      <Typography variant="h5" fontWeight={600} gutterBottom>
        {type}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {patientDisplay} &mdash; {encounter.period?.start?.slice(0, 10) ?? ""}
      </Typography>

      <Grid container spacing={3} alignItems="flex-start">
        {/* ── Left column: sidebar ── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <DocumentReferencePanel encounterId={encounter.id} />
        </Grid>

        {/* ── Right column: main encounter detail ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* ── Main details ── */}
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table sx={{ minWidth: 500 }}>
              <TableHead sx={{ backgroundColor: "primary.main" }}>
                <TableRow>
                  <TableCell
                    sx={{ color: "white", fontWeight: 600, width: "28%" }}
                  >
                    Property
                  </TableCell>
                  <TableCell sx={{ color: "white", fontWeight: 600 }}>
                    Value
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mainRows.map((row, i) => (
                  <TableRow key={i} hover>
                    <TableCell
                      sx={{ fontWeight: 500, color: "text.secondary" }}
                    >
                      {row.label}
                    </TableCell>
                    <TableCell>
                      {typeof row.value === "string" ? (
                        <Typography
                          variant="body2"
                          fontFamily={row.mono ? "monospace" : "inherit"}
                        >
                          {row.value}
                        </Typography>
                      ) : (
                        row.value
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ── Practitioners ── */}
          {practitioners.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Participants
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableRow>
                      {["Name", "Role", "Start", "End"].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 600 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {practitioners.map((p, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{p.individual?.display ?? "—"}</TableCell>
                        <TableCell>{p.type?.[0]?.text ?? "—"}</TableCell>
                        <TableCell>{formatDateTime(p.period?.start)}</TableCell>
                        <TableCell>{formatDateTime(p.period?.end)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ── Diagnoses ── */}
          {diagnoses.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Diagnoses
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableRow>
                      {["Condition", "Role", "Rank"].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 600 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {diagnoses.map((d, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{d.condition?.display ?? "—"}</TableCell>
                        <TableCell>{d.role?.text ?? "—"}</TableCell>
                        <TableCell>{d.rank ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ── Reasons ── */}
          {reasons.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Reasons
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {reasons.map((r, i) => (
                  <Chip
                    key={i}
                    label={r.text ?? r.coding?.[0]?.display ?? "—"}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
