import "./App.css";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import SearchContainer from "./components/MainSearch/SearchContainer";
import PatientView from "./components/Patient/PatientView";
import EncounterView from "./components/Encounter/EncounterView";
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
