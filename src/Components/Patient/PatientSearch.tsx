import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import SearchIcon from "@mui/icons-material/Search";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SearchResults from "./SearchResults";
import type { Patient } from "./patientTypes";
import SavedSearchBar from "../MainSearch/SavedSearchBar";
import { useSavedSearches } from "../../hooks/useSavedSearches";
import type { PatientSearchParams } from "../../hooks/useSavedSearches";
import { useAuth } from "../../context/AuthContext";

export default function PatientSearch() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useState<PatientSearchParams>({
    name: "",
    familyName: "",
    givenName: "",
    gender: "",
    birthDate: "",
    phone: "",
    address: "",
  });

  const { searches, save, remove, rename, MAX_SAVED } = useSavedSearches(
    "patient",
    user?.email,
  );
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [serverOffset, setServerOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const FETCH_SIZE = 50;
  const DISPLAY_SIZE = 25;

  const buildPatientParams = (offset: number) => {
    const params = new URLSearchParams();
    params.append("_count", String(FETCH_SIZE));
    params.append("_offset", String(offset));
    if (searchParams.name) params.append("name", searchParams.name);
    if (searchParams.familyName)
      params.append("family", searchParams.familyName);
    if (searchParams.givenName) params.append("given", searchParams.givenName);
    if (searchParams.gender) params.append("gender", searchParams.gender);
    if (searchParams.birthDate)
      params.append("birthdate", searchParams.birthDate);
    if (searchParams.phone) params.append("phone", searchParams.phone);
    if (searchParams.address) params.append("address", searchParams.address);
    return params;
  };

  const fetchPatientPage = async (offset: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5001/fhir/Patient?${buildPatientParams(offset).toString()}`,
      );
      if (!response.ok) throw new Error("Search request failed");
      const bundle = await response.json();
      const results: Patient[] = (bundle.entry ?? []).map(
        (e: { resource: Patient }) => e.resource,
      );
      setFilteredPatients(results);
      setTotal(bundle.total ?? results.length);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to search patients");
    } finally {
      setLoading(false);
    }
  };

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
    setPage(0);
    setServerOffset(0);
    await fetchPatientPage(0);
  };

  const handleClear = () => {
    setSearchParams({
      name: "",
      familyName: "",
      givenName: "",
      gender: "",
      birthDate: "",
      phone: "",
      address: "",
    } satisfies PatientSearchParams);
    setFilteredPatients([]);
    setTotal(null);
    setSearched(false);
    setPage(0);
    setServerOffset(0);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* ── Saved searches ── */}
      <SavedSearchBar
        searches={searches}
        maxSaved={MAX_SAVED}
        currentParams={searchParams}
        onLoad={(params) => setSearchParams(params as PatientSearchParams)}
        onSave={save}
        onDelete={remove}
        onRename={rename}
      />
      <Box component="form" onSubmit={handleSearch} noValidate>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={{ xs: 12, sm: 6 }}>
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
          <Grid size={{ xs: 12, sm: 6 }}>
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
            size={{ xs: 12, sm: 6 }}
            sx={{ display: "flex", alignItems: "flex-end", gap: 2 }}
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
            <Button
              fullWidth
              variant="outlined"
              sx={{ height: "56px" }}
              disabled={loading}
              onClick={handleClear}
            >
              Clear
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
          <SearchResults
            patients={filteredPatients.slice(
              page * DISPLAY_SIZE - serverOffset,
              page * DISPLAY_SIZE - serverOffset + DISPLAY_SIZE,
            )}
            total={total}
            page={page}
            pageSize={DISPLAY_SIZE}
            onPageChange={async (_e: unknown, newPage: number) => {
              setPage(newPage);
              const nextServerOffset = serverOffset + FETCH_SIZE;
              const firstPageOfNextBatch = Math.floor(
                nextServerOffset / DISPLAY_SIZE,
              );
              if (newPage === firstPageOfNextBatch) {
                setServerOffset(nextServerOffset);
                await fetchPatientPage(nextServerOffset);
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
}
