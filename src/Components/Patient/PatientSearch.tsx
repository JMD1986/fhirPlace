import { usePatientSearch } from "../../hooks/usePatientSearch";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { useSessionState } from "../../hooks/useSessionState";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import SearchIcon from "@mui/icons-material/Search";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SearchResults from "./SearchResults";
import type { Patient } from "../../types/fhir";
import SavedSearchBar from "../MainSearch/SavedSearchBar";
import { useSavedSearches } from "../../hooks/useSavedSearches";
// import { patientApi } from "../../api/fhirApi";
import type { PatientSearchParams } from "../../hooks/hookTypes";
import { useAuth } from "../../context/AuthContext";

  const { user } = useAuth();
  const EMPTY_PATIENT_PARAMS: PatientSearchParams = {
    name: "",
    familyName: "",
    givenName: "",
    gender: "",
    birthDate: "",
    phone: "",
    address: "",
  };
  // Session state for search params
  const [searchParams, setSearchParams, clearSearchParams] =
    useSessionState<PatientSearchParams>("patientSearch", EMPTY_PATIENT_PARAMS);

  // Saved searches
  const { searches, save, remove, rename, MAX_SAVED } = useSavedSearches(
    "patient",
    user?.email,
  );

  // Patient search logic (custom hook)
  const {
    filteredPatients,
    setFilteredPatients,
    loading,
    error,
    searched,
    setSearched,
    page,
    setPage,
    serverOffset,
    setServerOffset,
    total,
    setTotal,
    handleChange,
    handleSearch,
    handleClear,
    fetchPatientPage,
    prefetchNextBatch,
    DISPLAY_SIZE,
    FETCH_SIZE,
    prefetchedBatchRef,
  } = usePatientSearch();

  // Keep searchParams in sync with session state
  const handleSessionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e);
    setSearchParams((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Wrap handleClear to also clear session state
  const handleClearAll = () => {
    clearSearchParams();
    handleClear();
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
              onChange={handleSessionChange}
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
              onChange={handleSessionChange}
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
              onChange={handleSessionChange}
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
              onChange={handleSessionChange}
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
              onChange={handleSessionChange}
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
              onChange={handleSessionChange}
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
              onClick={handleClearAll}
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

      {!searched && !loading && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          Search to get started
        </Typography>
      )}

      {searched && !loading && filteredPatients.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          No patients found
        </Typography>
      )}

      {searched && !loading && filteredPatients.length > 0 && (
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
                const prefetched = prefetchedBatchRef.current;
                if (prefetched && prefetched.offset === nextServerOffset) {
                  setFilteredPatients(prefetched.patients);
                  setTotal(prefetched.total);
                  setServerOffset(nextServerOffset);
                  prefetchedBatchRef.current = null;
                  if (prefetched.total > nextServerOffset + FETCH_SIZE) {
                    prefetchNextBatch(nextServerOffset + FETCH_SIZE);
                  }
                } else {
                  setServerOffset(nextServerOffset);
                  await fetchPatientPage(nextServerOffset);
                }
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
}
