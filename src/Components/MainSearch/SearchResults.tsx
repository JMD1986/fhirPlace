import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Button,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface Patient {
  id: string;
  name: string;
  filename: string;
  resourceType: string;
}

interface SearchResultsProps {
  patients: Patient[];
}

export default function SearchResults({ patients }: SearchResultsProps) {
  const handleViewDetails = (patientId: string) => {
    // TODO: Navigate to patient details page or open a modal
    console.log("View details for patient:", patientId);
  };

  if (patients.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: "center", backgroundColor: "#f5f5f5" }}>
        <Typography variant="body1" color="textSecondary">
          No patients found matching your search criteria.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Results ({patients.length} patients found)
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Patient Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Patient ID</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Resource Type</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id} hover>
                <TableCell>{patient.name}</TableCell>
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
                <TableCell>{patient.resourceType}</TableCell>
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
    </Box>
  );
}
