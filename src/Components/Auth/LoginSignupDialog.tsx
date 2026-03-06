import { useState } from "react";
import {
  Alert,
  Box,
  Button,
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

  const [iss, setIss] = useState(
    import.meta.env.VITE_SMART_ISS ?? "https://r4.smarthealthit.org",
  );

  const handleLaunch = () => {
    onClose();
    launchStandalone(iss.trim() || undefined);
  };

  const handleGoToLaunchPage = () => {
    onClose();
    navigate("/launch");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight={600}>
          Connect to FHIRPlace
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {authError && <Alert severity="error">{authError}</Alert>}

        <Alert severity="info">
          FHIRPlace uses <strong>SMART on FHIR</strong> for authentication.
          <br />
          <strong>EHR launch:</strong> your EHR navigates to{" "}
          <code>/launch</code> automatically.
          <br />
          <strong>Standalone:</strong> enter a SMART-enabled FHIR server URL and
          click <em>Launch</em>.
        </Alert>

        <TextField
          label="FHIR Server URL (ISS)"
          value={iss}
          onChange={(e) => setIss(e.target.value)}
          fullWidth
          size="small"
          placeholder="https://launch.smarthealthit.org/v/r4/fhir"
          helperText="Standalone: use r4.smarthealthit.org — for EHR launch use the portal at launch.smarthealthit.org"
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
