import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Typography,
  Box,
  Button,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";
import Avatar from "boring-avatars";
import type { Patient } from "./patientTypes";

interface SearchResultsProps {
  patients: Patient[];
  total: number | null;
  page: number;
  pageSize: number;
  onPageChange: (e: unknown, newPage: number) => void;
  /** called when the user wants to view details for a patient */
  onView?: (id: string) => void;
}

export default function SearchResults({
  patients,
  total,
  page,
  pageSize,
  onPageChange,
  onView,
}: SearchResultsProps) {
  const navigate = useNavigate();

  const handleViewDetails = (patientId: string) => {
    // navigate first (router-driven)
    navigate(`/patient/${patientId}`);

    // // still call optional callback if provided
    if (onView) {
      onView(patientId);
    }
    // console.log("View details for patient ID:", patientId);
  };

  const stripNums = (s: string) => s.replace(/\d+/g, "").trim();

  const getName = (patient: Patient) => {
    const n = patient.name?.[0];
    const given = n?.given?.map(stripNums).join(" ") ?? "";
    const family = stripNums(n?.family ?? "");
    return [given, family].filter(Boolean).join(" ") || patient.id;
  };

  const getAddress = (patient: Patient) => {
    const a = patient.address?.[0];
    if (!a) return "—";
    return [a.line?.join(" "), a.city, a.state, a.postalCode]
      .filter(Boolean)
      .join(", ");
  };

  const getLanguage = (patient: Patient) => {
    const c = patient.communication?.[0];
    return c?.language?.text ?? c?.language?.coding?.[0]?.display ?? "—";
  };

  if (patients.length === 0) {
    return (
      <Typography>No patients found matching your search criteria.</Typography>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {`${total ?? patients.length} patient(s) found`}
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Patient Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Patient ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Birth Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Language</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id} hover>
                <TableCell>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Avatar size={80} name={getName(patient)} />
                    <Typography variant="body2">{getName(patient)}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "300px",
                    }}
                    title={patient.id}
                  >
                    {patient.id}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {patient.birthDate ?? "—"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    title={getAddress(patient)}
                    sx={{
                      maxWidth: "220px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getAddress(patient)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {getLanguage(patient)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    endIcon={<OpenInNewIcon />}
                    onClick={() => handleViewDetails(patient.id)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
