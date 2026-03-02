import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import { Container, MenuItem, Paper, Menu } from "@mui/material";
import SearchBar from "./SearchBar";
import { useState } from "react";
import EncounterSearchBar from "./EncounterSearch";
import PatientSearch from "./PatientSearch";

export default function SearchContainer() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // const open = Boolean(anchorEl);
  const [open, setOpen] = useState(false);
  const [displayEncounterSearch, setDisplayEncounterSearch] = useState(false);
  const [displayPatientSearch, setDisplayPatientSearch] = useState(true);

  // IconButton onClick: setAnchorEl(event.currentTarget)
  // Menu onClose: setAnchorEl(null)
  // MenuItem onClick: handle selection + setAnchorEl(null)

  const handleMenuOpen = () => {
    setOpen(true);
  };

  const handleMenuClose = () => {
    setOpen(false);
  };

  const displayEncounters = () => {
    handleMenuClose();
    setDisplayEncounterSearch(true);
    setDisplayPatientSearch(false);
  };

  const displayPatients = () => {
    handleMenuClose();
    setDisplayEncounterSearch(false);
    setDisplayPatientSearch(true);
  };

  const handleClose = () => {
    // setAnchorEl(null);
  };
  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={(event) => setAnchorEl(event.currentTarget)}
          >
            <MenuIcon onClick={handleMenuOpen} />
          </IconButton>
          <Menu
            id="basic-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            slotProps={{
              list: {
                "aria-labelledby": "basic-button",
              },
            }}
          >
            <MenuItem onClick={displayPatients}>Patient Search</MenuItem>
            <MenuItem onClick={displayEncounters}>Encounter Search</MenuItem>
            <MenuItem onClick={handleClose}>Logout</MenuItem>
          </Menu>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            FHIR Patient Search
          </Typography>
          <Button color="inherit">Login</Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg">
        <Paper elevation={0} sx={{ mt: 4, p: 3, backgroundColor: "#f5f5f5" }}>
          {displayPatientSearch && <PatientSearch />}
          {displayEncounterSearch && <EncounterSearchBar />}
        </Paper>
      </Container>
    </>
  );
}

//   return (
//     <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
//       <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }} onClick={() => setSearchType("patient")}>
//         Search Patients
//       </Typography>
//       {searchType === "patient" && <PatientSearch />}
//       <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 1 }} onClick={() => setSearchType("encounter")}>
//         Search Encounters
//       </Typography>
//       {searchType === "encounter" && <EncounterSearchBar />}
//     </Box>
//   );
// }
