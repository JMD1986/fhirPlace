import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import "./index.css";
import App from "./App.tsx";
import { theme } from "./theme";
import { reportWebVitals } from "./reportWebVitals";

// ── HTTPS enforcement (HIPAA/SOC 2) ──────────────────────────────────────────
// In production, VITE_API_BASE must be an HTTPS URL. A non-HTTPS base would
// transmit PHI in plaintext, violating HIPAA technical safeguard requirements.
if (import.meta.env.PROD) {
  const apiBase = import.meta.env.VITE_API_BASE as string | undefined;
  if (apiBase && !apiBase.startsWith("https://")) {
    throw new Error(
      `[SECURITY] VITE_API_BASE must use HTTPS in production. ` +
        `Received: "${apiBase}". ` +
        `Transmitting PHI over non-HTTPS violates HIPAA technical safeguard requirements.`,
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);

// ── Web Vitals reporting ───────────────────────────────────────────────────────
// Production: POST { name, value, id, delta } to the configured analytics endpoint.
// Development: log metrics to the console for easy inspection.
if (import.meta.env.PROD) {
  const endpoint = import.meta.env.VITE_VITALS_ENDPOINT as string | undefined;
  if (!endpoint) {
    console.warn(
      "[reportWebVitals] VITE_VITALS_ENDPOINT is not set; " +
        "Web Vitals will not be reported in this production build.",
    );
  } else {
    reportWebVitals(({ name, value, id, delta }) => {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Payload shape: { name: string; value: number; id: string; delta: number }
        body: JSON.stringify({ name, value, id, delta }),
        // keepalive lets the request outlive the page unload event
        keepalive: true,
      }).catch((err: unknown) => {
        console.error("[reportWebVitals] Failed to send metric:", err);
      });
    });
  }
} else {
  // Dev: surface metrics in the console for quick feedback during development.
  reportWebVitals(console.log);
}
