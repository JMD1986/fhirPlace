import { useState } from "react";
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  TextField,
  Divider,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import type {
  SavedSearch,
  PatientSearchParams,
  EncounterSearchParams,
} from "../../hooks/hookTypes";

interface Props<T extends PatientSearchParams | EncounterSearchParams> {
  searches: SavedSearch<T>[];
  maxSaved: number;
  currentParams: T;
  onLoad: (params: T) => void;
  onSave: (name: string, params: T) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

/**
 * A self-contained "Saved Searches" dropdown button that sits above search forms.
 * Generic over the search-params type so it works for both Patient and Encounter.
 */
export default function SavedSearchBar<
  T extends PatientSearchParams | EncounterSearchParams,
>({
  searches,
  maxSaved,
  currentParams,
  onLoad,
  onSave,
  onDelete,
  onRename,
}: Props<T>) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // Save-as dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState("");

  // Rename dialog
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState("");

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isParamsEmpty = Object.values(currentParams).every((v) => !v);

  const formatLabel = (params: T): string => {
    const parts = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => {
        const key = k.replace(/([A-Z])/g, " $1").toLowerCase();
        return `${key}: ${v}`;
      });
    return parts.slice(0, 3).join(" · ") + (parts.length > 3 ? " …" : "");
  };

  // ── Save flow ─────────────────────────────────────────────────────────────
  const openSaveDialog = () => {
    setSaveName("");
    setSaveError("");
    setSaveOpen(true);
    setAnchorEl(null);
  };

  const handleSaveConfirm = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      setSaveError("Name is required.");
      return;
    }
    onSave(trimmed, currentParams);
    setSaveOpen(false);
  };

  // ── Rename flow ───────────────────────────────────────────────────────────
  const openRenameDialog = (id: string, currentName: string) => {
    setRenameId(id);
    setRenameName(currentName);
    setRenameError("");
    setAnchorEl(null);
  };

  const handleRenameConfirm = () => {
    const trimmed = renameName.trim();
    if (!trimmed) {
      setRenameError("Name is required.");
      return;
    }
    if (renameId) onRename(renameId, trimmed);
    setRenameId(null);
  };

  return (
    <>
      {/* ── Toolbar row ── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<BookmarkIcon fontSize="small" />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ textTransform: "none" }}
        >
          Saved Searches
          {searches.length > 0 && (
            <Chip
              label={searches.length}
              size="small"
              sx={{ ml: 0.75, height: 18, fontSize: "0.7rem" }}
            />
          )}
        </Button>

        <Tooltip
          title={
            isParamsEmpty
              ? "Fill in at least one field to save"
              : searches.length >= maxSaved
                ? `Max ${maxSaved} saved searches — delete one first`
                : "Save current search"
          }
        >
          <span>
            <Button
              size="small"
              variant="text"
              startIcon={<BookmarkAddIcon fontSize="small" />}
              onClick={openSaveDialog}
              disabled={isParamsEmpty || searches.length >= maxSaved}
              sx={{ textTransform: "none" }}
            >
              Save current
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* ── Dropdown menu ── */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { minWidth: 300, maxWidth: 400 } } }}
      >
        {searches.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No saved searches yet
            </Typography>
          </MenuItem>
        ) : (
          searches.map((s) => (
            <MenuItem
              key={s.id}
              onClick={() => {
                onLoad(s.params as T);
                setAnchorEl(null);
              }}
              sx={{ pr: 10 }} // leave room for action buttons
            >
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight={600}>
                    {s.name}
                  </Typography>
                }
                secondary={
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="span"
                    sx={{ display: "block", mt: 0.25 }}
                  >
                    {formatLabel(s.params as T)}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <Tooltip title="Rename">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRenameDialog(s.id, s.name);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </MenuItem>
          ))
        )}

        {searches.length > 0 && <Divider />}
        <MenuItem
          onClick={openSaveDialog}
          disabled={isParamsEmpty || searches.length >= maxSaved}
        >
          <BookmarkAddIcon
            fontSize="small"
            sx={{ mr: 1, color: "action.active" }}
          />
          <Typography variant="body2">Save current search…</Typography>
        </MenuItem>
      </Menu>

      {/* ── Save-as dialog ── */}
      <Dialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Save Search</DialogTitle>
        <DialogContent>
          {searches.length >= maxSaved && (
            <Typography variant="body2" color="warning.main" sx={{ mb: 1.5 }}>
              You have reached the {maxSaved}-search limit. Delete one to save a
              new search.
            </Typography>
          )}
          <TextField
            autoFocus
            fullWidth
            label="Search name"
            value={saveName}
            onChange={(e) => {
              setSaveName(e.target.value);
              setSaveError("");
            }}
            error={Boolean(saveError)}
            helperText={saveError || "Give this search a memorable name"}
            onKeyDown={(e) => e.key === "Enter" && handleSaveConfirm()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveConfirm}
            disabled={searches.length >= maxSaved}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Rename dialog ── */}
      <Dialog
        open={Boolean(renameId)}
        onClose={() => setRenameId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Rename Search</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="New name"
            value={renameName}
            onChange={(e) => {
              setRenameName(e.target.value);
              setRenameError("");
            }}
            error={Boolean(renameError)}
            helperText={renameError}
            onKeyDown={(e) => e.key === "Enter" && handleRenameConfirm()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameId(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleRenameConfirm}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
