import { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Divider,
  TextField,
  Alert,
  Autocomplete,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import Avatar from "boring-avatars";
import PersonIcon from "@mui/icons-material/Person";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import LinkIcon from "@mui/icons-material/Link";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { patientApi } from "../../api/fhirApi";
import PatientView from "../Patient/PatientView";

interface PatientOption {
  id: string;
  label: string;
}

// ── Patient portal shell ─────────────────────────────────────────────────────
function PatientPortal({ patientId }: { patientId: string }) {
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        You are viewing your personal health record. All information is
        read-only.
      </Alert>
      <PatientView patientId={patientId} />
    </Box>
  );
}

// ── Provider placeholder ─────────────────────────────────────────────────────
function ProviderPortal({ username }: { username: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
      <MedicalServicesIcon
        sx={{ fontSize: 56, color: "primary.main", mb: 2 }}
      />
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Provider Dashboard
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        Welcome, {username}. Your provider dashboard is coming soon.
      </Typography>
      <Typography variant="caption" color="text.disabled">
        This will include patient lists, encounter management, prescribing
        tools, and analytics.
      </Typography>
    </Paper>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function UserProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  // Patient-link editing
  const [linkMode, setLinkMode] = useState(false);
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(
    null,
  );
  const [linkSuccess, setLinkSuccess] = useState(false);

  if (!user) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">
          You are not logged in.
        </Typography>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => navigate("/")}
        >
          Go to Search
        </Button>
      </Box>
    );
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handlePatientSearch = async (_: unknown, value: string) => {
    setPatientQuery(value);
    setSelectedPatient(null);
    if (value.trim().length < 2) {
      setPatientOptions([]);
      return;
    }
    setPatientLoading(true);
    try {
      const data = await patientApi.searchSummary(value, 10);
      setPatientOptions(
        data.map((p) => {
          const displayName =
            p.name ?? [p.given, p.family].filter(Boolean).join(" ") ?? p.id;
          const dob = p.birthDate ? ` (DOB: ${p.birthDate})` : "";
          return { id: p.id, label: `${displayName}${dob}` };
        }),
      );
    } catch {
      setPatientOptions([]);
    } finally {
      setPatientLoading(false);
    }
  };

  const handleSaveLink = () => {
    if (!selectedPatient) return;
    updateUser({ linkedPatientId: selectedPatient.id });
    setLinkMode(false);
    setLinkSuccess(true);
    setTimeout(() => setLinkSuccess(false), 3000);
  };

  const roleLabel = user.role === "patient" ? "Patient" : "Provider";
  const RoleIcon = user.role === "patient" ? PersonIcon : MedicalServicesIcon;
  const roleColor = user.role === "patient" ? "primary" : "secondary";

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      {/* ── Back nav ── */}
      <Button onClick={() => navigate("/")} sx={{ mb: 3 }}>
        ← Back to Search
      </Button>

      {/* ── Profile header card ── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, sm: "auto" }}>
            <Avatar size={80} name={user.username} />
          </Grid>
          <Grid size={{ xs: 12, sm: "grow" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Typography variant="h4" fontWeight={700}>
                {user.username}
              </Typography>
              <Chip
                icon={<RoleIcon fontSize="small" />}
                label={roleLabel}
                color={roleColor}
                size="small"
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {user.email}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: "auto" }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Account details table */}
        <Table size="small" sx={{ maxWidth: 480 }}>
          <TableBody>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 600,
                  color: "text.secondary",
                  border: 0,
                  width: 160,
                }}
              >
                Role
              </TableCell>
              <TableCell sx={{ border: 0 }}>{roleLabel}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                sx={{ fontWeight: 600, color: "text.secondary", border: 0 }}
              >
                Member since
              </TableCell>
              <TableCell sx={{ border: 0 }}>
                {new Date(user.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </TableCell>
            </TableRow>
            {user.role === "patient" && (
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 600, color: "text.secondary", border: 0 }}
                >
                  Linked Record
                </TableCell>
                <TableCell sx={{ border: 0 }}>
                  {user.linkedPatientId ? (
                    <Chip
                      label={user.linkedPatientId}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}
                    />
                  ) : (
                    <Typography variant="body2" color="warning.main">
                      No patient record linked
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Patient-link edit section */}
        {user.role === "patient" && (
          <Box sx={{ mt: 2 }}>
            {linkSuccess && (
              <Alert severity="success" sx={{ mb: 1.5 }}>
                Patient record linked successfully!
              </Alert>
            )}
            {!linkMode ? (
              <Button
                size="small"
                startIcon={<LinkIcon />}
                onClick={() => setLinkMode(true)}
              >
                {user.linkedPatientId
                  ? "Change linked record"
                  : "Link patient record"}
              </Button>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  gap: 1.5,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <Autocomplete
                  sx={{ minWidth: 320 }}
                  options={patientOptions}
                  getOptionLabel={(o) => o.label}
                  loading={patientLoading}
                  inputValue={patientQuery}
                  value={selectedPatient}
                  onInputChange={handlePatientSearch}
                  onChange={(_e, val) => setSelectedPatient(val)}
                  filterOptions={(x) => x}
                  noOptionsText={
                    patientQuery.length < 2
                      ? "Type at least 2 characters…"
                      : "No patients found"
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Search patient records"
                      placeholder="Type a name…"
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {patientLoading && (
                                <CircularProgress color="inherit" size={14} />
                              )}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={!selectedPatient}
                  onClick={handleSaveLink}
                >
                  Save
                </Button>
                <Button size="small" onClick={() => setLinkMode(false)}>
                  Cancel
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* ── Role-specific portal ── */}
      {user.role === "patient" ? (
        user.linkedPatientId ? (
          <PatientPortal patientId={user.linkedPatientId} />
        ) : (
          <Alert severity="warning">
            Link a patient record above to view your medical history and billing
            information.
          </Alert>
        )
      ) : (
        <ProviderPortal username={user.username} />
      )}
    </Box>
  );
}
