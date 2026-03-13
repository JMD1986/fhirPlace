import { useEffect, useState } from "react";
import FHIR from "fhirclient";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";

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
    // EHR-initiated: the server provides a `launch` token, so we need the
    // launch/patient scope to get a patient context injected.
    FHIR.oauth2.authorize({
      clientId: import.meta.env.VITE_SMART_CLIENT_ID ?? "fhirplace-dev",
      scope: "openid fhirUser launch/patient patient/*.read offline_access",
      redirectUri: `${window.location.origin}/callback`,
    });
  }, [issFromUrl]);

  // ── Standalone launch ─────────────────────────────────────────────────────
  const [iss, setIss] = useState(
    import.meta.env.VITE_SMART_ISS ?? "https://r4.smarthealthit.org",
  );

  const handleStandalone = () => {
    // Standalone launch: no EHR-provided `launch` token, so we must NOT
    // include launch/patient — instead we request patient/*.read directly.
    FHIR.oauth2.authorize({
      clientId: import.meta.env.VITE_SMART_CLIENT_ID ?? "fhirplace-dev",
      scope: "openid fhirUser patient/*.read offline_access",
      redirectUri: `${window.location.origin}/callback`,
      iss: iss.trim(),
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
        <strong>Standalone / dev:</strong> use{" "}
        <strong>r4.smarthealthit.org</strong> below — no registration or portal
        needed.
        <br />
        <strong>EHR launch:</strong> go to{" "}
        <strong>launch.smarthealthit.org</strong>, set your App Launch URL to{" "}
        <code>{window.location.origin}/launch</code>, then click Launch there.
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
        <TextField
          label="FHIR Server URL (ISS)"
          value={iss}
          onChange={(e) => setIss(e.target.value)}
          fullWidth
          placeholder="https://launch.smarthealthit.org/v/r4/fhir"
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
