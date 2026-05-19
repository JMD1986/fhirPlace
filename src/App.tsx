import "./App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useParams, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AccessDenied from "./Components/Auth/AccessDenied";
import { canReadPatient } from "./lib/accessControl";
import { ErrorBoundary } from "react-error-boundary";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { RouteAnnouncer } from "./Components/Shared/RouteAnnouncer";

// ── Lazy-loaded route components ──────────────────────────────────────────────
// Each route is split into its own JS chunk. The browser only downloads a
// chunk when the user first navigates to that route, keeping the initial
// bundle small and improving Time-to-Interactive on the home/search page.
const SearchContainer = lazy(
  () => import("./Components/MainSearch/SearchContainer"),
);
const PatientView = lazy(() => import("./Components/Patient/PatientView"));
const EncounterView = lazy(
  () => import("./Components/Encounter/EncounterView"),
);
const DocumentReferenceView = lazy(
  () => import("./Components/AdditionalResources/DocumentReferenceView"),
);
const ConditionView = lazy(
  () => import("./Components/AdditionalResources/ConditionView"),
);
const DiagnosticReportView = lazy(
  () => import("./Components/AdditionalResources/DiagnosticReportView"),
);
const ClaimsView = lazy(
  () => import("./Components/AdditionalResources/ClaimsView"),
);
const EoBView = lazy(() => import("./Components/AdditionalResources/EoBView"));
const ImmunizationView = lazy(
  () => import("./Components/AdditionalResources/ImmunizationView"),
);
const ProcedureView = lazy(
  () => import("./Components/AdditionalResources/ProcedureView"),
);
const ObservationView = lazy(
  () => import("./Components/AdditionalResources/ObservationView"),
);
const MedicationRequestView = lazy(
  () => import("./Components/AdditionalResources/MedicationRequestView"),
);
const UserProfilePage = lazy(() => import("./Components/Auth/UserProfilePage"));
const LaunchPage = lazy(() => import("./Components/Auth/LaunchPage"));
const CallbackPage = lazy(() => import("./Components/Auth/CallbackPage"));
const AuditLogPage = lazy(() => import("./Components/Audit/AuditLogPage"));

function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
}) {
  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: "auto", mt: 6 }}>
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={resetErrorBoundary}>
            Try again
          </Button>
        }
      >
        <AlertTitle>Something went wrong</AlertTitle>
        {error instanceof Error ? error.message : String(error)}
      </Alert>
    </Box>
  );
}

// Shown while the lazy chunk is downloading
function RouteLoader() {
  return (
    <Box
      sx={{ display: "flex", justifyContent: "center", pt: 10 }}
      role="status"
      aria-label="Loading..."
    >
      <CircularProgress />
    </Box>
  );
}

// Wraps a route element in both an ErrorBoundary and a Suspense boundary so
// lazy-load failures are caught and chunk-download spinners are shown.
function RouteWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={<RouteLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Route change announcer for screen readers */}
        <RouteAnnouncer />
        {/* Skip to main content link for accessibility */}
        <a href="#main-content" className="sr-only skip-link">
          Skip to main content
        </a>
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <RouteWrapper>
                  <SearchContainer />
                </RouteWrapper>
              }
            />
            <Route
              path="/patient/:id"
              element={
                <RouteWrapper>
                  <PatientViewWrapper />
                </RouteWrapper>
              }
            />
            <Route
              path="/encounter/:id"
              element={
                <RouteWrapper>
                  <EncounterView />
                </RouteWrapper>
              }
            />
            <Route
              path="/document/:id"
              element={
                <RouteWrapper>
                  <DocumentReferenceView />
                </RouteWrapper>
              }
            />
            <Route
              path="/condition/:id"
              element={
                <RouteWrapper>
                  <ConditionView />
                </RouteWrapper>
              }
            />
            <Route
              path="/diagnostic-report/:id"
              element={
                <RouteWrapper>
                  <DiagnosticReportView />
                </RouteWrapper>
              }
            />
            <Route
              path="/claim/:id"
              element={
                <RouteWrapper>
                  <ClaimsView />
                </RouteWrapper>
              }
            />
            <Route
              path="/explanation-of-benefit/:id"
              element={
                <RouteWrapper>
                  <EoBView />
                </RouteWrapper>
              }
            />
            <Route
              path="/immunization/:id"
              element={
                <RouteWrapper>
                  <ImmunizationView />
                </RouteWrapper>
              }
            />
            <Route
              path="/procedure/:id"
              element={
                <RouteWrapper>
                  <ProcedureView />
                </RouteWrapper>
              }
            />
            <Route
              path="/observation/:id"
              element={
                <RouteWrapper>
                  <ObservationView />
                </RouteWrapper>
              }
            />
            <Route
              path="/medication-request/:id"
              element={
                <RouteWrapper>
                  <MedicationRequestView />
                </RouteWrapper>
              }
            />
            <Route
              path="/profile"
              element={
                <RouteWrapper>
                  <UserProfilePage />
                </RouteWrapper>
              }
            />
            <Route
              path="/launch"
              element={
                <RouteWrapper>
                  <LaunchPage />
                </RouteWrapper>
              }
            />
            <Route
              path="/callback"
              element={
                <RouteWrapper>
                  <CallbackPage />
                </RouteWrapper>
              }
            />
            <Route
              path="/audit"
              element={
                <RouteWrapper>
                  <AuditLogPage />
                </RouteWrapper>
              }
            />
          </Routes>
        </Box>
      </BrowserRouter>
    </AuthProvider>
  );
}

function PatientViewWrapper() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!id) return null;

  if (
    !canReadPatient(
      user ? { role: user.role, linkedPatientId: user.linkedPatientId } : null,
      id,
    )
  ) {
    return (
      <AccessDenied
        message="You are not authorized to view this patient's record. Patient-role sessions are limited to your own health information from the EHR launch context."
        onBack={() => navigate(user?.linkedPatientId ? `/patient/${user.linkedPatientId}` : "/profile")}
      />
    );
  }

  return <PatientView patientId={id} />;
}

export default App;
