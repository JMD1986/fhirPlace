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
import { useParams, useNavigate, Link } from "react-router-dom";

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}
interface DiagnosticReportResource {
  resourceType: "DiagnosticReport";
  id: string;
  status?: string;
  category?: { coding?: FhirCoding[] }[];
  code?: { text?: string; coding?: FhirCoding[] };
  subject?: { reference?: string; display?: string };
  encounter?: { reference?: string };
  effectiveDateTime?: string;
  issued?: string;
  performer?: { display?: string; reference?: string }[];
  presentedForm?: { contentType?: string; data?: string; title?: string }[];
  _patientId?: string;
  _encounterId?: string;
}

const fmt = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const statusColor = (
  s?: string,
): "success" | "warning" | "error" | "info" | "default" => {
  if (s === "final") return "success";
  if (s === "preliminary") return "warning";
  if (s === "cancelled" || s === "entered-in-error") return "error";
  if (s === "registered" || s === "partial") return "info";
  return "default";
};

export default function DiagnosticReportView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<DiagnosticReportResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(
          `http://localhost:5001/fhir/DiagnosticReport/${id}`,
        );
        if (!r.ok)
          throw new Error(
            r.status === 404
              ? "Diagnostic report not found"
              : "Failed to fetch",
          );
        setReport(await r.json());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  if (error)
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  if (!report) return null;

  const category =
    report.category?.[0]?.coding?.[0]?.display ??
    report.category?.[0]?.coding?.[0]?.code ??
    "—";
  const codeName =
    report.code?.text ?? report.code?.coding?.[0]?.display ?? "—";
  const patientId =
    report._patientId ?? report.subject?.reference?.replace(/^urn:uuid:/, "");
  const patientName = report.subject?.display ?? patientId ?? "—";
  const encounterId =
    report._encounterId ??
    report.encounter?.reference?.replace(/^urn:uuid:/, "");

  let noteText: string | null = null;
  const form = report.presentedForm?.[0];
  if (form?.data) {
    try {
      noteText = atob(form.data);
    } catch {
      noteText = "(Unable to decode note content)";
    }
  }

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "Report ID", value: report.id, mono: true },
    {
      label: "Status",
      value: (
        <Chip
          label={report.status ?? "—"}
          size="small"
          color={statusColor(report.status)}
        />
      ),
    },
    { label: "Category", value: category },
    { label: "Report", value: codeName },
    {
      label: "Patient",
      value: patientId ? (
        <Link to={`/patient/${patientId}`} style={{ color: "inherit" }}>
          {patientName}
        </Link>
      ) : (
        patientName
      ),
    },
    {
      label: "Encounter",
      value: encounterId ? (
        <Link to={`/encounter/${encounterId}`} style={{ color: "inherit" }}>
          {encounterId}
        </Link>
      ) : (
        "—"
      ),
    },
    { label: "Effective", value: fmt(report.effectiveDateTime) },
    { label: "Issued", value: fmt(report.issued) },
    { label: "Performer", value: report.performer?.[0]?.display ?? "—" },
  ];

  return (
    <Box sx={{ p: 3, mt: 2 }}>
      <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        &larr; Back
      </Button>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Diagnostic Report
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {codeName}
      </Typography>

      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table sx={{ minWidth: 500 }}>
          <TableHead sx={{ backgroundColor: "primary.main" }}>
            <TableRow>
              <TableCell sx={{ color: "white", fontWeight: 600, width: "28%" }}>
                Property
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: 600 }}>
                Value
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ fontWeight: 500, color: "text.secondary" }}>
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

      {noteText && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {form?.title ?? "Clinical Note"}
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box
              component="pre"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.8rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 500,
                overflowY: "auto",
                m: 0,
              }}
            >
              {noteText}
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
