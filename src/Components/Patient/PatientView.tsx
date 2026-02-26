import { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Grid,
  Button,
} from "@mui/material";

interface PatientResource {
  id: string;
  resourceType: string;
  name?: Array<{ text?: string }>; // simplified
  gender?: string;
  birthDate?: string;
  [key: string]: any; // allow other FHIR fields
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

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `http://localhost:5000/api/patients/${patientId}`,
        );
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Patient not found");
          }
          throw new Error("Failed to fetch patient");
        }
        const data: PatientResource = await res.json();
        setPatient(data);
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

  const displayName = patient.name?.[0]?.text || `Patient/${patient.id}`;

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Button onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        &larr; Back to search
      </Button>
      <Typography variant="h5" gutterBottom>
        {displayName}
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <Typography variant="subtitle2">ID</Typography>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {patient.id}
          </Typography>
        </Grid>
        {patient.gender && (
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2">Gender</Typography>
            <Typography variant="body2">{patient.gender}</Typography>
          </Grid>
        )}
        {patient.birthDate && (
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2">Birth Date</Typography>
            <Typography variant="body2">{patient.birthDate}</Typography>
          </Grid>
        )}
        {/* Additional fields can be added here as needed */}
      </Grid>
    </Paper>
  );
}
