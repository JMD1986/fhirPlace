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
  Divider,
  Link as MuiLink,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import BusinessIcon from "@mui/icons-material/Business";
import BadgeIcon from "@mui/icons-material/Badge";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import {
  useNPPESPractitioner,
  useNPPESOrg,
  extractNPIFromReference,
} from "../../hooks/useNPPES";
import type { NPPESResult } from "../../hooks/useNPPES";
import Grid from "@mui/material/Grid";
import { useParams, useNavigate, Link } from "react-router-dom";
import { encounterApi } from "../../api/fhirApi";
import AdditionalResourcesPanel from "../AdditionalResources/AdditionalResourcesPanel";
import type { ResourceGroup } from "../AdditionalResources/AdditionalResourcesPanel";

// ── Types ──────────────────────────────────────────────────────────────────────

interface EncounterResource {
  id: string;
  status?: string;
  class?: { code?: string };
  type?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
  subject?: { reference?: string; display?: string };
  _patientId?: string;
  period?: { start?: string; end?: string };
  participant?: Array<{
    type?: Array<{ text?: string }>;
    period?: { start?: string; end?: string };
    individual?: { reference?: string; display?: string };
  }>;
  serviceProvider?: { reference?: string; display?: string };
  location?: Array<{ location?: { reference?: string; display?: string } }>;
  diagnosis?: Array<{
    condition?: { reference?: string; display?: string };
    role?: { text?: string };
    rank?: number;
  }>;
  reason?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const stripNums = (s: string) => s.replace(/\d+/g, "").trim();

const formatDateTime = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
};

const statusColor = (
  status?: string,
): "success" | "warning" | "error" | "default" => {
  if (status === "finished") return "success";
  if (status === "in-progress") return "warning";
  if (status === "cancelled") return "error";
  return "default";
};

const cleanDisplay = (s?: string) =>
  s
    ? s
        .split(" ")
        .map((w) => stripNums(w))
        .filter(Boolean)
        .join(" ")
    : "—";

// ── NPPES Result Card ──────────────────────────────────────────────────────────
function NPPESResultCard({ result }: { result: NPPESResult }) {
  const isOrg = result.enumeration_type === "NPI-2";
  const name = isOrg
    ? (result.basic.organization_name ?? "—")
    : [
        result.basic.first_name,
        result.basic.middle_name,
        result.basic.last_name,
      ]
        .filter(Boolean)
        .join(" ");
  const credential =
    !isOrg && result.basic.credential ? `, ${result.basic.credential}` : "";
  const primaryTax =
    result.taxonomies.find((t) => t.primary) ?? result.taxonomies[0];
  const locAddr =
    result.addresses.find((a) => a.address_purpose === "LOCATION") ??
    result.addresses[0];
  const npiUrl = `https://npiregistry.cms.hhs.gov/provider-view/${result.number}`;

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
        mb: 1,
        "&:last-child": { mb: 0 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.75 }}>
        {isOrg ? (
          <BusinessIcon fontSize="small" color="primary" sx={{ mt: 0.2 }} />
        ) : (
          <LocalHospitalIcon
            fontSize="small"
            color="primary"
            sx={{ mt: 0.2 }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600}>
            {name}
            {credential}
          </Typography>
          {primaryTax && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {primaryTax.desc}
            </Typography>
          )}
        </Box>
        <Chip
          icon={<BadgeIcon sx={{ fontSize: "0.75rem !important" }} />}
          label={result.number}
          size="small"
          variant="outlined"
          sx={{ fontFamily: "monospace", fontSize: "0.7rem", height: 20 }}
        />
      </Box>

      {locAddr && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ pl: 3.5, mb: 0.5 }}
        >
          {locAddr.address_1}
          {locAddr.address_2 ? `, ${locAddr.address_2}` : ""}, {locAddr.city},{" "}
          {locAddr.state} {locAddr.postal_code}
          {locAddr.telephone_number ? ` · ${locAddr.telephone_number}` : ""}
        </Typography>
      )}

      <Box sx={{ pl: 3.5 }}>
        <MuiLink
          href={npiUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
        >
          View on NPPES
          <OpenInNewIcon sx={{ fontSize: "0.7rem" }} />
        </MuiLink>
      </Box>
    </Box>
  );
}

