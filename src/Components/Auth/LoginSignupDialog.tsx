import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  TextField,
  Button,
  Alert,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  CircularProgress,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../context/AuthContext";

interface PatientOption {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LoginSignupDialog({ open, onClose }: Props) {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<0 | 1>(0); // 0 = Login, 1 = Sign Up

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign-up fields
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupRole, setSignupRole] = useState<UserRole>("provider");

  // Patient linking
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setLoginEmail("");
    setLoginPassword("");
    setSignupUsername("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirm("");
    setSignupRole("provider");
    setPatientQuery("");
    setSelectedPatient(null);
    setPatientOptions([]);
    setError(null);
  };

  const handleTabChange = (_: React.SyntheticEvent, val: 0 | 1) => {
    setTab(val);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    setTab(0);
    onClose();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const err = login(loginEmail, loginPassword);
    if (err) {
      setError(err);
    } else {
      handleClose();
    }
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (signupRole === "patient" && !selectedPatient) {
      setError("Please search for and select your patient record.");
      return;
    }
    const err = signup(
      signupUsername,
      signupEmail,
      signupPassword,
      signupRole,
      selectedPatient?.id,
    );
    if (err) {
      setError(err);
    } else {
      handleClose();
    }
  };

  // Live patient search for linking
  const handlePatientInputChange = async (_: unknown, value: string) => {
    setPatientQuery(value);
    setSelectedPatient(null);
    if (value.trim().length < 2) {
      setPatientOptions([]);
      return;
    }
    setPatientLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5001/api/patients?name=${encodeURIComponent(value)}&_count=10`,
      );
      const data = await res.json();
      const patients: PatientOption[] = (data.patients ?? data ?? []).map(
        (p: {
          id: string;
          name?: string;
          given?: string;
          family?: string;
          birthDate?: string;
        }) => {
          const displayName =
            p.name ?? [p.given, p.family].filter(Boolean).join(" ") ?? p.id;
          const dob = p.birthDate ? ` (DOB: ${p.birthDate})` : "";
          return { id: p.id, label: `${displayName}${dob}` };
        },
      );
      setPatientOptions(patients);
    } catch {
      setPatientOptions([]);
    } finally {
      setPatientLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        <Typography variant="h6" fontWeight={600}>
          {tab === 0 ? "Sign in to FHIRPlace" : "Create an account"}
        </Typography>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3, pt: 1 }}>
        <Tabs value={tab} onChange={handleTabChange}>
          <Tab label="Login" />
          <Tab label="Sign Up" />
        </Tabs>
      </Box>

      {/* ── Login ── */}
      {tab === 0 && (
        <Box component="form" onSubmit={handleLogin}>
          <DialogContent
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              autoFocus
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained">
              Login
            </Button>
          </DialogActions>
        </Box>
      )}

      {/* ── Sign Up ── */}
      {tab === 1 && (
        <Box component="form" onSubmit={handleSignup}>
          <DialogContent
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            {error && <Alert severity="error">{error}</Alert>}

            {/* Role selector */}
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                I am a…
              </Typography>
              <ToggleButtonGroup
                value={signupRole}
                exclusive
                onChange={(_e, val) => {
                  if (val) setSignupRole(val);
                }}
                fullWidth
                size="small"
              >
                <ToggleButton value="patient">
                  <PersonIcon fontSize="small" sx={{ mr: 0.75 }} />
                  Patient
                </ToggleButton>
                <ToggleButton value="provider">
                  <MedicalServicesIcon fontSize="small" sx={{ mr: 0.75 }} />
                  Provider
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <TextField
              label="Username"
              fullWidth
              required
              autoFocus
              value={signupUsername}
              onChange={(e) => setSignupUsername(e.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              helperText="Minimum 6 characters"
            />
            <TextField
              label="Confirm Password"
              type="password"
              fullWidth
              required
              value={signupConfirm}
              onChange={(e) => setSignupConfirm(e.target.value)}
            />

            {/* Patient record linking (patient role only) */}
            {signupRole === "patient" && (
              <Autocomplete
                options={patientOptions}
                getOptionLabel={(o) => o.label}
                loading={patientLoading}
                inputValue={patientQuery}
                value={selectedPatient}
                onInputChange={handlePatientInputChange}
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
                    label="Link your patient record"
                    placeholder="Search by name…"
                    helperText="Find your name in the patient database"
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {patientLoading && (
                              <CircularProgress color="inherit" size={16} />
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
              />
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained">
              Create Account
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
}
