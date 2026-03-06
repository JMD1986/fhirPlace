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
} from "@mui/material";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";

import { procedureApi } from "../../api/fhirApi";

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
  if (status === "completed") return "success";
  if (status === "in-progress") return "warning";
  if (status === "not-done" || status === "stopped") return "error";
  return "default";
};

export default function ProcedureView({
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
    data: procedure,
    loading,
    error,
  } = useFHIRResource(id, procedureApi.getById);

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
  if (!procedure) return null;

  const procedureName =
    procedure.code?.text ?? procedure.code?.coding?.[0]?.display ?? "Procedure";
  const snomedCode = procedure.code?.coding?.[0]?.code;

  const patientId =
    patientIdFromQuery ??
    procedure._patientId ??
    procedure.subject?.reference?.replace(/^urn:uuid:/, "");
  const patientName = procedure.subject?.display ?? patientId ?? "—";

  const encounterId =
    encounterIdFromQuery ??
    procedure.encounter?.reference?.replace(/^urn:uuid:/, "");

  const performedStart =
    procedure.performedPeriod?.start ?? procedure.performedDateTime;
  const performedEnd = procedure.performedPeriod?.end;

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "Procedure ID", value: procedure.id, mono: true },
    {
      label: "Status",
      value: (
        <Chip
          label={procedure.status ?? "—"}
          size="small"
          color={statusColor(procedure.status)}
        />
      ),
    },
    { label: "Procedure", value: procedureName },
    { label: "SNOMED Code", value: snomedCode ?? "—" },
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
    { label: "Start", value: fmt(performedStart) },
    { label: "End", value: fmt(performedEnd) },
    {
      label: "Duration",
      value: formatDuration(performedStart, performedEnd),
    },
    { label: "Location", value: procedure.location?.display ?? "—" },
    ...(procedure.reasonCode && procedure.reasonCode.length > 0
      ? [
          {
            label: "Reason",
            value: (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {procedure.reasonCode.map((rc, i) => (
                  <Chip
                    key={i}
                    label={rc.text ?? rc.coding?.[0]?.display ?? "—"}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Box>
            ),
          },
        ]
      : []),
  ];

  return (
    <Box sx={{ p: 3, mt: 2 }}>
      {!embedded && (
        <Button
          onClick={() =>
            navigate(
              encounterIdFromQuery
                ? `/encounter/${encounterIdFromQuery}`
                : patientId
                  ? `/patient/${patientId}`
                  : "/",
            )
          }
          sx={{ mb: 2 }}
        >
          &larr; Back to {encounterIdFromQuery ? "Encounter" : "Patient"}
        </Button>
      )}

      <Typography variant="h5" fontWeight={600} gutterBottom>
        Procedure
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {procedureName}
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
    </Box>
  );
}
