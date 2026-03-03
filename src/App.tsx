import "./App.css";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import SearchContainer from "./components/MainSearch/SearchContainer";
import PatientView from "./components/Patient/PatientView";
import EncounterView from "./components/Encounter/EncounterView";
import DocumentReferenceView from "./components/AdditionalResources/DocumentReferenceView";
import ConditionView from "./components/AdditionalResources/ConditionView";
import DiagnosticReportView from "./components/AdditionalResources/DiagnosticReportView";
import ClaimsView from "./components/AdditionalResources/ClaimsView";
import EoBView from "./components/AdditionalResources/EoBView";
import ImmunizationView from "./components/AdditionalResources/ImmunizationView";
import ProcedureView from "./components/AdditionalResources/ProcedureView";
import ObservationView from "./components/AdditionalResources/ObservationView";
import MedicationRequestView from "./components/AdditionalResources/MedicationRequestView";
import { AuthProvider } from "./context/AuthContext";
import Box from "@mui/material/Box";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Box
          sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
        >
          <Routes>
            <Route path="/" element={<SearchContainer />} />
            <Route path="/patient/:id" element={<PatientViewWrapper />} />
            <Route path="/encounter/:id" element={<EncounterView />} />
            <Route path="/document/:id" element={<DocumentReferenceView />} />
            <Route path="/condition/:id" element={<ConditionView />} />
            <Route
              path="/diagnostic-report/:id"
              element={<DiagnosticReportView />}
            />
            <Route path="/claim/:id" element={<ClaimsView />} />
            <Route path="/explanation-of-benefit/:id" element={<EoBView />} />
            <Route path="/immunization/:id" element={<ImmunizationView />} />
            <Route path="/procedure/:id" element={<ProcedureView />} />
            <Route path="/observation/:id" element={<ObservationView />} />
            <Route
              path="/medication-request/:id"
              element={<MedicationRequestView />}
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
