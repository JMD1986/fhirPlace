import { Alert, Link } from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { isEpicIss } from "../../lib/smartConfig";
import { isCcdExportAvailable } from "../../api/fhirApi";

/**
 * Shown when a SMART session is active — clinical FHIR reads use the EHR, not Synthea.
 */
export default function EhrSessionBanner() {
  const { user, client } = useAuth();
  if (!client || !user?.serverUrl) return null;

  const epic = isEpicIss(user.serverUrl);
  const ccdNote = isCcdExportAvailable()
    ? null
    : " CCD export is disabled while connected to an EHR.";

  return (
    <Alert severity="info" sx={{ mx: 3, mt: 2 }} role="status">
      Connected to <strong>{epic ? "Epic" : "EHR"} FHIR</strong>
      {epic ? (
        <>
          {" "}
          sandbox. Patient and chart data are loaded from Epic; register APIs at{" "}
          <Link
            href="https://fhir.epic.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            fhir.epic.com
          </Link>{" "}
          if searches return empty or 403.
        </>
      ) : (
        <> — clinical data is loaded from the remote FHIR server.</>
      )}
      {ccdNote}
    </Alert>
  );
}
