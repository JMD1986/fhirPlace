import { useFHIRResource } from "../../hooks/useFHIRResource";
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
  Skeleton,
  Divider,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";

import type { DiagnosticReportResource } from "../../types/fhir";
import { diagReportApi } from "../../api/fhirApi";
import { useNLMLoinc } from "../../hooks/useNLMClinicalTables";

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

export default function DiagnosticReportView({
  resourceId: propId,
  patientId: propPatientId,
}: { resourceId?: string; patientId?: string } = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId ?? paramId;
  const embedded = propId !== undefined;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const encounterIdFromQuery = searchParams.get("encounterId") ?? undefined;
  const patientIdFromQuery =
    propPatientId ?? searchParams.get("patientId") ?? undefined;
  const {
    data: report,
    loading,
    error,
  } = useFHIRResource(id, diagReportApi.getById);

  // NLM LOINC lookup — fires once report is loaded
  const loincCode = report?.code?.coding?.find(
    (c) => c.system === "http://loinc.org" || !c.system,
  )?.code;
  const reportFallbackName =
    report?.code?.text ?? report?.code?.coding?.[0]?.display;
  const nlmLoinc = useNLMLoinc(loincCode, reportFallbackName);

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
    patientIdFromQuery ??
    report._patientId ??
    report.subject?.reference?.replace(/^urn:uuid:/, "");
  const patientName = report.subject?.display ?? patientId ?? "—";
  const encounterId =
    encounterIdFromQuery ??
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
      {!embedded && (
        <Button
          onClick={() =>
            navigate(encounterId ? `/encounter/${encounterId}` : "/")
          }
          sx={{ mb: 2 }}
        >
          &larr; Back to Encounter
        </Button>
      )}
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

      {/* ── NLM LOINC Panel ──────────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <ScienceIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            LOINC Panel Details
          </Typography>
          <Typography variant="caption" color="text.secondary">
            via NLM Clinical Tables
          </Typography>
        </Box>

        {nlmLoinc.loading && (
          <Box>
            <Skeleton width="55%" sx={{ mb: 1 }} />
            <Skeleton width="40%" sx={{ mb: 1 }} />
            <Skeleton width="30%" />
          </Box>
        )}

        {!nlmLoinc.loading && !nlmLoinc.component && (
          <Typography variant="body2" color="text.secondary">
            No LOINC details found for this report code.
          </Typography>
        )}

        {!nlmLoinc.loading && nlmLoinc.component && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {/* LOINC number + full name */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              {nlmLoinc.loincNum && (
                <Chip
                  label={`LOINC ${nlmLoinc.loincNum}`}
                  size="small"
                  variant="outlined"
                />
              )}
              <Typography variant="body1" fontWeight={500}>
                {nlmLoinc.component}
              </Typography>
              {nlmLoinc.shortName &&
                nlmLoinc.shortName !== nlmLoinc.component && (
                  <Typography variant="body2" color="text.secondary">
                    ({nlmLoinc.shortName})
                  </Typography>
                )}
            </Box>

            {/* Metadata chips row */}
            {(nlmLoinc.orderObs ||
              nlmLoinc.method ||
              nlmLoinc.loincClass ||
              nlmLoinc.exampleUnits) && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {nlmLoinc.orderObs && (
                  <Chip
                    label={
                      nlmLoinc.orderObs === "Both"
                        ? "Order & Obs"
                        : nlmLoinc.orderObs
                    }
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
                {nlmLoinc.method && (
                  <Chip
                    label={`Method: ${nlmLoinc.method}`}
                    size="small"
                    variant="outlined"
                  />
                )}
                {nlmLoinc.loincClass && (
                  <Chip
                    label={nlmLoinc.loincClass}
                    size="small"
                    variant="outlined"
                  />
                )}
                {nlmLoinc.exampleUnits && (
                  <Chip
                    label={`Units: ${nlmLoinc.exampleUnits}`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            )}

            {/* Description */}
            {nlmLoinc.description && (
              <>
                <Divider />
                <Typography variant="body2" color="text.secondary">
                  {nlmLoinc.description}
                </Typography>
              </>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
