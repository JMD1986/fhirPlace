import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import Avatar from "boring-avatars";
import PersonIcon from "@mui/icons-material/Person";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PatientView from "../Patient/PatientView";

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
                Session started
              </TableCell>
              <TableCell sx={{ border: 0 }}>
                {new Date(user.createdAt).toLocaleString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
            </TableRow>
            {user.role === "patient" && (
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 600, color: "text.secondary", border: 0 }}
                >
                  Patient ID
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
                    <Typography variant="body2" color="text.secondary">
                      Not provided by EHR
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}
            {user.fhirUser && (
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 600, color: "text.secondary", border: 0 }}
                >
                  FHIR Identity
                </TableCell>
                <TableCell sx={{ border: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                  >
                    {user.fhirUser}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {user.serverUrl && (
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 600, color: "text.secondary", border: 0 }}
                >
                  FHIR Server
                </TableCell>
                <TableCell sx={{ border: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      wordBreak: "break-all",
                    }}
                  >
                    {user.serverUrl}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Role-specific portal ── */}
      {user.role === "patient" ? (
        user.linkedPatientId ? (
          <PatientPortal patientId={user.linkedPatientId} />
        ) : (
          <Alert severity="info">
            No patient context was provided during launch. Re-launch from your
            EHR to access your health record.
          </Alert>
        )
      ) : (
        <ProviderPortal username={user.username} />
      )}
    </Box>
  );
}
