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
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";

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

  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setLoginEmail("");
    setLoginPassword("");
    setSignupUsername("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirm("");
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
    const err = signup(signupUsername, signupEmail, signupPassword);
    if (err) {
      setError(err);
    } else {
      handleClose();
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
