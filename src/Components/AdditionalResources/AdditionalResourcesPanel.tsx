import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Divider,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import MedicalInformationIcon from "@mui/icons-material/MedicalInformation";
import ScienceIcon from "@mui/icons-material/Science";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import VaccinesIcon from "@mui/icons-material/Vaccines";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import { Link } from "react-router-dom";

// ── Types ──────────────────────────────────────────────────────────────────────
interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface AnyResource {
  resourceType: string;
  id: string;
  // DocumentReference
  type?: { text?: string; coding?: FhirCoding[] };
  date?: string;
  // Condition
  code?: { text?: string; coding?: FhirCoding[] };
  onsetDateTime?: string;
  recordedDate?: string;
  // DiagnosticReport
  effectiveDateTime?: string;
  status?: string;
  // Claim / EOB
  created?: string;
  billablePeriod?: { start?: string; end?: string };
  use?: string;
  // Immunization
  vaccineCode?: { text?: string; coding?: FhirCoding[] };
  occurrenceDateTime?: string;
  // Procedure
  performedPeriod?: { start?: string; end?: string };
  performedDateTime?: string;
}

interface FhirBundle {
  resourceType: "Bundle";
  total: number;
  entry?: { resource: AnyResource }[];
}

// ── Config: one entry per resource type ───────────────────────────────────────
interface ResourceTypeConfig {
  resourceType: string;
  label: string;
  route: string;
  viewPath: string;
  icon: React.ReactNode;
  getLabel: (r: AnyResource) => string;
  getDate: (r: AnyResource) => string | null | undefined;
}

const RESOURCE_TYPES: ResourceTypeConfig[] = [
  {
    resourceType: "DocumentReference",
    label: "Documents",
    route: "DocumentReference",
    viewPath: "/document",
    icon: <DescriptionIcon fontSize="small" color="action" />,
    getLabel: (r) => r.type?.text ?? r.type?.coding?.[0]?.display ?? "Document",
    getDate: (r) => r.date,
  },
  {
    resourceType: "Condition",
    label: "Conditions",
    route: "Condition",
    viewPath: "/condition",
    icon: <MedicalInformationIcon fontSize="small" color="action" />,
    getLabel: (r) =>
      r.code?.text ?? r.code?.coding?.[0]?.display ?? "Condition",
    getDate: (r) => r.onsetDateTime ?? r.recordedDate,
  },
  {
    resourceType: "DiagnosticReport",
    label: "Diagnostic Reports",
    route: "DiagnosticReport",
    viewPath: "/diagnostic-report",
    icon: <ScienceIcon fontSize="small" color="action" />,
    getLabel: (r) =>
      r.type?.text ??
      r.type?.coding?.[0]?.display ??
      r.code?.text ??
      r.code?.coding?.[0]?.display ??
      "Report",
    getDate: (r) => r.effectiveDateTime ?? r.date,
  },
  {
    resourceType: "Claim",
    label: "Claims",
    route: "Claim",
    viewPath: "/claim",
    icon: <ReceiptIcon fontSize="small" color="action" />,
    getLabel: (r) => `Claim (${r.use ?? r.status ?? "—"})`,
    getDate: (r) => r.created ?? r.billablePeriod?.start,
  },
  {
    resourceType: "ExplanationOfBenefit",
    label: "Explanations of Benefit",
    route: "ExplanationOfBenefit",
    viewPath: "/explanation-of-benefit",
    icon: <AccountBalanceIcon fontSize="small" color="action" />,
    getLabel: (r) => `EOB (${r.use ?? r.status ?? "\u2014"})`,
    getDate: (r) => r.created ?? r.billablePeriod?.start,
  },
  {
    resourceType: "Immunization",
    label: "Immunizations",
    route: "Immunization",
    viewPath: "/immunization",
    icon: <VaccinesIcon fontSize="small" color="action" />,
    getLabel: (r) =>
      r.vaccineCode?.text ??
      r.vaccineCode?.coding?.[0]?.display ??
      "Immunization",
    getDate: (r) => r.occurrenceDateTime ?? r.date,
  },
  {
    resourceType: "Procedure",
    label: "Procedures",
    route: "Procedure",
    viewPath: "/procedure",
    icon: <MedicalServicesIcon fontSize="small" color="action" />,
    getLabel: (r) =>
      r.code?.text ?? r.code?.coding?.[0]?.display ?? "Procedure",
    getDate: (r) => r.performedPeriod?.start ?? r.performedDateTime ?? r.date,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatDate = (iso?: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  encounterId: string;
  patientId?: string;
}

interface ResourceGroup {
  config: ResourceTypeConfig;
  items: AnyResource[];
}

export default function AdditionalResourcesPanel({
  encounterId,
  patientId,
}: Props) {
  const [groups, setGroups] = useState<ResourceGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!encounterId) return;
    setGroups([]);

    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const results = await Promise.all(
          RESOURCE_TYPES.map(async (cfg) => {
            const res = await fetch(
              `http://localhost:5001/fhir/${cfg.route}?encounter=${encounterId}`,
            );
            if (!res.ok) return { config: cfg, items: [] };
            const bundle: FhirBundle = await res.json();
            return {
              config: cfg,
              items: bundle.entry?.map((e) => e.resource) ?? [],
            };
          }),
        );

        setGroups(results.filter((g) => g.items.length > 0));
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [encounterId]);

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Box>
      {/* Panel header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          backgroundColor: "primary.main",
          borderRadius: "4px 4px 0 0",
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} color="white">
          Additional Resources
        </Typography>
        {!loading && !error && (
          <Typography
            variant="caption"
            color="primary.contrastText"
            sx={{ opacity: 0.8 }}
          >
            {totalCount} resource{totalCount !== 1 ? "s" : ""} linked
          </Typography>
        )}
      </Box>

      {/* Body */}
      <Box
        sx={{
          border: 1,
          borderColor: "divider",
          borderTop: 0,
          borderRadius: "0 0 4px 4px",
        }}
      >
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ m: 1 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && groups.length === 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2, py: 3, textAlign: "center" }}
          >
            No linked resources found for this encounter.
          </Typography>
        )}

        {!loading && !error && groups.length > 0 && (
          <List disablePadding>
            {groups.map((group, gi) => (
              <Box key={group.config.resourceType}>
                {gi > 0 && <Divider />}

                {/* Section header */}
                <Box
                  sx={{
                    px: 2,
                    py: 0.75,
                    backgroundColor: "grey.50",
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  {group.config.icon}
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                  >
                    {group.config.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ ml: "auto" }}
                  >
                    {group.items.length}
                  </Typography>
                </Box>

                {/* Items */}
                {group.items.map((item, ii) => {
                  const label = group.config.getLabel(item);
                  const dateStr = formatDate(group.config.getDate(item));

                  return (
                    <Box key={item.id}>
                      {ii > 0 && (
                        <Divider
                          variant="inset"
                          component="li"
                          sx={{ ml: 5 }}
                        />
                      )}
                      <ListItemButton
                        component={Link}
                        to={`${group.config.viewPath}/${item.id}?encounterId=${encounterId}${patientId ? `&patientId=${patientId}` : ""}`}
                        sx={{ py: 0.75 }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {group.config.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography
                              variant="body2"
                              sx={{ color: "primary.main", fontWeight: 400 }}
                              noWrap
                            >
                              {label}
                            </Typography>
                          }
                          secondary={dateStr}
                          secondaryTypographyProps={{ variant: "caption" }}
                        />
                      </ListItemButton>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}
