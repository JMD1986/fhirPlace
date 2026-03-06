import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import FHIR from "fhirclient";
import type Client from "fhirclient/lib/Client";
import { scrubFhirClientState } from "../lib/smartStorage";

// ── Types ──────────────────────────────────────────────────────────────────────
export type UserRole = "patient" | "provider";

export interface AppUser {
  /** Display name from id_token or fhirUser reference */
  username: string;
  /** email or sub claim – used as a stable per-user key (e.g. saved searches) */
  email: string;
  /** ISO timestamp when this SMART session was established */
  createdAt: string;
  /** "patient" if a patient context was supplied by the EHR, else "provider" */
  role: UserRole;
  /** FHIR Patient resource ID from the launch context */
  linkedPatientId?: string;
  /** Full FHIR user reference, e.g. "Practitioner/abc" or "Patient/xyz" */
  fhirUser?: string;
  /** FHIR server base URL for this session */
  serverUrl?: string;
}

interface AuthContextValue {
  user: AppUser | null;
  /** Live fhirclient Client – use for direct FHIR requests after auth */
  client: Client | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Kick off a SMART standalone launch.
   * Pass `iss` explicitly or rely on VITE_SMART_ISS.
   */
  launchStandalone: (iss?: string) => void;
  logout: () => void;
  /** In-memory update for UI adjustments (role, linkedPatientId). */
  updateUser: (
    updates: Partial<Pick<AppUser, "linkedPatientId" | "role">>,
  ) => void;
  /**
   * Called by CallbackPage once ready() resolves so AuthContext gets the
   * live Client without requiring a full page reload.
   */
  _receiveClient: (fhirClient: Client) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Decode a JWT payload without signature verification (server already did that). */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(jwt.split(".")[1])) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function deriveUser(fhirClient: Client): AppUser {
  const state = fhirClient.state;
  const tokenResponse = (state.tokenResponse ?? {}) as Record<string, unknown>;

  let username = "SMART User";
  let email: string = state.serverUrl ?? "smart-user";
  let fhirUser: string | undefined;

  // Prefer claims from the id_token when present
  const idToken = tokenResponse.id_token;
  if (typeof idToken === "string") {
    const claims = decodeJwtPayload(idToken);
    username =
      (claims.name as string | undefined) ??
      (claims.given_name as string | undefined) ??
      (claims.fhirUser as string | undefined)?.split("/").pop() ??
      "SMART User";
    email =
      (claims.email as string | undefined) ??
      (claims.sub as string | undefined) ??
      state.serverUrl ??
      "smart-user";
    fhirUser = claims.fhirUser as string | undefined;
  }

  // Fall back to top-level token field
  if (!fhirUser && typeof tokenResponse.fhirUser === "string") {
    fhirUser = tokenResponse.fhirUser;
  }

  const patientId = fhirClient.getPatientId() ?? undefined;

  return {
    username,
    email,
    createdAt: new Date().toISOString(),
    role: patientId ? "patient" : "provider",
    linkedPatientId: patientId,
    fhirUser,
    serverUrl: state.serverUrl,
  };
}

// ── Context ────────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((fhirClient: Client) => {
    const token = (fhirClient.state.tokenResponse ?? {}) as Record<
      string,
      unknown
    >;
    const expiresIn = token.expires_in as number | undefined;
    if (!expiresIn) return;
    const delay = Math.max((expiresIn - 30) * 1000, 5_000);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      try {
        await fhirClient.refresh();
        scheduleRefresh(fhirClient);
      } catch (e) {
        console.warn("[SMART] token refresh failed:", e);
      }
    }, delay);
  }, []);

  // Restore an existing SMART session on page load (token lives in sessionStorage
  // until the tab closes or the user explicitly logs out).
  useEffect(() => {
    FHIR.oauth2
      .ready()
      .then((fhirClient) => {
        setClient(fhirClient);
        setUser(deriveUser(fhirClient));
        scheduleRefresh(fhirClient);
      })
      .catch(() => {
        // No existing session — normal for a fresh visit.
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Injected by CallbackPage after FHIR.oauth2.ready() succeeds. */
  const _receiveClient = useCallback(
    (fhirClient: Client) => {
      setClient(fhirClient);
      setUser(deriveUser(fhirClient));
      scheduleRefresh(fhirClient);
      setError(null);
    },
    [scheduleRefresh],
  );

  const launchStandalone = useCallback((iss?: string) => {
    const serverUrl =
      iss ?? import.meta.env.VITE_SMART_ISS ?? "https://r4.smarthealthit.org";
    if (!serverUrl) {
      setError(
        "No FHIR server URL provided. Pass an ISS or set VITE_SMART_ISS in .env",
      );
      return;
    }
    FHIR.oauth2.authorize({
      clientId: import.meta.env.VITE_SMART_CLIENT_ID ?? "fhirplace-dev",
      // Standalone: no EHR launch token, so omit launch/patient
      scope: "openid fhirUser patient/*.read offline_access",
      redirectUri: `${window.location.origin}/callback`,
      iss: serverUrl,
    });
  }, []);

  const logout = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    scrubFhirClientState(); // Belt-and-suspenders: scrub any lingering SMART sessionStorage
    setUser(null);
    setClient(null);
    setError(null);
  }, []);

  const updateUser = useCallback(
    (updates: Partial<Pick<AppUser, "linkedPatientId" | "role">>) => {
      setUser((prev) => (prev ? { ...prev, ...updates } : prev));
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        client,
        isLoading,
        error,
        launchStandalone,
        logout,
        updateUser,
        _receiveClient,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
