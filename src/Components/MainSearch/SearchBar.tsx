import Box from "@mui/material/Box";
import { useState } from "react";
import Typography from "@mui/material/Typography";
import PatientSearch from "./PatientSearch";
import EncounterSearchBar from "./EncounterSearch";

export default function SearchBar() {
  const [searchType, setSearchType] = useState<"patient" | "encounter">(
    "patient",
  );
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }} onClick={() => setSearchType("patient")}>
        Search Patients
      </Typography>
      {searchType === "patient" && <PatientSearch />}
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }} onClick={() => setSearchType("encounter")}>
        Search Encounters
      </Typography>
      {searchType === "encounter" && <EncounterSearchBar />}
    </Box>
  );
}
