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
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";

import type {
  FhirCoding,
  ImmunizationResource,
} from "./additionalResourceTypes";

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

export default function ImmunizationView({
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

  const [immunization, setImmunization] = useState<ImmunizationResource | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`http://localhost:5001/fhir/Immunization/${id}`);
        if (!r.ok)
          throw new Error(
            r.status === 404 ? "Immunization not found" : "Failed to fetch",
          );
        setImmunization(await r.json());
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
  if (!immunization) return null;

  const vaccineName =
    immunization.vaccineCode?.text ??
    immunization.vaccineCode?.coding?.[0]?.display ??
    "Immunization";

  const patientId =
    patientIdFromQuery ??
    immunization._patientId ??
    immunization.patient?.reference?.replace(/^urn:uuid:/, "");
  const patientName = immunization.patient?.display ?? patientId ?? "—";

  const encounterId =
    encounterIdFromQuery ??
    immunization.encounter?.reference?.replace(/^urn:uuid:/, "");

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "Immunization ID", value: immunization.id, mono: true },
    {
      label: "Status",
      value: (
        <Chip
          label={immunization.status ?? "—"}
          size="small"
          color={immunization.status === "completed" ? "success" : "default"}
        />
      ),
    },
    { label: "Vaccine", value: vaccineName },
    {
      label: "CVX Code",
      value: immunization.vaccineCode?.coding?.[0]?.code ?? "—",
    },
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
    { label: "Date Given", value: fmt(immunization.occurrenceDateTime) },
    {
      label: "Primary Source",
      value: (
        <Chip
          label={immunization.primarySource ? "Yes" : "No"}
          size="small"
          color={immunization.primarySource ? "success" : "default"}
        />
      ),
    },
    { label: "Location", value: immunization.location?.display ?? "—" },
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
        Immunization
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {vaccineName}
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
