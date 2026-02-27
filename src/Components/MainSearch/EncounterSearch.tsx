import { useState, useEffect } from "react";
import { Button } from "@mui/material";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";

export default function EncounterSearchBar() {
    const [filteredEncounters, setFilteredEncounters] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searched, setSearched] = useState(false);
    useEffect(() => {
      const fetchEncounters = async () => {
        try {
          setLoading(true);
          const response = await fetch("http://localhost:5000/api/encounters");
          if (!response.ok) throw new Error("Failed to fetch encounters");
          const encounters = await response.json();
          setFilteredEncounters(encounters); // display all when component mounts
          setError(null);
        } catch (err) {
          setError("Failed to load encounters from server");
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
  
      fetchEncounters();
    }, []);
  
  return (
    <Box
      component="form"
      sx={{ "& .MuiTextField-root": { m: 1, width: "25ch" } }}
      noValidate
      autoComplete="off"
    >
      <div>
        <TextField
          required
          id="outlined-required"
          label="Name"
          defaultValue="Hello World"
        />
        <TextField
          disabled
          id="outlined-disabled"
          label="Disabled"
          defaultValue="Hello World"
        />
        <TextField
          id="outlined-password-input"
          label="Password"
          type="password"
          autoComplete="current-password"
        />
        <TextField
          id="outlined-read-only-input"
          label="Read Only"
          defaultValue="Hello World"
          slotProps={{
            input: {
              readOnly: true,
            },
          }}
        />
        <TextField id="outlined-search" label="Search field" type="search" />
        <TextField
          id="outlined-helperText"
          label="Helper text"
          defaultValue="Default Value"
          helperText="Some important text"
        />
      </div>
      <Button variant="contained" color="primary" onClick={()=>console.log(filteredEncounters)}>Search Encounters</Button>
    </Box>
  );
}
