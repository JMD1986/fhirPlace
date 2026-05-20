import { useEffect, useState } from "react";
import FHIR from "fhirclient";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import {
  EPIC_SANDBOX_ISS_DEFAULT,
  getDefaultSmartIss,
  getSmartClientId,
  getSmartRedirectUri,
  getSmartScopes,
  issForPreset,
  type SmartIssPreset,
} from "../../lib/smartConfig";

/**
 * EHR Launch entry-point  (/launch)
 *
 * Two modes:
 *  1. EHR launch  – EHR navigates here with ?iss=...&launch=...
 *                   We immediately forward to the EHR auth server.
 *  2. Standalone  – Developer/tester opens /launch directly.
 *                   A text field lets them enter the FHIR server URL.
 */
export default function LaunchPage() {
  const params = new URLSearchParams(window.location.search);
  const issFromUrl = params.get("iss");

  // ── EHR launch: fire immediately ──────────────────────────────────────────
  useEffect(() => {
    if (!issFromUrl) return;
    FHIR.oauth2.authorize({
      clientId: getSmartClientId(),
      scope: getSmartScopes({ iss: issFromUrl, embedded: true }),
      redirectUri: getSmartRedirectUri(),
    });
  }, [issFromUrl]);

  // ── Standalone launch ─────────────────────────────────────────────────────
  const [iss, setIss] = useState(getDefaultSmartIss());

  const applyPreset = (preset: SmartIssPreset) => {
    setIss(issForPreset(preset));
  };

  const handleStandalone = () => {
    const serverUrl = iss.trim();
    FHIR.oauth2.authorize({
      clientId: getSmartClientId(),
      scope: getSmartScopes({ iss: serverUrl, embedded: false }),
      redirectUri: getSmartRedirectUri(),
      iss: serverUrl,
    });
  };

  if (issFromUrl) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography color="text.secondary">Connecting to EHR…</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 3,
        p: 3,
      }}
    >
      <Typography variant="h5" fontWeight={700}>
        Connect to a FHIR Server
      </Typography>

      <Alert severity="info" sx={{ maxWidth: 520, width: "100%" }}>
        <strong>SMART Health IT:</strong> no registration — use the preset below.
        <br />
        <strong>Epic sandbox:</strong> register at fhir.epic.com, set{" "}
        <code>VITE_SMART_CLIENT_ID</code>, then use the Epic preset (ISS{" "}
        <code>{EPIC_SANDBOX_ISS_DEFAULT}</code>).
        <br />
        <strong>EHR launch:</strong> SMART simulator or Epic launcher →{" "}
        <code>{window.location.origin}/launch</code>
      </Alert>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          maxWidth: 520,
          width: "100%",
        }}
      >
        <ButtonGroup fullWidth variant="outlined" aria-label="FHIR server preset">
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
          placeholder={EPIC_SANDBOX_ISS_DEFAULT}
        />
        <Button
          variant="contained"
          size="large"
          onClick={handleStandalone}
          disabled={!iss.trim()}
        >
          Launch with SMART
        </Button>
      </Box>
    </Box>
  );
}
