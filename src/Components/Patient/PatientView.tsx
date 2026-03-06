import { useState, useEffect, lazy, Suspense } from "react";
import {
  Box,
  Paper,
  Typography,
  Alert,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  InputAdornment,
  IconButton,
  Skeleton,
} from "@mui/material";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import Grid from "@mui/material/Grid";
import Avatar from "boring-avatars";
import type { PatientResource, FhirExtension } from "../../types/fhir";
import PatientEncountersPanel, {
  type ResourceGroup,
} from "./PatientEncountersPanel";
import {
  buildGroups,
  type ObsGroup,
} from "../AdditionalResources/observationGroupUtils";

// ── Lazy-loaded sub-views ─────────────────────────────────────────────────────
// Downloaded only when the user navigates into that specific panel, keeping the
// initial patient-page bundle free of recharts and all 9 resource view modules.
const ObservationChartDialog = lazy(() =>
  import("../AdditionalResources/ObservationCharts").then((m) => ({
    default: m.ObservationChartDialog,
  })),
);
const DocumentReferenceView = lazy(
  () => import("../AdditionalResources/DocumentReferenceView"),
);
const ConditionView = lazy(
  () => import("../AdditionalResources/ConditionView"),
);
const DiagnosticReportView = lazy(
  () => import("../AdditionalResources/DiagnosticReportView"),
);
const ClaimsView = lazy(() => import("../AdditionalResources/ClaimsView"));
const EoBView = lazy(() => import("../AdditionalResources/EoBView"));
const ImmunizationView = lazy(
  () => import("../AdditionalResources/ImmunizationView"),
);
const ProcedureView = lazy(
  () => import("../AdditionalResources/ProcedureView"),
);
const ObservationView = lazy(
  () => import("../AdditionalResources/ObservationView"),
);
const MedicationRequestView = lazy(
  () => import("../AdditionalResources/MedicationRequestView"),
);
const BillingDashboard = lazy(() => import("./BillingDashboard"));
import { useParams, useNavigate } from "react-router-dom";
import { patientApi, observationApi } from "../../api/fhirApi";

interface PatientViewProps {
  /** identifier used to fetch the patient from the API */
  patientId?: string;
}

