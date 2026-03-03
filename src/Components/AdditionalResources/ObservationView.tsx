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
import type { ObservationResource } from "./additionalResourceTypes";

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
  if (s === "final") return "success";
  if (s === "preliminary") return "warning";
  if (s === "cancelled" || s === "entered-in-error") return "error";
  return "default";
};

const getCategory = (obs: ObservationResource) =>
  obs.category?.[0]?.coding?.[0]?.display ??
  obs.category?.[0]?.coding?.[0]?.code ??
  "—";

const getValue = (obs: ObservationResource): string => {
  if (obs.valueQuantity?.value !== undefined) {
    const val = obs.valueQuantity.value;
    const unit = obs.valueQuantity.unit ?? "";
    return unit ? `${val} ${unit}` : String(val);
  }
  if (obs.valueString) return obs.valueString;
  if (obs.valueCodeableConcept)
    return (
      obs.valueCodeableConcept.text ??
      obs.valueCodeableConcept.coding?.[0]?.display ??
      "—"
    );
  return "—";
};

export default function ObservationView({
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

  const [observation, setObservation] = useState<ObservationResource | null>(
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
        const r = await fetch(`http://localhost:5001/fhir/Observation/${id}`);
        if (!r.ok)
          throw new Error(
            r.status === 404 ? "Observation not found" : "Failed to fetch",
          );
        setObservation(await r.json());
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
  if (!observation) return null;

  const obsName =
    observation.code?.text ??
    observation.code?.coding?.[0]?.display ??
    "Observation";

  const patientId =
    patientIdFromQuery ??
    observation._patientId ??
    observation.subject?.reference?.replace(/^urn:uuid:/, "");

  const encounterId =
    encounterIdFromQuery ??
    observation.encounter?.reference?.replace(/^urn:uuid:/, "");

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      {/* Back nav */}
      {!embedded && (
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Button variant="outlined" size="small" onClick={() => navigate(-1)}>
            ← Back
          </Button>
          {encounterId && (
            <Button
              variant="outlined"
              size="small"
              component={Link}
              to={`/encounter/${encounterId}`}
            >
              View Encounter
            </Button>
          )}
          {patientId && (
            <Button
              variant="outlined"
              size="small"
              component={Link}
              to={`/patient/${patientId}`}
            >
              View Patient
            </Button>
          )}
        </Box>
      )}

      <Paper variant="outlined" sx={{ p: 3 }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 3,
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={600}>
              {obsName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getCategory(observation)}
            </Typography>
          </Box>
          <Chip
            label={observation.status ?? "unknown"}
            color={statusColor(observation.status)}
            size="small"
          />
        </Box>

        {/* Details table */}
        <TableContainer>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: 180 }}>
                  Value
                </TableCell>
                <TableCell>
                  <Typography fontWeight={500}>
                    {getValue(observation)}
                  </Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Effective</TableCell>
                <TableCell>{fmt(observation.effectiveDateTime)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Issued</TableCell>
                <TableCell>{fmt(observation.issued)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>LOINC Code</TableCell>
                <TableCell>
                  {observation.code?.coding?.[0]?.code ?? "—"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Interpretation</TableCell>
                <TableCell>
                  {observation.interpretation?.[0]?.coding?.[0]?.display ??
                    observation.interpretation?.[0]?.coding?.[0]?.code ??
                    "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Components (e.g. blood pressure systolic/diastolic) */}
        {observation.component && observation.component.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Components
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "primary.main" }}>
                    {["Name", "Value"].map((h) => (
                      <TableCell
                        key={h}
                        sx={{ color: "white", fontWeight: 600 }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {observation.component.map((c, i) => {
                    const name =
                      c.code?.text ??
                      c.code?.coding?.[0]?.display ??
                      `Component ${i + 1}`;
                    const val =
                      c.valueQuantity?.value !== undefined
                        ? `${c.valueQuantity.value}${c.valueQuantity.unit ? ` ${c.valueQuantity.unit}` : ""}`
                        : (c.valueString ?? "—");
                    return (
                      <TableRow key={i}>
                        <TableCell>{name}</TableCell>
                        <TableCell>{val}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
