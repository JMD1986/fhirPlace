import { useEncounterSearch } from "../../hooks/useEncounterSearch";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { useSessionState } from "../../hooks/useSessionState";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SearchIcon from "@mui/icons-material/Search";
import Autocomplete from "@mui/material/Autocomplete";
import EncounterSearchResults from "./EncounterSearchResults";
import SavedSearchBar from "../MainSearch/SavedSearchBar";
import { useSavedSearches } from "../../hooks/useSavedSearches";
import type { EncounterSearchParams } from "../../hooks/hookTypes";
import { useAuth } from "../../context/AuthContext";

// ── Component ─────────────────────────────────────────────────────────────────
export default function EncounterSearch() {
  const { user } = useAuth();
  const EMPTY_ENCOUNTER_PARAMS: EncounterSearchParams = {
    patient: "",
    status: "",
    classCode: "",
    type: "",
    dateFrom: "",
    dateTo: "",
    reason: "",
  };
  // Session state for search params
  const [searchParams, setSearchParams, clearSearchParams] =
    useSessionState<EncounterSearchParams>(
      "encounterSearch",
      EMPTY_ENCOUNTER_PARAMS,
    );

  const { searches, save, remove, rename, MAX_SAVED } = useSavedSearches(
    "encounter",
    user?.email,
  );

  // Encounter search logic (custom hook)
  const {
    encounters,
    loading,
    error,
    searched,
    total,
    typeOptions,
    classOptions,
    snomedReasons,
    page,
    DISPLAY_SIZE,
    serverOffset,
    handleChange,
    handleSearch,
    handlePageChange,
    handleReset,
  } = useEncounterSearch(searchParams);

  // Keep searchParams in sync with session state
  const handleSessionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e);
    setSearchParams((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Wrap handleReset to also clear session state
  const handleClearAll = () => {
    clearSearchParams();
    handleReset();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* ── Saved searches ── */}
      <SavedSearchBar
        searches={searches}
        maxSaved={MAX_SAVED}
        currentParams={searchParams}
        onLoad={(params) => {
          setSearchParams(params as EncounterSearchParams);
        }}
        onSave={save}
        onDelete={remove}
        onRename={rename}
      />
      {/* ── Search Form ── */}
      <Box component="form" onSubmit={handleSearch} noValidate>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Patient ID"
              name="patient"
              value={searchParams.patient}
              onChange={handleSessionChange}
              placeholder="Enter patient UUID"
              variant="outlined"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                name="status"
                value={searchParams.status}
                onChange={(e) => {
                  setSearchParams((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }));
                  handleChange(
                    e as unknown as React.ChangeEvent<HTMLInputElement>,
                  );
                }}
              >
                <MenuItem value="">
                  <em>Any</em>
                </MenuItem>
                {[
                  "planned",
                  "arrived",
                  "triaged",
                  "in-progress",
                  "onleave",
                  "finished",
                  "cancelled",
                ].map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Class</InputLabel>
              <Select
                label="Class"
                name="classCode"
                value={searchParams.classCode}
                onChange={(e) => {
                  setSearchParams((prev) => ({
                    ...prev,
                    classCode: e.target.value,
                  }));
                  handleChange(
                    e as unknown as React.ChangeEvent<HTMLInputElement>,
                  );
                }}
              >
                <MenuItem value="">
                  <em>Any</em>
                </MenuItem>
                {classOptions.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Encounter Type</InputLabel>
              <Select
                label="Encounter Type"
                name="type"
                value={searchParams.type}
                onChange={(e) => {
                  setSearchParams((prev) => ({
                    ...prev,
                    type: e.target.value,
                  }));
                  handleChange(
                    e as unknown as React.ChangeEvent<HTMLInputElement>,
                  );
                }}
              >
                <MenuItem value="">
                  <em>Any</em>
                </MenuItem>
                {typeOptions.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Date From"
              name="dateFrom"
              value={searchParams.dateFrom}
              onChange={handleSessionChange}
              type="date"
              variant="outlined"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Date To"
              name="dateTo"
              value={searchParams.dateTo}
              onChange={handleSessionChange}
              type="date"
              variant="outlined"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Autocomplete
              options={snomedReasons}
              getOptionLabel={(o) => o.display}
              value={
                snomedReasons.find((r) => r.code === searchParams.reason) ??
                null
              }
              onChange={(
                _e: React.SyntheticEvent<Element, Event>,
                val: { code: string; display: string } | null,
              ) => {
                setSearchParams((prev) => ({
                  ...prev,
                  reason: val?.code ?? "",
                }));
              }}
              isOptionEqualToValue={(
                o: { code: string; display: string },
                v: { code: string; display: string },
              ) => o.code === v.code}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Reason for Visit"
                  placeholder="Type to filter reasons…"
                  variant="outlined"
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={
                  loading ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <SearchIcon />
                  )
                }
                disabled={loading}
              >
                Search Encounters
              </Button>
              <Button
                variant="outlined"
                onClick={handleClearAll}
                disabled={loading}
              >
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* ── Feedback ── */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* ── Results ── */}
      {!searched && !loading && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          Search to get started
        </Typography>
      )}

      {searched && !loading && encounters.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          No encounters found
        </Typography>
      )}

      {searched && !loading && encounters.length > 0 && (
        <EncounterSearchResults
          encounters={encounters.slice(
            page * DISPLAY_SIZE - serverOffset,
            page * DISPLAY_SIZE - serverOffset + DISPLAY_SIZE,
          )}
          total={total}
          page={page}
          pageSize={DISPLAY_SIZE}
          onPageChange={handlePageChange}
        />
      )}
    </Box>
  );
}
