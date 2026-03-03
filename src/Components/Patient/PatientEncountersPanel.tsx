import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  ListItemButton,
} from "@mui/material";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import ScienceIcon from "@mui/icons-material/Science";
import EventIcon from "@mui/icons-material/Event";
import type {
  AnyResource,
  ResourceTypeConfig,
} from "../AdditionalResources/additionalResourceTypes";

export interface ResourceGroup {
  config: ResourceTypeConfig;
  items: AnyResource[];
}

interface Props {
  patientId: string;
  onSelectResource?: (group: ResourceGroup) => void;
}

const SUMMARY_RESOURCES: ResourceTypeConfig[] = [
  {
    resourceType: "Observation",
    label: "Observations",
    route: "Observation",
    viewPath: "/observation",
    icon: <MonitorHeartIcon fontSize="small" color="action" />,
    getLabel: (r) =>
      r.code?.text ?? r.code?.coding?.[0]?.display ?? "Observation",
    getDate: (r) => r.effectiveDateTime ?? null,
  },
  {
    resourceType: "Procedure",
    label: "Procedures",
    route: "Procedure",
    viewPath: "/procedure",
    icon: <MedicalServicesIcon fontSize="small" color="action" />,
    getLabel: (r) =>
      r.code?.text ?? r.code?.coding?.[0]?.display ?? "Procedure",
    getDate: (r) => r.performedPeriod?.start ?? r.performedDateTime ?? null,
  },
  {
    resourceType: "DiagnosticReport",
    label: "Diagnostic Reports",
    route: "DiagnosticReport",
    viewPath: "/diagnostic-report",
    icon: <ScienceIcon fontSize="small" color="action" />,
    getLabel: (r) => r.code?.text ?? r.code?.coding?.[0]?.display ?? "Report",
    getDate: (r) => r.effectiveDateTime ?? null,
  },
  {
    resourceType: "Encounter",
    label: "Encounters",
    route: "Encounter",
    viewPath: "/encounter",
    icon: <EventIcon fontSize="small" color="action" />,
    getLabel: (r) => {
      // Encounter.type is an array in FHIR — cast to access it
      const types = (
        r as unknown as {
          type?: { text?: string; coding?: { display?: string }[] }[];
        }
      ).type;
      const t = types?.[0];
      return t?.text ?? t?.coding?.[0]?.display ?? r.class?.code ?? "Encounter";
    },
    getDate: (r) => r.period?.start ?? null,
  },
];

// ── Panel shell ───────────────────────────────────────────────────────────────
function PanelShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          backgroundColor: "primary.main",
          borderRadius: "4px 4px 0 0",
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} color="white">
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="caption"
            color="primary.contrastText"
            sx={{ opacity: 0.8 }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          border: 1,
          borderColor: "divider",
          borderTop: 0,
          borderRadius: "0 0 4px 4px",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PatientEncountersPanel({
  patientId,
  onSelectResource,
}: Props) {
  const [summaries, setSummaries] = useState(
    SUMMARY_RESOURCES.map((r) => ({ config: r, total: null as number | null })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingRoute, setFetchingRoute] = useState<string | null>(null);

  const handleResourceClick = async (cfg: ResourceTypeConfig) => {
    if (!onSelectResource) return;
    setFetchingRoute(cfg.route);
    try {
      const res = await fetch(
        `http://localhost:5001/fhir/${cfg.route}?patient=${patientId}&_count=500`,
      );
      const bundle = await res.json();
      const items: AnyResource[] = (bundle.entry ?? []).map(
        (e: { resource: AnyResource }) => e.resource,
      );
      onSelectResource({ config: cfg, items });
    } catch {
      // silently ignore — user stays on current view
    } finally {
      setFetchingRoute(null);
    }
  };

  useEffect(() => {
    if (!patientId) return;
    setSummaries(SUMMARY_RESOURCES.map((r) => ({ config: r, total: null })));

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch resource totals in parallel — _count=1 to only get bundle.total.
        const totalBundles = await Promise.all(
          SUMMARY_RESOURCES.map((r) =>
            fetch(
              `http://localhost:5001/fhir/${r.route}?patient=${patientId}&_count=1`,
            ).then((res) => res.json()),
          ),
        );

        setSummaries(
          SUMMARY_RESOURCES.map((r, i) => ({
            config: r,
            total: totalBundles[i]?.total ?? null,
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [patientId]);

  if (loading) {
    return (
      <PanelShell title="Patient Summary">
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      </PanelShell>
    );
  }

  if (error) {
    return (
      <PanelShell title="Patient Summary">
        <Alert severity="error" sx={{ m: 1 }}>
          {error}
        </Alert>
      </PanelShell>
    );
  }

  return (
    <Box>
      {/* ── Top-3 resource summary ── */}
      <PanelShell title="Resource Summary">
        {summaries.map((s, i) => (
          <Box key={s.config.route}>
            {i > 0 && <Divider />}
            <ListItemButton
              onClick={() => handleResourceClick(s.config)}
              disabled={fetchingRoute === s.config.route}
              sx={{
                px: 2,
                py: 1.25,
                display: "flex",
                alignItems: "center",
                gap: 1,
                backgroundColor: "grey.50",
                cursor: onSelectResource ? "pointer" : "default",
              }}
            >
              {fetchingRoute === s.config.route ? (
                <CircularProgress size={16} sx={{ flexShrink: 0 }} />
              ) : (
                s.config.icon
              )}
              <Typography
                variant="body2"
                fontWeight={600}
                color={onSelectResource ? "primary.main" : "text.secondary"}
                sx={{ flexGrow: 1 }}
              >
                {s.config.label}
              </Typography>
              <Typography
                variant="caption"
                color="text.disabled"
                fontWeight={600}
              >
                {s.total !== null ? s.total.toLocaleString() : "—"}
              </Typography>
            </ListItemButton>
          </Box>
        ))}
      </PanelShell>
    </Box>
  );
}
