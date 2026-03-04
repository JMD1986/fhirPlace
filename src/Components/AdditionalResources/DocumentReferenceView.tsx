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

import type { DocRefResource } from "../../types/fhir";
import { documentReferenceApi } from "../../api/fhirApi";

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
): "success" | "warning" | "error" | "default" => {
  if (s === "current") return "success";
  if (s === "superseded") return "warning";
  if (s === "entered-in-error") return "error";
  return "default";
};

export default function DocumentReferenceView({
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
    data: doc,
    loading,
    error,
  } = useFHIRResource(id, documentReferenceApi.getById);

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
  if (!doc) return null;

  const title = doc.type?.text ?? doc.type?.coding?.[0]?.display ?? "Document";
  const category =
    doc.category?.[0]?.text ?? doc.category?.[0]?.coding?.[0]?.display;
  const encounterId =
    encounterIdFromQuery ??
    doc.context?.encounter?.[0]?.reference?.replace(/^urn:uuid:/, "");
  const patientId =
    patientIdFromQuery ??
    doc._patientId ??
    doc.subject?.reference?.replace(/^urn:uuid:/, "");

  const textContent = doc.content?.find((c) =>
    c.attachment?.contentType?.startsWith("text/plain"),
  );
  const noteText = textContent?.attachment?.data
    ? (() => {
        try {
          return atob(textContent.attachment!.data!);
        } catch {
          return null;
        }
      })()
    : null;

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "ID", value: doc.id, mono: true },
    {
      label: "Status",
      value: (
        <Chip
          label={doc.status ?? "—"}
          size="small"
          color={statusColor(doc.status)}
        />
      ),
    },
    { label: "Type", value: title },
    { label: "Category", value: category ?? "—" },
    { label: "Date", value: fmt(doc.date) },
    { label: "Author", value: doc.author?.[0]?.display ?? "—" },
    { label: "Custodian", value: doc.custodian?.display ?? "—" },
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
    {
      label: "Patient",
      value: patientId ? (
        <Link to={`/patient/${patientId}`} style={{ color: "inherit" }}>
          {patientId}
        </Link>
      ) : (
        "—"
      ),
    },
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
        {title}
      </Typography>
      {category && (
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
          {category}
        </Typography>
      )}

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
        <Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Clinical Note
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              backgroundColor: "grey.50",
              maxHeight: 600,
              overflowY: "auto",
            }}
          >
            <Typography
              component="pre"
              variant="body2"
              sx={{
                fontFamily: "inherit",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                m: 0,
              }}
            >
              {noteText}
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
