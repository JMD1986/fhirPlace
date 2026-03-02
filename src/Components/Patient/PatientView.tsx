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
} from "@mui/material";
import Avatar from "boring-avatars";

interface PatientResource {
  id: string;
  resourceType: string;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    text?: string;
  }>;
  gender?: string;
  birthDate?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  maritalStatus?: { text?: string };
  identifier?: Array<{
    type?: { text?: string };
    value?: string;
    system?: string;
  }>;
  extension?: any[];
  communication?: Array<{
    language?: { text?: string };
  }>;
  [key: string]: unknown;
}

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

  // Helper function to extract Patient resource from FHIR Bundle
  const extractPatientFromBundle = (data: any): PatientResource | null => {
    // If data already has resourceType: "Patient", return it directly
    if (data?.resourceType === "Patient") {
      return data as PatientResource;
    }

    // If it's a Bundle, drill into the entry array
    if (data?.resourceType === "Bundle" && Array.isArray(data.entry)) {
      const patientEntry = data.entry.find(
        (entry: any) => entry?.resource?.resourceType === "Patient",
      );
      return patientEntry?.resource || null;
    }

    return null;
  };

  // Helper to extract race from extensions
  const getRace = (extensions: any[]): string => {
    const raceExt = extensions?.find(
      (ext: any) =>
        ext.url ===
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
    );
    return (
      raceExt?.extension?.find((ext: any) => ext.url === "text")?.valueString ||
      "Not provided"
    );
  };

  // Helper to extract ethnicity from extensions
  const getEthnicity = (extensions: any[]): string => {
    const ethnExt = extensions?.find(
      (ext: any) =>
        ext.url ===
        "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
    );
    return (
      ethnExt?.extension?.find((ext: any) => ext.url === "text")?.valueString ||
      "Not provided"
    );
  };

  // Helper to extract birth place from extensions
  const getBirthPlace = (extensions: any[]): string => {
    const birthPlaceExt = extensions?.find(
      (ext: any) =>
        ext.url ===
        "http://hl7.org/fhir/StructureDefinition/patient-birthPlace",
    );
    if (!birthPlaceExt?.valueAddress) return "Not provided";
    const addr = birthPlaceExt.valueAddress;
    return `${addr.city}, ${addr.state} ${addr.country}`;
  };

  // Helper to format name
  const formatName = (nameObj: any): string => {
    if (!nameObj) return "Not provided";
    const prefix = nameObj.prefix?.join(" ") || "";
    const given = nameObj.given?.join(" ") || "";
    const family = nameObj.family || "";
    return `${prefix} ${given} ${family}`.trim();
  };

  // Helper to get phone number
  const getPhone = (telecom: any[]): string => {
    const phone = telecom?.find((t: any) => t.system === "phone");
    return phone?.value || "Not provided";
  };

  // Helper to format address
  const formatAddress = (address: any[]): string => {
    if (!address || address.length === 0) return "Not provided";
    const addr = address[0];
    const lines = [
      addr.line?.join(", ") || "",
      addr.city || "",
      `${addr.state} ${addr.postalCode}` || "",
      addr.country || "",
    ]
      .filter(Boolean)
      .join(", ");
    return lines || "Not provided";
  };

  // Helper to get identifier by type
  const getIdentifier = (identifiers: any[], type: string): string => {
    const id = identifiers?.find(
      (i: any) =>
        i.type?.text === type || i.system?.includes(type.toLowerCase()),
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
  const getName = (patientName: string) => {
    const parts = patientName.split("_");
    if (parts.length < 2) return patientName;

    const firstName = parts[0].replace(/\d+/g, "");
    const lastName = parts[1].replace(/\d+/g, "");

    return `${firstName} ${lastName}`;
  };
  return (
    <Box sx={{ p: 3, mt: 2 }}>
      <Avatar size={300} />

      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        {displayName}
      </Typography>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: "25%" }}>
                Property
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows.map((row, index) => (
              <TableRow key={index} hover>
                <TableCell sx={{ fontWeight: 500, color: "text.secondary" }}>
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
      <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        &larr; Back to search
      </Button>
    </Box>
  );
}
