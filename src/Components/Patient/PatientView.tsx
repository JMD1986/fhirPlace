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
  TablePagination,
  Chip,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import Avatar from "boring-avatars";
import type { PatientResource, FhirExtension } from "./patientTypes";
import PatientEncountersPanel, {
  type ResourceGroup,
} from "./PatientEncountersPanel";
import {
  buildGroups,
  type ObsGroup,
} from "../AdditionalResources/observationGroupUtils";
import { ObservationChartDialog } from "../AdditionalResources/ObservationCharts";
import DocumentReferenceView from "../AdditionalResources/DocumentReferenceView";
import ConditionView from "../AdditionalResources/ConditionView";
import DiagnosticReportView from "../AdditionalResources/DiagnosticReportView";
import ClaimsView from "../AdditionalResources/ClaimsView";
import EoBView from "../AdditionalResources/EoBView";
import ImmunizationView from "../AdditionalResources/ImmunizationView";
import ProcedureView from "../AdditionalResources/ProcedureView";
import ObservationView from "../AdditionalResources/ObservationView";
import MedicationRequestView from "../AdditionalResources/MedicationRequestView";
import { useParams, useNavigate } from "react-router-dom";

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
    console.log("Fetching patient with ID:", patientId);
    const fetchPatient = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `http://localhost:5001/fhir/Patient/${patientId}`,
        );
        console.log("Fetch response:", res);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Patient not found");
          }
          throw new Error("Failed to fetch patient");
        }
        const data: PatientResource = await res.json();
        console.log("Fetched raw data:", data);

        const extractedPatient = extractPatientFromBundle(data);
        console.log("Extracted patient:", extractedPatient);

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
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress />
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

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Avatar size={80} name={displayName} />
        <Typography variant="h4" fontWeight={600}>
          {displayName}
        </Typography>
      </Box>

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
    </Box>
  );
}

// ── Map from FHIR resourceType → embeddable view component ───────────────────
const INLINE_VIEWS: Record<
  string,
  React.ComponentType<{ resourceId?: string; patientId?: string }>
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const isObservations = group.config.resourceType === "Observation";

  // Fetch & build observation groups once when viewing the Observations list
  useEffect(() => {
    if (!isObservations || !patientId) return;
    fetch(
      `http://localhost:5001/fhir/Observation?patient=${patientId}&_count=2000`,
    )
      .then((r) => r.json())
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
  const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

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
        <InlineView resourceId={selectedItemId} patientId={patientId} />
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
        </Box>
      </Box>

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
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  No {config.label.toLowerCase()} found.
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
                            onClick={() => setChartTarget(chartGroup)}
                          >
                            View Chart
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => setSelectedItemId(item.id)}
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
        {items.length > PAGE_SIZE && (
          <TablePagination
            component="div"
            count={items.length}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        )}
      </TableContainer>

      <ObservationChartDialog
        group={chartTarget}
        onClose={() => setChartTarget(null)}
      />
    </Box>
  );
}
