import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ClaimResource, EoBResource } from "../../types/fhir";
import { claimApi, eobApi } from "../../api/fhirApi";

// ── Types ─────────────────────────────────────────────────────────────────────
interface BillingDashboardProps {
  patientId: string;
}

interface MonthlyBucket {
  month: string;
  submitted: number;
  paid: number;
  claims: number;
}

interface PayerBreakdown {
  name: string;
  value: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#1976d2",
  "#388e3c",
  "#f57c00",
  "#7b1fa2",
  "#d32f2f",
  "#0288d1",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtUSD = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);

const shortMonth = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "2-digit", month: "short" });
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 160 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        mb={0.5}
      >
        {label}
      </Typography>
      {payload.map((p) => (
        <Box
          key={p.name}
          sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}
        >
          <Typography variant="body2" sx={{ color: p.color, fontWeight: 500 }}>
            {p.name}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {fmtUSD(p.value)}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  color = "primary.main",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          backgroundColor: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BillingDashboard({ patientId }: BillingDashboardProps) {
  const [claims, setClaims] = useState<ClaimResource[]>([]);
  const [eobs, setEobs] = useState<EoBResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setError(null);

    const fetchAll = async () => {
      try {
        const [claimBundle, eobBundle] = await Promise.all([
          claimApi.search(
            new URLSearchParams({ patient: patientId, _count: "500" }),
          ),
          eobApi.search(
            new URLSearchParams({ patient: patientId, _count: "500" }),
          ),
        ]);

        setClaims(
          (claimBundle.entry ?? []).map(
            (e: { resource: ClaimResource }) => e.resource,
          ),
        );
        setEobs(
          (eobBundle.entry ?? []).map(
            (e: { resource: EoBResource }) => e.resource,
          ),
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [patientId]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const { totalSubmitted, totalPaid, totalPayment, avgPerClaim } =
    useMemo(() => {
      const totalSubmitted = claims.reduce(
        (s, c) => s + (c.total?.value ?? 0),
        0,
      );

      const totalPaid = eobs.reduce((s, e) => {
        const benefit = e.total?.find(
          (t) =>
            t.category?.coding?.[0]?.code === "benefit" ||
            t.category?.coding?.[0]?.display?.toLowerCase().includes("benefit"),
        );
        return s + (benefit?.amount?.value ?? 0);
      }, 0);

      const totalPayment = eobs.reduce(
        (s, e) => s + (e.payment?.amount?.value ?? 0),
        0,
      );

      const avgPerClaim =
        claims.length > 0 ? totalSubmitted / claims.length : 0;

      return { totalSubmitted, totalPaid, totalPayment, avgPerClaim };
    }, [claims, eobs]);

  // ── Monthly cost over time (bar chart) ───────────────────────────────────
  const monthlyData = useMemo<MonthlyBucket[]>(() => {
    const buckets = new Map<string, MonthlyBucket>();

    for (const c of claims) {
      const date = c.billablePeriod?.start ?? c.created;
      if (!date) continue;
      const key = shortMonth(date);
      const existing = buckets.get(key) ?? {
        month: key,
        submitted: 0,
        paid: 0,
        claims: 0,
      };
      existing.submitted += c.total?.value ?? 0;
      existing.claims += 1;
      buckets.set(key, existing);
    }

    for (const e of eobs) {
      const date = e.billablePeriod?.start ?? e.created;
      if (!date) continue;
      const key = shortMonth(date);
      const existing = buckets.get(key) ?? {
        month: key,
        submitted: 0,
        paid: 0,
        claims: 0,
      };
      existing.paid += e.payment?.amount?.value ?? 0;
      buckets.set(key, existing);
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => {
        // Sort chronologically by parsing "Mon YY"
        const parse = (s: string) => new Date(`1 ${s}`);
        return parse(a).getTime() - parse(b).getTime();
      })
      .map(([, v]) => v);
  }, [claims, eobs]);

  // ── Cumulative spend line chart ───────────────────────────────────────────
  const cumulativeData = useMemo(() => {
    let runningSubmitted = 0;
    let runningPaid = 0;
    return monthlyData.map((d) => {
      runningSubmitted += d.submitted;
      runningPaid += d.paid;
      return {
        month: d.month,
        "Total Submitted": Math.round(runningSubmitted),
        "Total Paid": Math.round(runningPaid),
      };
    });
  }, [monthlyData]);

  // ── Payer breakdown (pie) ─────────────────────────────────────────────────
  const payerData = useMemo<PayerBreakdown[]>(() => {
    const map = new Map<string, number>();
    for (const c of claims) {
      const insurer = c.insurance?.[0]?.coverage?.display ?? "Unknown";
      map.set(insurer, (map.get(insurer) ?? 0) + (c.total?.value ?? 0));
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [claims]);

  // ── Top claim types ───────────────────────────────────────────────────────
  const claimTypeData = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const c of claims) {
      const type = c.type?.text ?? c.type?.coding?.[0]?.display ?? "Unknown";
      const existing = map.get(type) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += c.total?.value ?? 0;
      map.set(type, existing);
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 8)
      .map(([type, { count, total }]) => ({
        type,
        count,
        total: Math.round(total),
      }));
  }, [claims]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (claims.length === 0 && eobs.length === 0) {
    return (
      <Alert severity="info">No billing data found for this patient.</Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <AttachMoneyIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Billing Summary
        </Typography>
        <Chip
          label={`${claims.length} claims`}
          size="small"
          sx={{ ml: "auto" }}
        />
      </Box>

      {/* ── Stat cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<ReceiptIcon fontSize="small" />}
            label="Total Submitted"
            value={fmtUSD(totalSubmitted)}
            color="primary.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<AccountBalanceWalletIcon fontSize="small" />}
            label="Total Paid Out"
            value={fmtUSD(totalPayment)}
            color="#388e3c"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<AttachMoneyIcon fontSize="small" />}
            label="Benefit Amount"
            value={fmtUSD(totalPaid)}
            color="#f57c00"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<TrendingUpIcon fontSize="small" />}
            label="Avg Cost / Claim"
            value={fmtUSD(avgPerClaim)}
            color="#7b1fa2"
          />
        </Grid>
      </Grid>

      {/* ── Monthly bar chart ── */}
      {monthlyData.length > 1 && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            Monthly Billed vs. Paid
          </Typography>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={monthlyData}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e0e0e0"
              />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                width={52}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Legend />
              <Bar
                dataKey="submitted"
                name="Submitted"
                fill="#1976d2"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="paid"
                name="Paid"
                fill="#388e3c"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* ── Cumulative spend line chart ── */}
      {cumulativeData.length > 1 && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            Cumulative Spend Over Time
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={cumulativeData}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e0e0e0"
              />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                width={52}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="Total Submitted"
                stroke="#1976d2"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Total Paid"
                stroke="#388e3c"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* ── Payer breakdown + Claim types ── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Payer pie chart */}
        {payerData.length > 0 && (
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>
                Payer Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={payerData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({
                      name,
                      percent,
                    }: {
                      name?: string;
                      percent?: number;
                    }) =>
                      `${(name ?? "").length > 14 ? (name ?? "").slice(0, 14) + "\u2026" : (name ?? "")} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {payerData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) =>
                      fmtUSD(typeof value === "number" ? value : 0)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Claim type table */}
        {claimTypeData.length > 0 && (
          <Grid size={{ xs: 12, md: payerData.length > 0 ? 7 : 12 }}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>
                Claims by Type
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="center">
                        Count
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">
                        Total Billed
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {claimTypeData.map((row) => (
                      <TableRow key={row.type} hover>
                        <TableCell>
                          <Typography variant="body2">{row.type}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={row.count}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600}>
                            {fmtUSD(row.total)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* ── Recent claims ── */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>
          Recent Claims
        </Typography>
        <Divider sx={{ mb: 1.5 }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Provider</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Submitted
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Status
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claims
                .slice()
                .sort((a, b) => {
                  const da = a.billablePeriod?.start ?? a.created ?? "";
                  const db = b.billablePeriod?.start ?? b.created ?? "";
                  return db.localeCompare(da);
                })
                .slice(0, 10)
                .map((c) => {
                  const date = c.billablePeriod?.start ?? c.created;
                  return (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {date
                            ? new Date(date).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {c.type?.text ?? c.type?.coding?.[0]?.display ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {c.provider?.display ?? c.facility?.display ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>
                          {c.total?.value !== undefined
                            ? fmtUSD(c.total.value)
                            : "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={c.status ?? "unknown"}
                          size="small"
                          color={c.status === "active" ? "success" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
