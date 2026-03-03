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
  Stack,
} from "@mui/material";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";

import type {
  FhirCoding,
  AdjudicationItem,
  EoBItem,
  EoBTotal,
  EoBResource,
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

const currency = (val?: number, cur?: string) =>
  val !== undefined ? `${cur ?? "USD"} ${val.toFixed(2)}` : "—";

const outcomeColor = (
  o?: string,
): "success" | "warning" | "error" | "default" => {
  if (o === "complete") return "success";
  if (o === "partial") return "warning";
  if (o === "error") return "error";
  return "default";
};

export default function EoBView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const encounterIdFromQuery = searchParams.get("encounterId") ?? undefined;
  const patientIdFromQuery = searchParams.get("patientId") ?? undefined;
  const [eob, setEob] = useState<EoBResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(
          `http://localhost:5001/fhir/ExplanationOfBenefit/${id}`,
        );
        if (!r.ok)
          throw new Error(
            r.status === 404 ? "EOB not found" : "Failed to fetch",
          );
        setEob(await r.json());
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
  if (!eob) return null;

  const eobType = eob.type?.coding?.[0]?.code ?? eob.type?.text ?? "—";
  const patientId =
    patientIdFromQuery ??
    eob._patientId ??
    eob.patient?.reference?.replace(/^urn:uuid:/, "");
  const patientName = eob.patient?.display ?? patientId ?? "—";
  const claimId = eob.claim?.reference?.replace(/^urn:uuid:/, "");

  const submitted = eob.total?.find(
    (t) => t.category?.coding?.[0]?.code === "submitted",
  );
  const benefit = eob.total?.find(
    (t) => t.category?.coding?.[0]?.code === "benefit",
  );

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "EOB ID", value: eob.id, mono: true },
    {
      label: "Status",
      value: (
        <Chip
          label={eob.status ?? "—"}
          size="small"
          color={eob.status === "active" ? "success" : "default"}
        />
      ),
    },
    {
      label: "Outcome",
      value: (
        <Chip
          label={eob.outcome ?? "—"}
          size="small"
          color={outcomeColor(eob.outcome)}
        />
      ),
    },
    { label: "Use", value: eob.use ?? "—" },
    { label: "Type", value: eobType },
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
    { label: "Created", value: fmt(eob.created) },
    { label: "Period Start", value: fmt(eob.billablePeriod?.start) },
    { label: "Period End", value: fmt(eob.billablePeriod?.end) },
    { label: "Insurer", value: eob.insurer?.display ?? "—" },
    { label: "Facility", value: eob.facility?.display ?? "—" },
    {
      label: "Claim",
      value: claimId ? (
        <Link to={`/claim/${claimId}`} style={{ color: "inherit" }}>
          {claimId}
        </Link>
      ) : (
        "—"
      ),
    },
    {
      label: "Submitted Amount",
      value: currency(submitted?.amount?.value, submitted?.amount?.currency),
    },
    {
      label: "Benefit Amount",
      value: currency(benefit?.amount?.value, benefit?.amount?.currency),
    },
    {
      label: "Payment",
      value: currency(
        eob.payment?.amount?.value,
        eob.payment?.amount?.currency,
      ),
    },
  ];

  return (
    <Box sx={{ p: 3, mt: 2 }}>
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
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Explanation of Benefit
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {eobType} — {eob.billablePeriod?.start?.slice(0, 10)}
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

      {(eob.item ?? []).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Line Items
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
                <TableRow>
                  {["#", "Service", "Net", "Adjudication"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(eob.item ?? []).map((item, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{item.sequence ?? i + 1}</TableCell>
                    <TableCell>
                      {item.productOrService?.text ??
                        item.productOrService?.coding?.[0]?.display ??
                        "—"}
                    </TableCell>
                    <TableCell>
                      {currency(item.net?.value, item.net?.currency)}
                    </TableCell>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {(item.adjudication ?? []).map((adj, ai) => {
                          const label =
                            adj.category?.coding?.[0]?.code ?? "adj";
                          const amt = adj.amount?.value;
                          return (
                            <Chip
                              key={ai}
                              label={`${label}${amt !== undefined ? `: ${amt.toFixed(2)}` : ""}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.7rem" }}
                            />
                          );
                        })}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}
