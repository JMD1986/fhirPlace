/* eslint-disable react-refresh/only-export-components */
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TablePagination from "@mui/material/TablePagination";
import type { FhirCoding, FhirEncounter } from "./encounterTypes";
export type { FhirCoding, FhirEncounter };

// ── Helpers ───────────────────────────────────────────────────────────────────
import {
  stripNums,
  getType,
  getPatientDisplay,
  getPractitioner,
  getLocation,
  formatDate,
  statusColor,
} from "../../helpers/encounterUtils";

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  encounters: FhirEncounter[];
  total: number | null;
  page: number;
  pageSize: number;
  onPageChange: (e: unknown, newPage: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EncounterSearchResults({
  encounters,
  total,
  page,
  pageSize,
  onPageChange,
}: Props) {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {`${total ?? encounters.length} encounter(s) found`}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "primary.main" }}>
              {[
                "Patient",
                "Type",
                "Class",
                "Status",
                "Date",
                "Practitioner",
                "Location",
                "",
              ].map((h) => (
                <TableCell key={h} sx={{ color: "white", fontWeight: 600 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {encounters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  No encounters found.
                </TableCell>
              </TableRow>
            ) : (
              encounters.map((enc) => (
                <TableRow
                  key={enc.id}
                  hover
                  sx={{ "&:last-child td": { border: 0 } }}
                >
                  <TableCell>{getPatientDisplay(enc)}</TableCell>
                  <TableCell>{getType(enc)}</TableCell>
                  <TableCell>
                    <Chip
                      label={enc.class?.code ?? "—"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={enc.status ?? "—"}
                      size="small"
                      color={statusColor(enc.status)}
                    />
                  </TableCell>
                  <TableCell>{formatDate(enc.period?.start)}</TableCell>
                  <TableCell>{getPractitioner(enc)}</TableCell>
                  <TableCell>{getLocation(enc)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/encounter/${enc.id}`)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {(total ?? 0) > pageSize && (
        <TablePagination
          component="div"
          count={total ?? 0}
          page={page}
          onPageChange={onPageChange}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
        />
      )}
    </Box>
  );
}
