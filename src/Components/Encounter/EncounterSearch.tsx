import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
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
import type { FhirEncounter } from "./encounterTypes";
import SavedSearchBar from "../MainSearch/SavedSearchBar";
import { useSavedSearches } from "../../hooks/useSavedSearches";
import type { EncounterSearchParams } from "../../hooks/useSavedSearches";
import { useAuth } from "../../context/AuthContext";

// ── Component ─────────────────────────────────────────────────────────────────
export default function EncounterSearch() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useState<EncounterSearchParams>({
    patient: "",
    status: "",
    classCode: "",
    type: "",
    dateFrom: "",
    dateTo: "",
    reason: "",
  });

  const { searches, save, remove, rename, MAX_SAVED } = useSavedSearches(
    "encounter",
    user?.email,
  );
  const [encounters, setEncounters] = useState<FhirEncounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [snomedReasons, setSnomedReasons] = useState<
    { code: string; display: string }[]
  >([]);

  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50; // rows fetched from server per request
  const DISPLAY_SIZE = 25; // rows shown per UI page
  const [serverOffset, setServerOffset] = useState(0); // offset of the batch currently in `encounters`

  // Build query params from current search form state
  const buildParams = (offset: number) => {
    const params = new URLSearchParams();
    params.append("_count", String(PAGE_SIZE));
    params.append("_offset", String(offset));

    for (const [key, value] of Object.entries(searchParams)) {
      if (!value) continue;
      switch (key) {
        case "patient":
          params.append("patient", value);
          break;
        case "status":
          params.append("status", value);
          break;
        case "classCode":
          params.append("class", value);
          break;
        case "type":
          params.append("type", value);
          break;
        case "dateFrom":
          params.append("date", `ge${value}`);
          break;
        case "dateTo":
          params.append("date", `le${value}`);
          break;
        case "reason":
          params.append("reason", value);
          break;
      }
    }

    return params;
  };

  const fetchPage = async (offset: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5001/fhir/Encounter?${buildParams(offset).toString()}`,
      );
      if (!response.ok) throw new Error("Search request failed");
      const bundle = await response.json();
      const results: FhirEncounter[] = (bundle.entry ?? []).map(
        (e: { resource: FhirEncounter }) => e.resource,
      );
      setEncounters(results);
      setTotal(bundle.total ?? results.length);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Fetch dropdown options + SNOMED reasons on mount
  useEffect(() => {
    Promise.all([
      fetch("http://localhost:5001/fhir/Encounter/_types").then((r) =>
        r.json(),
      ),
      fetch("http://localhost:5001/fhir/Encounter/_classes").then((r) =>
        r.json(),
      ),
      fetch("/resources/snomed.json").then((r) => r.json()),
    ])
      .then(([types, classes, snomed]) => {
        setTypeOptions(types);
        setClassOptions(classes);
        setSnomedReasons(snomed);
      })
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    setPage(0);
    setServerOffset(0);
    await fetchPage(0);
  };

  const handlePageChange = async (_e: unknown, newPage: number) => {
    setPage(newPage);
    // Each server fetch covers 2 display pages (50 rows / 25 per page).
    // When the user moves to the first display-page of the NEXT server batch, fetch it.
    const nextServerOffset = serverOffset + PAGE_SIZE;
    const firstPageOfNextBatch = Math.floor(nextServerOffset / DISPLAY_SIZE);
    if (newPage === firstPageOfNextBatch) {
      setServerOffset(nextServerOffset);
      await fetchPage(nextServerOffset);
    }
  };

  const handleReset = () => {
    setSearchParams({
      patient: "",
      status: "",
      classCode: "",
      type: "",
      dateFrom: "",
      dateTo: "",
      reason: "",
    } satisfies EncounterSearchParams);
    setSearched(false);
    setEncounters([]);
    setTotal(null);
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
              onChange={handleChange}
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
                onChange={(e) =>
                  setSearchParams((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
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
                onChange={(e) =>
                  setSearchParams((prev) => ({
                    ...prev,
                    classCode: e.target.value,
                  }))
                }
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
                onChange={(e) =>
                  setSearchParams((prev) => ({ ...prev, type: e.target.value }))
                }
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
              onChange={handleChange}
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
              onChange={handleChange}
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
              onChange={(_e, val) =>
                setSearchParams((prev) => ({
                  ...prev,
                  reason: val?.code ?? "",
                }))
              }
              isOptionEqualToValue={(o, v) => o.code === v.code}
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
                onClick={handleReset}
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
      {searched && !loading && (
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
