import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import SearchIcon from "@mui/icons-material/Search";

export default function PatientSearch() {
  const [searchParams, setSearchParams] = useState({
    name: "",
    familyName: "",
    givenName: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSearchParams((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement actual search functionality
    console.log("Searching for:", searchParams);
  };

  return (
    <Box component="form" onSubmit={handleSearch} noValidate>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Patient Name"
            name="name"
            value={searchParams.name}
            onChange={handleChange}
            placeholder="Enter patient name"
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Family Name"
            name="familyName"
            value={searchParams.familyName}
            onChange={handleChange}
            placeholder="Enter family name"
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Given Name"
            name="givenName"
            value={searchParams.givenName}
            onChange={handleChange}
            placeholder="Enter given name"
            variant="outlined"
          />
        </Grid>
        <Grid
          item
          xs={12}
          sm={6}
          sx={{ display: "flex", alignItems: "flex-end" }}
        >
          <Button
            fullWidth
            variant="contained"
            color="primary"
            startIcon={<SearchIcon />}
            type="submit"
            sx={{ height: "56px" }}
          >
            Search Patients
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
