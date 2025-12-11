import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PatientSearch from "./PatientSearch";

export default function SearchBar() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }}>
        Search Patients
      </Typography>
      <PatientSearch />
    </Box>
  );
}
