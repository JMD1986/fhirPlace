import "./App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ErrorBoundary } from "react-error-boundary";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

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
    <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
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
        <Box
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
          </Routes>
        </Box>
      </BrowserRouter>
    </AuthProvider>
  );
}

function PatientViewWrapper() {
  // separate component so hooks can be used inside
  const { id } = useParams<{ id: string }>();
  // if id is undefined, you could render an error or redirect
  return id ? <PatientView patientId={id} /> : null;
}

export default App;