export default function PatientView({ patientId: propId }: PatientViewProps) {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const patientId = propId || params.id || "";
  const [patient, setPatient] = useState<PatientResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] =
    useState<ResourceGroup | null>(null);
  const [mainTab, setMainTab] = useState<"overview" | "billing">("overview");

  // Helper function to extract Patient resource from FHIR Bundle
  const extractPatientFromBundle = (
    data: Record<string, unknown>,
  ): PatientResource | null => {
    // If data already has resourceType: "Patient", return it directly
    if (data?.resourceType === "Patient") {
      return data as unknown as PatientResource;
    }

    // If it's a Bundle, drill into the entry array
    if (data?.resourceType === "Bundle" && Array.isArray(data.entry)) {
      const patientEntry = (data.entry as Record<string, unknown>[]).find(
        (entry) =>
          (entry?.resource as Record<string, unknown>)?.resourceType ===
          "Patient",
      );
      return (patientEntry?.resource as PatientResource) || null;
    }

    return null;
  };

  // Helper to extract race from extensions
  const getRace = (extensions: FhirExtension[] | undefined): string => {
    const raceExt = extensions?.find(
      (ext) =>
        ext.url ===
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
    );
    return (
      raceExt?.extension?.find((ext) => ext.url === "text")?.valueString ??
      "Not provided"
    );
  };

  // Helper to extract ethnicity from extensions
  const getEthnicity = (extensions: FhirExtension[] | undefined): string => {
    const ethnExt = extensions?.find(
      (ext) =>
        ext.url ===
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
    );
    return (
      ethnExt?.extension?.find((ext) => ext.url === "text")?.valueString ??
      "Not provided"
    );
  };

  // Helper to extract birth place from extensions
  const getBirthPlace = (extensions: FhirExtension[] | undefined): string => {
    const birthPlaceExt = extensions?.find(
      (ext) =>
        ext.url ===
        "http://hl7.org/fhir/StructureDefinition/patient-birthPlace",
    );
    if (!birthPlaceExt?.valueAddress) return "Not provided";
    const addr = birthPlaceExt.valueAddress;
    return `${addr.city}, ${addr.state} ${addr.country}`;
  };

  type FhirNameEntry = NonNullable<PatientResource["name"]>[number];

  // Helper to format name
  const formatName = (nameObj: FhirNameEntry | undefined): string => {
    if (!nameObj) return "Not provided";
    const prefix = nameObj.prefix?.join(" ") || "";
    const given = nameObj.given?.join(" ") || "";
    const family = nameObj.family || "";
    return `${prefix} ${given} ${family}`.trim();
  };

  type FhirTelecomEntry = NonNullable<PatientResource["telecom"]>[number];

  // Helper to get phone number
  const getPhone = (telecom: FhirTelecomEntry[] | undefined): string => {
    const phone = telecom?.find((t) => t.system === "phone");
    return phone?.value || "Not provided";
  };

  type FhirAddressEntry = NonNullable<PatientResource["address"]>[number];

  // Helper to format address
  const formatAddress = (address: FhirAddressEntry[] | undefined): string => {
    if (!address || address.length === 0) return "Not provided";
    const addr = address[0];
    const lines = [
      addr.line?.join(", ") || "",
      addr.city || "",
      [addr.state, addr.postalCode].filter(Boolean).join(" "),
      addr.country || "",
    ]
      .filter(Boolean)
      .join(", ");
    return lines || "Not provided";
  };

  type FhirIdentifierEntry = NonNullable<PatientResource["identifier"]>[number];

  // Helper to get identifier by type
  const getIdentifier = (
    identifiers: FhirIdentifierEntry[] | undefined,
    type: string,
  ): string => {
    const id = identifiers?.find(
      (i) => i.type?.text === type || i.system?.includes(type.toLowerCase()),
    );
    return id?.value || "Not provided";
  };

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        setLoading(true);
        setError(null);
        const data: PatientResource = await patientApi.getById(patientId);
        const extractedPatient = extractPatientFromBundle(data);

        if (!extractedPatient) {
          throw new Error("Could not extract patient resource from response");
        }

        setPatient(extractedPatient);
      } catch (err: unknown) {
        console.error(err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [patientId]);

  if (loading) {
    return (
      <Box sx={{ p: 3, mt: 2 }}>
        {/* Back button */}
        <Skeleton variant="rounded" width={110} height={36} sx={{ mb: 2 }} />

        {/* Avatar + name header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Skeleton variant="circular" width={80} height={80} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="35%" height={48} />
          </Box>
        </Box>

        {/* Tab toggle */}
        <Skeleton variant="rounded" width={200} height={36} sx={{ mb: 3 }} />

        {/* Grid: sidebar + main table */}
        <Grid container spacing={3} alignItems="flex-start">
          {/* Sidebar skeleton */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Skeleton
                variant="text"
                width="60%"
                height={28}
                sx={{ mb: 1.5 }}
              />
              {Array.from({ length: 8 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    py: 0.75,
                  }}
                >
                  <Skeleton variant="text" width="55%" height={20} />
                  <Skeleton variant="text" width="20%" height={20} />
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Main table skeleton */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper variant="outlined">
              {/* Table header */}
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  px: 2,
                  py: 1.5,
                  backgroundColor: "primary.main",
                  borderRadius: "4px 4px 0 0",
                }}
              >
                <Skeleton
                  variant="text"
                  width="28%"
                  height={22}
                  sx={{ bgcolor: "primary.light" }}
                />
                <Skeleton
                  variant="text"
                  width="50%"
                  height={22}
                  sx={{ bgcolor: "primary.light" }}
                />
              </Box>
              {/* Table rows */}
              {Array.from({ length: 10 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    gap: 2,
                    px: 2,
                    py: 1.25,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Skeleton variant="text" width="28%" height={20} />
                  <Skeleton
                    variant="text"
                    width={`${35 + (i % 4) * 12}%`}
                    height={20}
                  />
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!patient) {
    return null; // should not happen once loading completes
  }

  const displayName = (formatName(patient.name?.[0]) || `Patient/${patient.id}`)
    .split(" ")
    .map((w) => w.replace(/\d+/g, ""))
    .filter(Boolean)
    .join(" ");

  const tableRows = [
    { label: "ID", value: patient.id },
    {
      label: "Gender",
      value: patient.gender
        ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
        : "Not provided",
    },
    { label: "Birth Date", value: patient.birthDate || "Not provided" },
    {
      label: "Marital Status",
      value: patient.maritalStatus?.text || "Not provided",
    },
    { label: "Phone", value: getPhone(patient.telecom) },
    { label: "Address", value: formatAddress(patient.address) },
    { label: "Race", value: getRace(patient.extension) },
    { label: "Ethnicity", value: getEthnicity(patient.extension) },
    { label: "Birth Place", value: getBirthPlace(patient.extension) },
    {
      label: "Language",
      value: patient.communication?.[0]?.language?.text || "Not provided",
    },
    {
      label: "Social Security Number",
      value: getIdentifier(patient.identifier, "Social Security Number"),
    },
    {
      label: "Driver's License",
      value: getIdentifier(patient.identifier, "Driver's license number"),
    },
    {
      label: "Passport",
      value: getIdentifier(patient.identifier, "Passport Number"),
    },
    {
      label: "Medical Record Number",
      value: getIdentifier(patient.identifier, "Medical Record Number"),
    },
  ];
  return (
    <Box sx={{ p: 3, mt: 2 }}>
      <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        &larr; Back to search
      </Button>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Avatar size={80} name={displayName} />
        <Box>
          <Typography variant="h4" fontWeight={600}>
            {displayName}
          </Typography>
        </Box>
      </Box>

      {/* ── Main tab toggle ── */}
      <ToggleButtonGroup
        value={mainTab}
        exclusive
        onChange={(_e, val) => {
          if (val) {
            setMainTab(val);
            setSelectedResource(null);
          }
        }}
        size="small"
        sx={{ mb: 3 }}
      >
        <ToggleButton value="overview">
          <PersonIcon fontSize="small" sx={{ mr: 0.75 }} />
          Overview
        </ToggleButton>
        <ToggleButton value="billing">
          <AttachMoneyIcon fontSize="small" sx={{ mr: 0.75 }} />
          Billing
        </ToggleButton>
      </ToggleButtonGroup>

      {/* ── Billing dashboard (full-width) ── */}
      {mainTab === "billing" && (
        <Suspense
          fallback={
            <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
              <CircularProgress />
            </Box>
          }
        >
          <BillingDashboard patientId={patientId} />
        </Suspense>
      )}

      {/* ── Overview: sidebar + main content ── */}
      {mainTab === "overview" && (
        <Grid container spacing={3} alignItems="flex-start">
          {/* ── Sidebar ── */}
          <Grid size={{ xs: 12, md: 4 }}>
            <PatientEncountersPanel
              patientId={patientId}
              onSelectResource={setSelectedResource}
            />
          </Grid>

          {/* ── Main content: resource list or patient details ── */}
          <Grid size={{ xs: 12, md: 8 }}>
            {selectedResource ? (
              <ResourceListView
                key={selectedResource.config.resourceType}
                group={selectedResource}
                patientId={patientId}
                onBack={() => setSelectedResource(null)}
              />
            ) : (
              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 500 }}>
                  <TableHead sx={{ backgroundColor: "primary.main" }}>
                    <TableRow>
                      <TableCell
                        sx={{ fontWeight: 600, width: "28%", color: "white" }}
                      >
                        Property
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "white" }}>
                        Value
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row, index) => (
                      <TableRow key={index} hover>
                        <TableCell
                          sx={{ fontWeight: 500, color: "text.secondary" }}
                        >
                          {row.label}
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily:
                                row.label.includes("ID") ||
                                row.label.includes("Number") ||
                                row.label.includes("License")
                                  ? "monospace"
                                  : "inherit",
                            }}
                          >
                            {row.value}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

// ── Map from FHIR resourceType → embeddable view component ───────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const INLINE_VIEWS: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<any>>
> = {
  DocumentReference: DocumentReferenceView,
  Condition: ConditionView,
  DiagnosticReport: DiagnosticReportView,
  Claim: ClaimsView,
  ExplanationOfBenefit: EoBView,
  Immunization: ImmunizationView,
  Procedure: ProcedureView,
  Observation: ObservationView,
  MedicationRequest: MedicationRequestView,
};

// ── Resource list sub-view (mirrors EncounterView's ResourceListView) ──────────
const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

function ResourceListView({
  group,
  patientId,
  onBack,
}: {
  group: ResourceGroup;
  patientId: string;
  onBack: () => void;
}) {
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(0);
  const [obsGroups, setObsGroups] = useState<Map<string, ObsGroup>>(new Map());
  const [chartTarget, setChartTarget] = useState<ObsGroup | null>(null);
  const [chartLoaded, setChartLoaded] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const navigate = useNavigate();

  const isObservations = group.config.resourceType === "Observation";
  const hasInlineView = group.config.resourceType in INLINE_VIEWS;

  // Fetch & build observation groups once when viewing the Observations list
  useEffect(() => {
    if (!isObservations || !patientId) return;
    observationApi
      .search(new URLSearchParams({ patient: patientId, _count: "2000" }))
      .then((bundle) => {
        const obs =
          bundle.entry?.map(
            (e: {
              resource: {
                code?: { coding?: { code?: string }[]; text?: string };
                [key: string]: unknown;
              };
            }) => e.resource,
          ) ?? [];
        const groups = buildGroups(obs);
        // Key by LOINC code OR code.text to match against list items
        const map = new Map<string, ObsGroup>();
        for (const g of groups) {
          map.set(g.key, g);
        }
        setObsGroups(map);
      })
      .catch(() => {
        /* best-effort */
      });
  }, [isObservations, patientId]);

  const { config, items } = group;

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filteredItems = items.filter((item) => {
    const label = config.getLabel(item).toLowerCase();
    const rawDate = config.getDate(item);
    const itemDate = rawDate ? new Date(rawDate) : null;

    if (search && !label.includes(search.toLowerCase())) return false;
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!itemDate || itemDate < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (!itemDate || itemDate > to) return false;
    }
    return true;
  });

  const hasFilters = search !== "" || dateFrom !== "" || dateTo !== "";
  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  // Clamp page to valid range when filters shrink the result set
  const safePage =
    filteredItems.length === 0
      ? 0
      : Math.min(page, Math.floor((filteredItems.length - 1) / PAGE_SIZE));

  const pageItems = filteredItems.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  // ── Inline detail panel ───────────────────────────────────────────────────
  const InlineView = selectedItemId ? INLINE_VIEWS[config.resourceType] : null;

  if (InlineView && selectedItemId) {
    return (
      <Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setSelectedItemId(null)}
          sx={{ mb: 2 }}
        >
          ← Back to {config.label}
        </Button>
        <Suspense
          fallback={
            <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
              <CircularProgress />
            </Box>
          }
        >
          <InlineView resourceId={selectedItemId} patientId={patientId} />
        </Suspense>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Button size="small" variant="outlined" onClick={onBack}>
          ← Back to Patient
        </Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: 1 }}>
          {config.icon}
          <Typography variant="h6" fontWeight={600}>
            {config.label}
          </Typography>
          <Chip label={items.length} size="small" sx={{ ml: 0.5 }} />
          {hasFilters && (
            <Chip
              label={`${filteredItems.length} shown`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 0.5 }}
            />
          )}
        </Box>
      </Box>

      {/* ── Filter bar ── */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "center",
        }}
      >
        <TextField
          size="small"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: "1 1 180px", minWidth: 160 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch("")}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        <TextField
          size="small"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          sx={{ width: 155 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          sx={{ width: 155 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {hasFilters && (
          <Button size="small" variant="text" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </Paper>

      {/* List */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={{ backgroundColor: "primary.main" }}>
            <TableRow>
              <TableCell sx={{ color: "white", fontWeight: 600 }}>
                Name
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: 600, width: 140 }}>
                Date
              </TableCell>
              <TableCell
                sx={{
                  color: "white",
                  fontWeight: 600,
                  width: isObservations ? 160 : 80,
                }}
              />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  {hasFilters
                    ? "No results match your filters."
                    : `No ${config.label.toLowerCase()} found.`}
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((item) => {
                const label = config.getLabel(item);
                const date = fmtDate(config.getDate(item));
                // Match this row to a chart group by LOINC code or text
                const loincCode =
                  item.code?.coding?.[0]?.code ?? item.code?.text;
                const chartGroup = loincCode
                  ? obsGroups.get(loincCode)
                  : undefined;
                const hasChart = chartGroup && chartGroup.points.length > 0;
                return (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2">{label}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {date}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                          justifyContent: "flex-end",
                        }}
                      >
                        {hasChart && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            onClick={() => {
                              setChartLoaded(true);
                              setChartTarget(chartGroup);
                            }}
                          >
                            View Chart
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="text"
                          onClick={() =>
                            hasInlineView
                              ? setSelectedItemId(item.id)
                              : navigate(`${group.config.viewPath}/${item.id}`)
                          }
                        >
                          View
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {filteredItems.length > PAGE_SIZE && (
          <TablePagination
            component="div"
            count={filteredItems.length}
            page={safePage}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        )}
      </TableContainer>

      {chartLoaded && (
        <Suspense fallback={null}>
          <ObservationChartDialog
            group={chartTarget}
            onClose={() => setChartTarget(null)}
          />
        </Suspense>
      )}
    </Box>
  );
}
