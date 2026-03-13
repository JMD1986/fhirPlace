import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  ListItemButton,
  Divider,
  Tooltip,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import DescriptionIcon from "@mui/icons-material/Description";
import MedicalInformationIcon from "@mui/icons-material/MedicalInformation";
import ScienceIcon from "@mui/icons-material/Science";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import VaccinesIcon from "@mui/icons-material/Vaccines";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import MedicationIcon from "@mui/icons-material/Medication";
import type { FhirBundle, ResourceTypeConfig } from "../../types/fhir";
import { fhirSearch } from "../../api/fhirApi";

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
  {
    resourceType: "Observation",
    label: "Observations",
    route: "Observation",
    viewPath: "/observation",
    icon: <MonitorHeartIcon fontSize="small" color="action" />,
    getLabel: (r) =>
      r.code?.text ?? r.code?.coding?.[0]?.display ?? "Observation",
    getDate: (r) => r.effectiveDateTime ?? r.date,
  },
  {
    resourceType: "MedicationRequest",
    label: "Medications",
    route: "MedicationRequest",
    viewPath: "/medication-request",
    icon: <MedicationIcon fontSize="small" color="action" />,
    getLabel: (r) =>
      r.medicationCodeableConcept?.text ??
      r.medicationCodeableConcept?.coding?.[0]?.display ??
      "Medication",
    getDate: (r) => r.authoredOn ?? r.date,
  },
];

// ── Props ──────────────────────────────────────────────────────────────────────
import type { ResourceGroup } from "../../types/fhir";
export type { ResourceGroup } from "../../types/fhir";

interface Props {
  encounterId: string;
  patientId?: string;
  onSelectGroup?: (group: ResourceGroup) => void;
}

export default function AdditionalResourcesPanel({
  encounterId,
  // patientId is part of the Props interface but not yet used in this view
  onSelectGroup,
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
            try {
              const bundle: FhirBundle = await fhirSearch(
                cfg.route,
                new URLSearchParams({ encounter: encounterId }),
              );
              return {
                config: cfg,
                items: bundle.entry?.map((e) => e.resource) ?? [],
              };
            } catch (err: unknown) {
              return {
                config: cfg,
                items: [],
                error: err instanceof Error ? err.message : "Failed to load",
              };
            }
          }),
        );

        // Keep groups that either loaded data or encountered an error so
        // failures are visible to the user rather than silently dropped.
        setGroups(results.filter((g) => g.items.length > 0 || !!g.error));
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
  const failedCount = groups.filter((g) => !!g.error).length;

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
        {!loading && !error && totalCount > 0 && (
          <Typography
            variant="caption"
            color="primary.contrastText"
            sx={{ opacity: 0.8 }}
          >
            {totalCount} resource{totalCount !== 1 ? "s" : ""} linked
            {failedCount > 0 &&
              `, ${failedCount} type${failedCount !== 1 ? "s" : ""} unavailable`}
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
          <Box>
            {groups.map((group, gi) => (
              <Box key={group.config.resourceType}>
                {gi > 0 && <Divider />}

                {group.error ? (
                  // ── Failed resource type row ──────────────────────────────
                  <Tooltip title={group.error} arrow placement="left">
                    <Box
                      sx={{
                        px: 2,
                        py: 1,
                        backgroundColor: "grey.50",
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        cursor: "help",
                        opacity: 0.65,
                      }}
                    >
                      {group.config.icon}
                      <Typography variant="body2" color="text.disabled">
                        {group.config.label}
                      </Typography>
                      <Box
                        sx={{
                          ml: "auto",
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <WarningAmberIcon
                          fontSize="small"
                          sx={{ color: "warning.main" }}
                        />
                        <Typography variant="caption" color="warning.main">
                          Failed to load
                        </Typography>
                      </Box>
                    </Box>
                  </Tooltip>
                ) : (
                  // ── Successful resource type row ──────────────────────────
                  <ListItemButton
                    onClick={
                      onSelectGroup ? () => onSelectGroup(group) : undefined
                    }
                    disableRipple={!onSelectGroup}
                    sx={{
                      px: 2,
                      py: 1,
                      backgroundColor: "grey.50",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      cursor: onSelectGroup ? "pointer" : "default",
                      "&:hover": onSelectGroup
                        ? { backgroundColor: "grey.200" }
                        : { backgroundColor: "grey.50" },
                    }}
                  >
                    {group.config.icon}
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={onSelectGroup ? "primary.main" : "text.secondary"}
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
                  </ListItemButton>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
