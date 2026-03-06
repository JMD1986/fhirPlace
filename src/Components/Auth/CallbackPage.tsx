import { useEffect, useRef, useState } from "react";
import FHIR from "fhirclient";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * OAuth2 redirect_uri target  (/callback)
 *
 * After the auth server redirects back here with ?code=…&state=…, we call
 * FHIR.oauth2.ready() to exchange the authorization code for an access token.
 *
 * The resulting Client is injected into AuthContext via _receiveClient() so
 * the rest of the app sees the authenticated state immediately — no page
 * reload needed and no token is ever written to localStorage/sessionStorage.
 */
export default function CallbackPage() {
  const navigate = useNavigate();
  const { _receiveClient } = useAuth();
  const attempted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    FHIR.oauth2
      .ready()
      .then((fhirClient) => {
        _receiveClient(fhirClient);
        navigate("/", { replace: true });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      });
  }, [navigate, _receiveClient]);

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 620, mx: "auto", mt: 8 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Authorization failed: {error}
        </Alert>
        <Button variant="outlined" onClick={() => navigate("/launch")}>
          Try again
        </Button>
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
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">Completing authorization…</Typography>
    </Box>
  );
}
