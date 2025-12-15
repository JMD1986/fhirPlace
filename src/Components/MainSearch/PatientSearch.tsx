import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import SearchIcon from "@mui/icons-material/Search";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SearchResults from "./SearchResults";

interface Patient {
  id: string;
  name: string;
  filename: string;
  resourceType: string;
}

export default function PatientSearch() {
  const [searchParams, setSearchParams] = useState({
    name: "",
    familyName: "",
    givenName: "",
  });
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Load all patients on component mount
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const response = await fetch("http://localhost:5000/api/patients");
        if (!response.ok) throw new Error("Failed to fetch patients");
        const patients = await response.json();
        setAllPatients(patients);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);

    // Filter patients based on search params
    const results = allPatients.filter((patient) => {
      const matchName =
        searchParams.name === "" ||
        patient.name.toLowerCase().includes(searchParams.name.toLowerCase());

      const matchFamily =
        searchParams.familyName === "" ||
        patient.filename
          .toLowerCase()
          .includes(searchParams.familyName.toLowerCase());

      const matchGiven =
        searchParams.givenName === "" ||
        patient.filename
          .toLowerCase()
          .includes(searchParams.givenName.toLowerCase());

      return matchName && matchFamily && matchGiven;
    });

    setFilteredPatients(results);
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