// ── NPPES Panel ─────────────────────────────────────────────────────────────────
interface NPPESPanelProps {
  practitionerNpi?: string | null;
  practitionerDisplay?: string | null;
  orgNpi?: string | null;
  orgName?: string | null;
  state?: string | null;
}

function NPPESPanel({
  practitionerNpi,
  practitionerDisplay,
  orgNpi,
  orgName,
  state,
}: NPPESPanelProps) {
  const practitioner = useNPPESPractitioner(
    practitionerNpi,
    practitionerDisplay,
    state,
  );
  const org = useNPPESOrg(orgNpi, orgName, state);

  const hasAny =
    practitioner.results.length > 0 ||
    org.results.length > 0 ||
    practitioner.loading ||
    org.loading ||
    practitioner.error ||
    org.error;

  if (!hasAny) return null;

  return (
    <Paper variant="outlined" sx={{ mb: 3, p: 2 }}>
      <Typography
        variant="subtitle2"
        fontWeight={700}
        gutterBottom
        sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5 }}
      >
        <BadgeIcon fontSize="small" color="primary" />
        NPPES Provider Registry
      </Typography>

      {/* Practitioner section */}
      {(practitioner.loading ||
        practitioner.results.length > 0 ||
        practitioner.error) && (
        <Box sx={{ mb: org.results.length > 0 || org.loading ? 2 : 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            display="block"
            sx={{ mb: 0.75 }}
          >
            PRACTITIONER
            {practitioner.searchedBy === "name" && (
              <Chip
                label="name search"
                size="small"
                sx={{ ml: 1, height: 16, fontSize: "0.6rem" }}
              />
            )}
          </Typography>
          {practitioner.loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                Searching NPPES…
              </Typography>
            </Box>
          )}
          {practitioner.error && (
            <Typography variant="caption" color="error">
              {practitioner.error}
            </Typography>
          )}
          {practitioner.results.map((r) => (
            <NPPESResultCard key={r.number} result={r} />
          ))}
        </Box>
      )}

      {/* Divider between sections when both have results */}
      {(practitioner.results.length > 0 || practitioner.loading) &&
        (org.results.length > 0 || org.loading) && <Divider sx={{ my: 1.5 }} />}

      {/* Organization section */}
      {(org.loading || org.results.length > 0 || org.error) && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            display="block"
            sx={{ mb: 0.75 }}
          >
            FACILITY / ORGANIZATION
            {org.searchedBy === "name" && (
              <Chip
                label="name search"
                size="small"
                sx={{ ml: 1, height: 16, fontSize: "0.6rem" }}
              />
            )}
          </Typography>
          {org.loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                Searching NPPES…
              </Typography>
            </Box>
          )}
          {org.error && (
            <Typography variant="caption" color="error">
              {org.error}
            </Typography>
          )}
          {org.results.map((r) => (
            <NPPESResultCard key={r.number} result={r} />
          ))}
        </Box>
      )}
    </Paper>
  );
}

// ── Resource List Sub-view ─────────────────────────────────────────────────────
const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

interface ResourceListViewProps {
  group: ResourceGroup;
  encounterId: string;
  patientId?: string;
  onBack: () => void;
}

