import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { MenuItem, Paper, Menu, Tooltip, Box, Chip } from "@mui/material";
import { useState } from "react";
import EncounterSearch from "../Encounter/EncounterSearch";
import PatientSearch from "../Patient/PatientSearch";
import LoginSignupDialog from "../Auth/LoginSignupDialog";
import { useAuth } from "../../context/AuthContext";

const SEARCH_TYPE_KEY = "fhirPlace_lastSearchType";
type SearchType = "patient" | "encounter";

export default function SearchContainer() {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const savedType = (localStorage.getItem(SEARCH_TYPE_KEY) ??
    "patient") as SearchType;
  const [displayEncounterSearch, setDisplayEncounterSearch] = useState(
    savedType === "encounter",
  );
  const [displayPatientSearch, setDisplayPatientSearch] = useState(
    savedType === "patient",
  );
  const [searchTitle, setSearchTitle] = useState(
    savedType === "encounter" ? "Encounter Search" : "Patient Search",
  );

  const setSearchType = (type: SearchType) => {
    localStorage.setItem(SEARCH_TYPE_KEY, type);
    setDisplayEncounterSearch(type === "encounter");
    setDisplayPatientSearch(type === "patient");
    setSearchTitle(
      type === "encounter" ? "Encounter Search" : "Patient Search",
    );
  };

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
    setSearchType("encounter");
  };

  const displayPatients = () => {
    handleMenuClose();
    setSearchType("patient");
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
          </Menu>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {searchTitle}
          </Typography>
          {user ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Tooltip title={user.email}>
                <Chip
                  icon={<AccountCircleIcon />}
                  label={user.username}
                  color="default"
                  sx={{
                    color: "white",
                    borderColor: "rgba(255,255,255,0.5)",
                    "& .MuiChip-icon": { color: "white" },
                  }}
                  variant="outlined"
                />
              </Tooltip>
              <Button color="inherit" onClick={logout}>
                Logout
              </Button>
            </Box>
          ) : (
            <Button color="inherit" onClick={() => setAuthOpen(true)}>
              Login
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <LoginSignupDialog open={authOpen} onClose={() => setAuthOpen(false)} />
      <Box sx={{ width: "100%", mt: 4, px: 3 }}>
        <Paper elevation={0} sx={{ p: 3, backgroundColor: "#f5f5f5" }}>
          {displayPatientSearch && <PatientSearch />}
          {displayEncounterSearch && <EncounterSearch />}
        </Paper>
      </Box>
    </>
  );
}
