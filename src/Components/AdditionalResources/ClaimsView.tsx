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

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}
interface ClaimItem {
  sequence?: number;
  productOrService?: { text?: string; coding?: FhirCoding[] };
  net?: { value?: number; currency?: string };
  quantity?: { value?: number };
  unitPrice?: { value?: number; currency?: string };
}
interface ClaimResource {
  resourceType: "Claim";
  id: string;
  status?: string;
  use?: string;
  type?: { text?: string; coding?: FhirCoding[] };
  patient?: { reference?: string; display?: string };
  billablePeriod?: { start?: string; end?: string };
  created?: string;
  provider?: { display?: string };
  facility?: { display?: string };
  insurance?: { coverage?: { display?: string } }[];
  item?: ClaimItem[];
  total?: { value?: number; currency?: string };
  _patientId?: string;
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

const currency = (val?: number, cur?: string) =>
  val !== undefined ? `${cur ?? "USD"} ${val.toFixed(2)}` : "—";

export default function ClaimsView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const encounterIdFromQuery = searchParams.get("encounterId") ?? undefined;
  const patientIdFromQuery = searchParams.get("patientId") ?? undefined;
  const [claim, setClaim] = useState<ClaimResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`http://localhost:5001/fhir/Claim/${id}`);
        if (!r.ok)
          throw new Error(
            r.status === 404 ? "Claim not found" : "Failed to fetch",
          );
        setClaim(await r.json());
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
  if (!claim) return null;

  const claimType = claim.type?.coding?.[0]?.code ?? claim.type?.text ?? "—";
  const patientId =
    patientIdFromQuery ??
    claim._patientId ??
    claim.patient?.reference?.replace(/^urn:uuid:/, "");
  const patientName = claim.patient?.display ?? patientId ?? "—";

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: "Claim ID", value: claim.id, mono: true },
    {
      label: "Status",
      value: (
        <Chip
          label={claim.status ?? "—"}
          size="small"
          color={claim.status === "active" ? "success" : "default"}
        />
      ),
    },
    { label: "Use", value: claim.use ?? "—" },
    { label: "Type", value: claimType },
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
    { label: "Created", value: fmt(claim.created) },
    { label: "Period Start", value: fmt(claim.billablePeriod?.start) },
    { label: "Period End", value: fmt(claim.billablePeriod?.end) },
    { label: "Provider", value: claim.provider?.display ?? "—" },
    { label: "Facility", value: claim.facility?.display ?? "—" },
    {
      label: "Insurance",
      value: claim.insurance?.[0]?.coverage?.display ?? "—",
    },
    {
      label: "Total",
      value: currency(claim.total?.value, claim.total?.currency),
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
        Claim
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {claimType} — {claim.billablePeriod?.start?.slice(0, 10)}
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

      {(claim.item ?? []).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Line Items
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
                <TableRow>
                  {["#", "Service", "Qty", "Unit Price", "Net"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(claim.item ?? []).map((item, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{item.sequence ?? i + 1}</TableCell>
                    <TableCell>
                      {item.productOrService?.text ??
                        item.productOrService?.coding?.[0]?.display ??
                        "—"}
                    </TableCell>
                    <TableCell>{item.quantity?.value ?? 1}</TableCell>
                    <TableCell>
                      {currency(
                        item.unitPrice?.value,
                        item.unitPrice?.currency,
                      )}
                    </TableCell>
                    <TableCell>
                      {currency(item.net?.value, item.net?.currency)}
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
