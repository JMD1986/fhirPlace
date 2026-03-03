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
  TableRow,
  Chip,
} from "@mui/material";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import type { MedicationRequestResource } from "./additionalResourceTypes";

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
  if (s === "active") return "success";
  if (s === "on-hold") return "warning";
  if (s === "stopped" || s === "cancelled" || s === "entered-in-error")
    return "error";
  return "default";
};

export default function MedicationRequestView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const encounterIdFromQuery = searchParams.get("encounterId") ?? undefined;
  const patientIdFromQuery = searchParams.get("patientId") ?? undefined;

  const [med, setMed] = useState<MedicationRequestResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(
          `http://localhost:5001/fhir/MedicationRequest/${id}`,
        );
        if (!r.ok)
          throw new Error(
            r.status === 404
              ? "Medication request not found"
              : "Failed to fetch",
          );
        setMed(await r.json());
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
  if (!med) return null;

  const medName =
    med.medicationCodeableConcept?.text ??
    med.medicationCodeableConcept?.coding?.[0]?.display ??
    "Medication";

  const patientId =
    patientIdFromQuery ??
    med._patientId ??
    med.subject?.reference?.replace(/^urn:uuid:/, "");

  const encounterId =
    encounterIdFromQuery ?? med.encounter?.reference?.replace(/^urn:uuid:/, "");

  const dosage = med.dosageInstruction?.[0]?.text ?? "—";
  const rxCode = med.medicationCodeableConcept?.coding?.[0]?.code;

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      {/* Back nav */}
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
              {medName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {med.intent ?? "order"}
            </Typography>
          </Box>
          <Chip
            label={med.status ?? "unknown"}
            color={statusColor(med.status)}
            size="small"
          />
        </Box>

        {/* Details table */}
        <TableContainer>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: 180 }}>
                  Authored On
                </TableCell>
                <TableCell>{fmt(med.authoredOn)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Requester</TableCell>
                <TableCell>{med.requester?.display ?? "—"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Dosage</TableCell>
                <TableCell>{dosage}</TableCell>
              </TableRow>
              {rxCode && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>RxNorm Code</TableCell>
                  <TableCell>{rxCode}</TableCell>
                </TableRow>
              )}
              {med.reasonCode && med.reasonCode.length > 0 && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {med.reasonCode.map((rc, i) => (
                        <Chip
                          key={i}
                          label={rc.text ?? rc.coding?.[0]?.display ?? "—"}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
