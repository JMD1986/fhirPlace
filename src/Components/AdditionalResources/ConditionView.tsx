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
  Divider,
  Skeleton,
} from "@mui/material";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";

import type { ConditionResource } from "../../types/fhir";
import { conditionApi } from "../../api/fhirApi";
import { useNLMCondition } from "../../hooks/useNLMClinicalTables";

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

const clinicalColor = (
  code?: string,
): "success" | "warning" | "error" | "default" => {
  if (code === "active") return "error";
  if (code === "resolved" || code === "inactive") return "success";
  if (code === "recurrence" || code === "relapse") return "warning";
  return "default";
};

export default function ConditionView({
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
  const [condition, setCondition] = useState<ConditionResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NLM Clinical Tables — fires once condition is loaded
  const conditionDisplayName =
    condition?.code?.text ?? condition?.code?.coding?.[0]?.display;
  const nlm = useNLMCondition(conditionDisplayName);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setCondition(await conditionApi.getById(id));
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
  if (!condition) return null;

  const clinicalCode = condition.clinicalStatus?.coding?.[0]?.code;
  const verificationCode = condition.verificationStatus?.coding?.[0]?.code;
  const category =
    condition.category?.[0]?.coding?.[0]?.display ??
    condition.category?.[0]?.coding?.[0]?.code ??
    "—";
  const codeName =
    condition.code?.text ?? condition.code?.coding?.[0]?.display ?? "—";

  const patientId =
    patientIdFromQuery ??
    condition._patientId ??
    condition.subject?.reference?.replace(/^urn:uuid:/, "");
  const patientName = condition.subject?.display ?? patientId ?? "—";
  const encounterId =
    encounterIdFromQuery ??
    condition._encounterId ??
    condition.encounter?.reference?.replace(/^urn:uuid:/, "");

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "Condition ID", value: condition.id, mono: true },
    {
      label: "Clinical Status",
      value: (
        <Chip
          label={clinicalCode ?? "—"}
          size="small"
          color={clinicalColor(clinicalCode)}
        />
      ),
    },
    {
      label: "Verification Status",
      value: (
        <Chip
          label={verificationCode ?? "—"}
          size="small"
          color={verificationCode === "confirmed" ? "success" : "default"}
        />
      ),
    },
    { label: "Category", value: category },
    { label: "Condition", value: codeName },
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
    { label: "Onset", value: fmt(condition.onsetDateTime) },
    { label: "Recorded", value: fmt(condition.recordedDate) },
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
        Condition
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

      {/* ── NLM MedlinePlus Panel ─────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <LocalHospitalIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={600}>
            MedlinePlus / ICD-10 Info
          </Typography>
          <Typography variant="caption" color="text.secondary">
            via NLM Clinical Tables
          </Typography>
        </Box>

        {nlm.loading && (
          <Box>
            <Skeleton width="60%" sx={{ mb: 1 }} />
            <Skeleton width="40%" />
          </Box>
        )}

        {!nlm.loading && !nlm.consumerName && (
          <Typography variant="body2" color="text.secondary">
            No MedlinePlus entry found for this condition.
          </Typography>
        )}

        {!nlm.loading && nlm.consumerName && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Consumer Name:</strong> {nlm.consumerName}
            </Typography>

            {nlm.icd10Code && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>ICD-10 Code:</strong>{" "}
                <Chip label={nlm.icd10Code} size="small" variant="outlined" />
              </Typography>
            )}

            {nlm.medlinePlusUrl && (
              <Box sx={{ mt: 1.5 }}>
                <Divider sx={{ mb: 1.5 }} />
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon />}
                  href={nlm.medlinePlusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {nlm.medlinePlusLabel
                    ? `Read more: ${nlm.medlinePlusLabel}`
                    : "View on MedlinePlus"}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
