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
  Divider,
  Skeleton,
  Tooltip,
  LinearProgress,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BugReportIcon from "@mui/icons-material/BugReport";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import type { MedicationRequestResource } from "./additionalResourceTypes";
import { useOpenFDA } from "../../hooks/useOpenFDA";

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

export default function MedicationRequestView({
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

  const [med, setMed] = useState<MedicationRequestResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OpenFDA data — populated once med is loaded
  const rxcui = med?.medicationCodeableConcept?.coding?.[0]?.code;
  const medNameForFDA =
    med?.medicationCodeableConcept?.text ??
    med?.medicationCodeableConcept?.coding?.[0]?.display;
  const fda = useOpenFDA(rxcui, medNameForFDA);

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
              {rxcui && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>RxNorm Code</TableCell>
                  <TableCell>{rxcui}</TableCell>
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

      {/* ── OpenFDA Section ─────────────────────────────────────────── */}
      <FDAPanel drugName={medNameForFDA} rxcui={rxcui} fda={fda} />
    </Box>
  );
}

// ─── FDA Panel sub-component ──────────────────────────────────────────────────

import type { OpenFDAData } from "../../hooks/useOpenFDA";

function FDAPanel({
  drugName,
  rxcui,
  fda,
}: {
  drugName?: string;
  rxcui?: string;
  fda: OpenFDAData;
}) {
  if (!drugName && !rxcui) return null;

  const activeRecalls = fda.recalls.filter(
    (r) => r.status?.toLowerCase() === "ongoing",
  );
  const allRecalls = fda.recalls;

  const classColor = (cls?: string) => {
    if (cls === "Class I") return "error" as const;
    if (cls === "Class II") return "warning" as const;
    return "default" as const;
  };

  const genericName = drugName?.split(/\s+/)[0] ?? "";
  const fdaSearchUrl = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=&drugname=${encodeURIComponent(genericName)}`;

  return (
    <Paper variant="outlined" sx={{ p: 3, mt: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          FDA Safety Data
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {activeRecalls.length > 0 && (
            <Chip
              icon={<WarningAmberIcon />}
              label={`${activeRecalls.length} Active Recall${activeRecalls.length > 1 ? "s" : ""}`}
              color="error"
              size="small"
            />
          )}
          <Tooltip title="View on FDA.gov">
            <Chip
              icon={<OpenInNewIcon />}
              label="FDA Drug Database"
              component="a"
              href={fdaSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              size="small"
              variant="outlined"
            />
          </Tooltip>
        </Box>
      </Box>

      {fda.loading && (
        <Box sx={{ py: 2 }}>
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="rectangular" height={80} sx={{ mt: 1 }} />
        </Box>
      )}

      {fda.error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load FDA data: {fda.error}
        </Alert>
      )}

      {!fda.loading && !fda.error && (
        <>
          {/* ── Recalls ── */}
          {allRecalls.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <WarningAmberIcon fontSize="small" color="warning" />
                Recalls &amp; Enforcement Actions
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {allRecalls.map((recall) => (
                  <Box
                    key={recall.recall_number}
                    sx={{
                      p: 1.5,
                      border: 1,
                      borderColor:
                        recall.status?.toLowerCase() === "ongoing"
                          ? "error.main"
                          : "divider",
                      borderRadius: 1,
                      bgcolor:
                        recall.status?.toLowerCase() === "ongoing"
                          ? "error.50"
                          : "background.default",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 0.5,
                        flexWrap: "wrap",
                        gap: 0.5,
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ flex: 1, minWidth: 200 }}
                      >
                        {recall.product_description?.length > 100
                          ? recall.product_description.slice(0, 100) + "…"
                          : recall.product_description}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        <Chip
                          label={recall.status}
                          color={
                            recall.status?.toLowerCase() === "ongoing"
                              ? "error"
                              : "default"
                          }
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={recall.classification}
                          color={classColor(recall.classification)}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {recall.reason_for_recall?.length > 150
                        ? recall.reason_for_recall.slice(0, 150) + "…"
                        : recall.reason_for_recall}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Divider sx={{ mt: 2 }} />
            </Box>
          )}

          {allRecalls.length === 0 && !fda.loading && (
            <Alert severity="success" sx={{ mb: 2 }} icon={false}>
              ✅ No current FDA recalls found for this medication.
            </Alert>
          )}

          {/* ── Top Adverse Reactions ── */}
          {fda.topReactions.length > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <BugReportIcon fontSize="small" />
                Top Reported Adverse Reactions
                {fda.totalReports > 0 && (
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 0.5 }}
                  >
                    ({fda.totalReports.toLocaleString()} total FDA reports)
                  </Typography>
                )}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {fda.topReactions.map((rx, i) => {
                  const max = fda.topReactions[0]?.count ?? 1;
                  const pct = Math.round((rx.count / max) * 100);
                  return (
                    <Box key={i}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          mb: 0.25,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ textTransform: "capitalize" }}
                        >
                          {rx.term.toLowerCase()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {rx.count.toLocaleString()}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{ height: 6, borderRadius: 1 }}
                        color={i < 3 ? "warning" : "primary"}
                      />
                    </Box>
                  );
                })}
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1.5 }}
              >
                Source: FDA Adverse Event Reporting System (FAERS) · Data may
                include reports from all indications and patient populations.
              </Typography>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
