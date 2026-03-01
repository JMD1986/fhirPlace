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
  family?: string;
  given?: string;
  gender?: string;
  birthDate?: string;
  maritalStatus?: string;
  phone?: string;
  address?: string;
  race?: string;
  ethnicity?: string;
  birthPlace?: string;
  language?: string;
  ssn?: string;
  mrn?: string;
  filename: string;
  resourceType: string;
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

  // Load initial patient list so results table has content before a query
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          "http://localhost:5000/api/patients?_count=100",
        );
        if (!response.ok) throw new Error("Failed to fetch patients");
        const patients = await response.json();
        setFilteredPatients(patients); // display all when component mounts
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
      if (searchParams.name) params.append("name", searchParams.name);
      if (searchParams.familyName)
        params.append("family", searchParams.familyName);
      if (searchParams.givenName)
        params.append("given", searchParams.givenName);
      if (searchParams.gender) params.append("gender", searchParams.gender);
      if (searchParams.birthDate)
        params.append("birthDate", searchParams.birthDate);
      if (searchParams.phone) params.append("phone", searchParams.phone);
      if (searchParams.address) params.append("address", searchParams.address);

      const url = `http://localhost:5000/api/patients${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Search request failed");
      const results = await response.json();
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
