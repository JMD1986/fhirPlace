import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  EPIC_SANDBOX_ISS_DEFAULT,
  getDefaultSmartIss,
  issForPreset,
  type SmartIssPreset,
} from "../../lib/smartConfig";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Auth dialog  replaced by SMART on FHIR.
 *
 * Options:
 *   EHR launch   handled automatically when the EHR navigates to /launch.
 *   Standalone   user enters a FHIR server URL here and we kick off
 *                  FHIR.oauth2.authorize() via launchStandalone().
 */
export default function LoginSignupDialog({ open, onClose }: Props) {
  const { launchStandalone, error: authError } = useAuth();
  const navigate = useNavigate();

  const [iss, setIss] = useState(getDefaultSmartIss());

  const applyPreset = (preset: SmartIssPreset) => {
    setIss(issForPreset(preset));
  };

  const handleLaunch = () => {
    onClose();
    launchStandalone(iss.trim() || undefined);
  };

  const handleGoToLaunchPage = () => {
    onClose();
    navigate("/launch");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="login-signup-dialog-title"
      aria-describedby="login-signup-dialog-content"
    >
      <DialogTitle id="login-signup-dialog-title">
        <Typography variant="h6" fontWeight={600}>
          Connect to FHIRPlace
        </Typography>
      </DialogTitle>

      <DialogContent
        id="login-signup-dialog-content"
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {authError && <Alert severity="error">{authError}</Alert>}

        <Alert severity="info">
          FHIRPlace uses <strong>SMART on FHIR</strong>. After sign-in, patient
          and chart data come from the FHIR server you choose (not local Synthea).
          <br />
          <strong>Epic:</strong> register at fhir.epic.com, then set{" "}
          <code>VITE_SMART_CLIENT_ID</code> in <code>.env</code>.
        </Alert>

        <ButtonGroup
          fullWidth
          variant="outlined"
          size="small"
          aria-label="FHIR server preset"
        >
          <Button onClick={() => applyPreset("smart-health-it")}>
            SMART Health IT
          </Button>
          <Button onClick={() => applyPreset("epic-sandbox")}>
            Epic sandbox
          </Button>
        </ButtonGroup>

        <TextField
          label="FHIR Server URL (ISS)"
          value={iss}
          onChange={(e) => setIss(e.target.value)}
          fullWidth
          size="small"
          placeholder={EPIC_SANDBOX_ISS_DEFAULT}
          helperText="Epic ISS after registration: interconnect-fhir-oauth R4 base URL"
        />

        <Divider />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleLaunch}
            disabled={!iss.trim()}
          >
            Launch with SMART
          </Button>
          <Button variant="outlined" fullWidth onClick={handleGoToLaunchPage}>
            Open full launch page
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
