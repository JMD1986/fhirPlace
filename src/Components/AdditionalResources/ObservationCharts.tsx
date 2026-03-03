import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { ObservationResource } from "./additionalResourceTypes";
import { buildGroups, fmtObsDate } from "./observationGroupUtils";
import type { ObsGroup } from "./observationGroupUtils";

export type { ObsGroup };

// ── Colours cycling for multi-line charts (e.g. blood pressure) ───────────────
const LINE_COLORS = ["#1976d2", "#d32f2f", "#388e3c", "#f57c00", "#7b1fa2"];

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 140 }}>
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
            {p.value}
            {unit ? ` ${unit}` : ""}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

// ── Single group card ─────────────────────────────────────────────────────────
function ObsGroupCard({ group }: { group: ObsGroup }) {
  const hasChart = group.points.length >= 1;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {group.name}
        </Typography>
        {group.unit && (
          <Chip label={group.unit} size="small" variant="outlined" />
        )}
        <Chip
          label={`${group.points.length + group.nonNumeric.length} readings`}
          size="small"
          sx={{ ml: "auto" }}
        />
      </Box>

      {/* Chart */}
      {hasChart && (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={group.points}
            margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => String(v)}
            />
            <Tooltip content={<ChartTooltip unit={group.unit} />} />
            {group.series.length > 1 && (
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            )}
            {group.series.map((s, i) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                name={s}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Non-numeric readings summary */}
      {group.nonNumeric.length > 0 && (
        <>
          {hasChart && <Divider sx={{ my: 1.5 }} />}
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            mb={0.75}
          >
            Non-numeric readings
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {group.nonNumeric.map((obs) => {
              const val =
                obs.valueString ??
                obs.valueCodeableConcept?.text ??
                obs.valueCodeableConcept?.coding?.[0]?.display ??
                "—";
              return (
                <Chip
                  key={obs.id}
                  label={`${fmtObsDate(obs.effectiveDateTime)}: ${val}`}
                  size="small"
                  variant="outlined"
                />
              );
            })}
          </Box>
        </>
      )}

      {/* No data at all */}
      {!hasChart && group.nonNumeric.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No plottable values found.
        </Typography>
      )}
    </Paper>
  );
}

// ── Dialog wrapper for a single group's chart ───────────────────────────────
export function ObservationChartDialog({
  group,
  onClose,
}: {
  group: ObsGroup | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={group !== null}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            {group?.name ?? ""}
          </Typography>
          {group?.unit && (
            <Chip label={group.unit} size="small" variant="outlined" />
          )}
        </Box>
        <IconButton onClick={onClose} size="small" edge="end">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        {group && <ObsGroupCard group={group} />}
      </DialogContent>
    </Dialog>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
interface Props {
  patientId: string;
}

export default function ObservationCharts({ patientId }: Props) {
  const [observations, setObservations] = useState<ObservationResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `http://localhost:5001/fhir/Observation?patient=${patientId}&_count=2000`,
        );
        if (!res.ok) throw new Error("Failed to fetch observations");
        const bundle = await res.json();
        const obs: ObservationResource[] =
          bundle.entry?.map(
            (e: { resource: ObservationResource }) => e.resource,
          ) ?? [];
        setObservations(obs);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  const groups = useMemo(() => buildGroups(observations), [observations]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (groups.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
        No observations found for this patient.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {observations.length} observations across {groups.length} measurement
        type
        {groups.length !== 1 ? "s" : ""}
      </Typography>
      {groups.map((group) => (
        <ObsGroupCard key={group.key} group={group} />
      ))}
    </Box>
  );
}