function ResourceListView({
  group,
  encounterId,
  patientId,
  onBack,
}: ResourceListViewProps) {
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { config, items } = group;

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filteredItems = items.filter((item) => {
    const label = config.getLabel(item).toLowerCase();
    const rawDate = config.getDate(item);
    const itemDate = rawDate ? new Date(rawDate) : null;

    if (search && !label.includes(search.toLowerCase())) return false;
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!itemDate || itemDate < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (!itemDate || itemDate > to) return false;
    }
    return true;
  });

  const hasFilters = search !== "" || dateFrom !== "" || dateTo !== "";
  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  // Clamp page to valid range when filters shrink the result set
  const safePage =
    filteredItems.length === 0
      ? 0
      : Math.min(page, Math.floor((filteredItems.length - 1) / PAGE_SIZE));

  const pageItems = filteredItems.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 2,
        }}
      >
        <Button size="small" variant="outlined" onClick={onBack}>
          ← Back to Encounter
        </Button>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, ml: 1 }}>
          {config.icon}
          <Typography variant="h6" fontWeight={600}>
            {config.label}
          </Typography>
          <Chip label={items.length} size="small" sx={{ ml: 0.5 }} />
          {hasFilters && (
            <Chip
              label={`${filteredItems.length} shown`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 0.5 }}
            />
          )}
        </Box>
      </Box>

      {/* ── Filter bar ── */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "center",
        }}
      >
        <TextField
          size="small"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: "1 1 180px", minWidth: 160 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch("")}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        <TextField
          size="small"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          sx={{ width: 155 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          sx={{ width: 155 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {hasFilters && (
          <Button size="small" variant="text" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </Paper>

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
              <TableCell sx={{ color: "white", fontWeight: 600, width: 80 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  {hasFilters
                    ? "No results match your filters."
                    : `No ${config.label.toLowerCase()} found.`}
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((item) => {
                const label = config.getLabel(item);
                const date = fmtDate(config.getDate(item));
                const href = `${config.viewPath}/${item.id}?encounterId=${encounterId}${patientId ? `&patientId=${patientId}` : ""}`;
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
                      <Button
                        component={Link}
                        to={href}
                        size="small"
                        variant="text"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {filteredItems.length > PAGE_SIZE && (
          <TablePagination
            component="div"
            count={filteredItems.length}
            page={safePage}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        )}
      </TableContainer>
    </Box>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function EncounterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [encounter, setEncounter] = useState<EncounterResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ResourceGroup | null>(
    null,
  );

  useEffect(() => {
    if (!id) return;
    setSelectedGroup(null);
    const fetchEncounter = async () => {
      try {
        setLoading(true);
        setError(null);
        const data: EncounterResource = await encounterApi.getById(id);
        setEncounter(data);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchEncounter();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!encounter) return null;

  const type =
    encounter.type?.[0]?.text ??
    encounter.type?.[0]?.coding?.[0]?.display ??
    "—";
  const patientDisplay = cleanDisplay(encounter.subject?.display);
  const patientId =
    encounter._patientId ??
    encounter.subject?.reference?.replace(/^urn:uuid:/, "");

  // ── NPPES data extraction ──
  const primaryParticipant = encounter.participant?.[0];
  const practitionerRef = primaryParticipant?.individual?.reference;
  const practitionerDisplay = primaryParticipant?.individual?.display ?? null;
  const practitionerNpi = extractNPIFromReference(practitionerRef);

  // For org NPI, Synthea doesn't put NPI in the serviceProvider reference in a
  // standard us-npi format, so we pass null and rely on name search
  const orgDisplay =
    encounter.serviceProvider?.display ??
    encounter.location?.[0]?.location?.display ??
    null;

  const mainRows = [
    { label: "Encounter ID", value: encounter.id, mono: true },
    {
      label: "Status",
      value: (
        <Chip
          label={encounter.status ?? "—"}
          size="small"
          color={statusColor(encounter.status)}
        />
      ),
    },
    {
      label: "Class",
      value: encounter.class?.code ? (
        <Chip label={encounter.class.code} size="small" variant="outlined" />
      ) : (
        "—"
      ),
    },
    { label: "Type", value: type },
    {
      label: "Patient",
      value: patientId ? (
        <Link
          to={`/patient/${patientId}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <Typography
            variant="body2"
            sx={{
              color: "primary.main",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {patientDisplay}
          </Typography>
        </Link>
      ) : (
        patientDisplay
      ),
    },
    { label: "Start", value: formatDateTime(encounter.period?.start) },
    { label: "End", value: formatDateTime(encounter.period?.end) },
    {
      label: "Duration",
      value: formatDuration(encounter.period?.start, encounter.period?.end),
    },
    {
      label: "Location",
      value:
        encounter.location?.[0]?.location?.display ??
        encounter.serviceProvider?.display ??
        "—",
    },
    {
      label: "Service Provider",
      value: encounter.serviceProvider?.display ?? "—",
    },
    ...(encounter.reason && encounter.reason.length > 0
      ? [
          {
            label: "Reason",
            value: (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {encounter.reason.map((r, i) => (
                  <Chip
                    key={i}
                    label={r.text ?? r.coding?.[0]?.display ?? "—"}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Box>
            ),
          },
        ]
      : []),
  ];

  const practitioners = encounter.participant ?? [];
  const diagnoses = encounter.diagnosis ?? [];

  return (
    <Box sx={{ p: 3, mt: 2 }}>
      <Button onClick={() => navigate("/")} sx={{ mb: 2 }}>
        &larr; Back to search
      </Button>

      <Typography variant="h5" fontWeight={600} gutterBottom>
        {type}
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {patientDisplay} &mdash; {encounter.period?.start?.slice(0, 10) ?? ""}
      </Typography>

      <Grid container spacing={3} alignItems="flex-start">
        {/* ── Left column: sidebar ── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <AdditionalResourcesPanel
            encounterId={encounter.id}
            patientId={patientId}
            onSelectGroup={setSelectedGroup}
          />
        </Grid>

        {/* ── Right column: resource list or encounter detail ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          {selectedGroup ? (
            <ResourceListView
              group={selectedGroup}
              encounterId={encounter.id}
              patientId={patientId}
              onBack={() => setSelectedGroup(null)}
            />
          ) : (
            <Box>
              {/* ── Main details ── */}
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table sx={{ minWidth: 500 }}>
                  <TableHead sx={{ backgroundColor: "primary.main" }}>
                    <TableRow>
                      <TableCell
                        sx={{ color: "white", fontWeight: 600, width: "28%" }}
                      >
                        Property
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: 600 }}>
                        Value
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mainRows.map((row, i) => (
                      <TableRow key={i} hover>
                        <TableCell
                          sx={{ fontWeight: 500, color: "text.secondary" }}
                        >
                          {row.label}
                        </TableCell>
                        <TableCell>
                          {typeof row.value === "string" ? (
                            <Typography
                              variant="body2"
                              fontFamily={row.mono ? "monospace" : "inherit"}
                            >
                              {row.value}
                            </Typography>
                          ) : (
                            row.value
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* ── Practitioners ── */}
              {practitioners.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Participants
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
                        <TableRow>
                          {["Name", "Role", "Start", "End"].map((h) => (
                            <TableCell key={h} sx={{ fontWeight: 600 }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {practitioners.map((p, i) => (
                          <TableRow key={i} hover>
                            <TableCell>
                              {p.individual?.display ?? "—"}
                            </TableCell>
                            <TableCell>{p.type?.[0]?.text ?? "—"}</TableCell>
                            <TableCell>
                              {formatDateTime(p.period?.start)}
                            </TableCell>
                            <TableCell>
                              {formatDateTime(p.period?.end)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* ── Diagnoses ── */}
              {diagnoses.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    Diagnoses
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
                        <TableRow>
                          {["Condition", "Role", "Rank"].map((h) => (
                            <TableCell key={h} sx={{ fontWeight: 600 }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {diagnoses.map((d, i) => (
                          <TableRow key={i} hover>
                            <TableCell>{d.condition?.display ?? "—"}</TableCell>
                            <TableCell>{d.role?.text ?? "—"}</TableCell>
                            <TableCell>{d.rank ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* ── NPPES Provider Registry ── */}
              <NPPESPanel
                practitionerNpi={practitionerNpi}
                practitionerDisplay={practitionerDisplay}
                orgNpi={null}
                orgName={orgDisplay}
              />
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
