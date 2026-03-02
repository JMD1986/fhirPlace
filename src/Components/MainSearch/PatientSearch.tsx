import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import SearchIcon from "@mui/icons-material/Search";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SearchResults from "./SearchResults";

// Lean FHIR STU3 Patient resource (subset of fields we use in the UI)
interface FhirName {
  text?: string;
  family?: string;
  given?: string[];
}
interface FhirAddress {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}
interface FhirCommunication {
  language?: { text?: string; coding?: { display?: string }[] };
}
interface Patient {
  resourceType: "Patient";
  id: string;
  name?: FhirName[];
  gender?: string;
  birthDate?: string;
  address?: FhirAddress[];
  communication?: FhirCommunication[];
}

export default function PatientSearch() {
  const [searchParams, setSearchParams] = useState({
    name: "",
    familyName: "",
    givenName: "",
    gender: "",
    birthDate: "",
    phone: "",
    address: "",
  });
  // we'll only keep filteredPatients since search is performed server-side
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Load first page of patients on mount
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          "http://localhost:5001/fhir/Patient?_count=20",
        );
        if (!response.ok) throw new Error("Failed to fetch patients");
        const bundle = await response.json();
        const patients: Patient[] = (bundle.entry ?? []).map(
          (e: { resource: Patient }) => e.resource,
        );
        setFilteredPatients(patients);
        setError(null);
      } catch (err) {
        setError("Failed to load patients from server");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    setLoading(true);

    try {
      const params = new URLSearchParams();
      // always request all matches — pagination can be added later
      params.append("_count", "1000");
      if (searchParams.name) params.append("name", searchParams.name);
      if (searchParams.familyName)
        params.append("family", searchParams.familyName);
      if (searchParams.givenName)
        params.append("given", searchParams.givenName);
      if (searchParams.gender) params.append("gender", searchParams.gender);
      if (searchParams.birthDate)
        params.append("birthdate", searchParams.birthDate);
      if (searchParams.phone) params.append("phone", searchParams.phone);
      if (searchParams.address) params.append("address", searchParams.address);

      const url = `http://localhost:5001/fhir/Patient?${params.toString()}`;
      console.log("[PatientSearch] fetching:", url);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Search request failed");
      const bundle = await response.json();
      console.log(
        "[PatientSearch] bundle total:",
        bundle.total,
        "entries:",
        bundle.entry?.length,
      );
      const results: Patient[] = (bundle.entry ?? []).map(
        (e: { resource: Patient }) => e.resource,
      );
      setFilteredPatients(results);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to search patients");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box component="form" onSubmit={handleSearch} noValidate>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Patient Name"
              name="name"
              value={searchParams.name}
              onChange={handleChange}
              placeholder="Enter patient name"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Family Name"
              name="familyName"
              value={searchParams.familyName}
              onChange={handleChange}
              placeholder="Enter family name"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Given Name"
              name="givenName"
              value={searchParams.givenName}
              onChange={handleChange}
              placeholder="Enter given name"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Gender"
              name="gender"
              value={searchParams.gender}
              onChange={handleChange}
              placeholder="e.g. male, female"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Birth Date"
              name="birthDate"
              value={searchParams.birthDate}
              onChange={handleChange}
              placeholder="YYYY-MM-DD"
              variant="outlined"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Phone"
              name="phone"
              value={searchParams.phone}
              onChange={handleChange}
              placeholder="e.g. 555-123-4567"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Address"
              name="address"
              value={searchParams.address}
              onChange={handleChange}
              placeholder="City, state, or zip"
              variant="outlined"
            />
          </Grid>
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ display: "flex", alignItems: "flex-end" }}
          >
            <Button
              fullWidth
              variant="contained"
              color="primary"
              startIcon={<SearchIcon />}
              type="submit"
              sx={{ height: "56px" }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Search Patients"}
            </Button>
          </Grid>
        </Grid>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {searched && !loading && (
        <Box>
          <SearchResults patients={filteredPatients} />
        </Box>
      )}
    </Box>
  );
}
