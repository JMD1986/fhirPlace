import { useCallback, useEffect, useState } from "react";
import React from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Collapse,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import VerifiedIcon from "@mui/icons-material/Verified";
import GppBadIcon from "@mui/icons-material/GppBad";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import {
  queryAuditEvents,
  verifyAuditChain,
  getAuditStats,
  type AuditEventRecord,
  type AuditVerifyResponse,
  type AuditStatsResponse,
} from "../../api/auditApi";
import {
  auditFilterRangeToUtc,
  formatAuditDateTime,
} from "../../lib/timekeeping";

const ACTIONS = [
  "",
  "read",
  "search",
  "export",
  "login",
  "logout",
  "audit_query",
];
const RESOURCE_TYPES = [
  "",
  "Patient",
  "Encounter",
  "Condition",
  "DiagnosticReport",
  "DocumentReference",
  "Immunization",
  "Procedure",
  "Observation",
  "MedicationRequest",
  "Claim",
  "ExplanationOfBenefit",
  "Session",
  "AuditEvent",
];
const OUTCOMES = ["", "success", "failure"];

const actionColors: Record<
  string,
  "default" | "primary" | "success" | "warning" | "error" | "info"
> = {
  read: "primary",
  search: "info",
  export: "warning",
  login: "success",
  logout: "default",
  audit_query: "default",
};

export default function AuditLogPage() {
  const navigate = useNavigate();

  // Filters
  const [userId, setUserId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [outcome, setOutcome] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Data
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Integrity verification
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResponse | null>(
    null,
  );
  const [verifying, setVerifying] = useState(false);

  // Stats
  const [stats, setStats] = useState<AuditStatsResponse | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await queryAuditEvents({
        userId: userId || undefined,
        patientId: patientId || undefined,
        action: action || undefined,
        resourceType: resourceType || undefined,
        outcome: outcome || undefined,
        ...auditFilterRangeToUtc(startDate, endDate),
        _count: rowsPerPage,
        _offset: page * rowsPerPage,
      });
      setEvents(result.events);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit events");
    } finally {
      setLoading(false);
    }
  }, [
    userId,
    patientId,
    action,
    resourceType,
    outcome,
    startDate,
    endDate,
    page,
    rowsPerPage,
  ]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      setVerifyResult(await verifyAuditChain());
    } catch {
      setVerifyResult({
        integrityValid: false,
        chainLength: 0,
        brokenAtId: -1,
        verifiedAt: "",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleLoadStats = async () => {
    if (!showStats) {
      try {
        setStats(await getAuditStats());
      } catch {
        /* ignore */
      }
    }
    setShowStats(!showStats);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <IconButton
          onClick={() => navigate(-1)}
          size="small"
          aria-label="Go back"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 600, flexGrow: 1 }}>
          Audit Log — ONC §170.315(d)(2)
        </Typography>
        <Tooltip title="Verify hash-chain integrity (tamper detection)">
          <Button
            variant="outlined"
            size="small"
            onClick={handleVerify}
            disabled={verifying}
            startIcon={
              verifying ? <CircularProgress size={16} /> : <VerifiedIcon />
            }
          >
            Verify Integrity
          </Button>
        </Tooltip>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchEvents} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Integrity verification result */}
      {verifyResult && (
        <Alert
          severity={verifyResult.integrityValid ? "success" : "error"}
          icon={verifyResult.integrityValid ? <VerifiedIcon /> : <GppBadIcon />}
          sx={{ mb: 2 }}
          onClose={() => setVerifyResult(null)}
        >
          {verifyResult.integrityValid
            ? `Audit chain integrity verified — ${verifyResult.chainLength} records, no tampering detected.`
            : `INTEGRITY VIOLATION: Tamper detected at record #${verifyResult.brokenAtId}. Chain length: ${verifyResult.chainLength}.`}{" "}
          {verifyResult.verifiedAt
            ? `Verified at ${formatAuditDateTime(verifyResult.verifiedAt)}.`
            : "Verification time unavailable."}
        </Alert>
      )}

      {/* Stats toggle */}
      <Button
        size="small"
        onClick={handleLoadStats}
        endIcon={showStats ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ mb: 1 }}
      >
        {showStats ? "Hide" : "Show"} Statistics
      </Button>
      <Collapse in={showStats && stats !== null}>
        {stats && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="subtitle2">
                  Total Events: {stats.total}
                </Typography>
                <Typography variant="body2" color="error.main">
                  Failures: {stats.failures}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="subtitle2">By Action</Typography>
                {stats.byAction.map((a) => (
                  <Chip
                    key={a.action}
                    label={`${a.action}: ${a.count}`}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="subtitle2">By Resource</Typography>
                {stats.byResourceType.map((r) => (
                  <Chip
                    key={r.resourceType}
                    label={`${r.resourceType}: ${r.count}`}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Grid>
            </Grid>
          </Paper>
        )}
      </Collapse>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Filters
        </Typography>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              label="User ID"
              size="small"
              fullWidth
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              label="Patient ID"
              size="small"
              fullWidth
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 1.5 }}>
            <TextField
              label="Action"
              size="small"
              fullWidth
              select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(0);
              }}
            >
              {ACTIONS.map((a) => (
                <MenuItem key={a} value={a}>
                  {a || "All"}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              label="Resource Type"
              size="small"
              fullWidth
              select
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                setPage(0);
              }}
            >
              {RESOURCE_TYPES.map((r) => (
                <MenuItem key={r} value={r}>
                  {r || "All"}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 1.5 }}>
            <TextField
              label="Outcome"
              size="small"
              fullWidth
              select
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setPage(0);
              }}
            >
              {OUTCOMES.map((o) => (
                <MenuItem key={o} value={o}>
                  {o || "All"}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 1.5 }}>
            <TextField
              label="Start Date"
              type="date"
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 1.5 }}>
            <TextField
              label="End Date"
              type="date"
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(0);
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell component="th" scope="col" width={40}>
                <span
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                  }}
                >
                  Details
                </span>
              </TableCell>
              <TableCell component="th" scope="col">
                Time
              </TableCell>
              <TableCell component="th" scope="col">
                Action
              </TableCell>
              <TableCell component="th" scope="col">
                Resource
              </TableCell>
              <TableCell component="th" scope="col">
                Patient
              </TableCell>
              <TableCell component="th" scope="col">
                User
              </TableCell>
              <TableCell component="th" scope="col">
                Status
              </TableCell>
              <TableCell component="th" scope="col">
                Outcome
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <CircularProgress
                    size={24}
                    aria-label="Loading audit events"
                  />
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  align="center"
                  sx={{ py: 4, color: "text.secondary" }}
                >
                  No audit events found.
                </TableCell>
              </TableRow>
            ) : (
              events.map((evt) => (
                <React.Fragment key={evt.id}>
                  <TableRow
                    key={evt.id}
                    hover
                    onClick={() =>
                      setExpandedId(expandedId === evt.id ? null : evt.id)
                    }
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <IconButton
                        size="small"
                        aria-label={
                          expandedId === evt.id ? "Collapse row" : "Expand row"
                        }
                      >
                        {expandedId === evt.id ? (
                          <ExpandLessIcon fontSize="small" />
                        ) : (
                          <ExpandMoreIcon fontSize="small" />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell
                      sx={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}
                    >
                      {formatAuditDateTime(evt.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={evt.action}
                        size="small"
                        color={actionColors[evt.action] ?? "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {evt.resourceType}
                      {evt.resourceId && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.5 }}
                        >
                          /{evt.resourceId.slice(0, 8)}…
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>
                      {evt.patientId ? evt.patientId.slice(0, 12) + "…" : "—"}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>
                      {evt.userName}
                    </TableCell>
                    <TableCell>{evt.statusCode}</TableCell>
                    <TableCell>
                      <Chip
                        label={evt.outcome}
                        size="small"
                        color={evt.outcome === "success" ? "success" : "error"}
                        variant="filled"
                        sx={{ fontSize: "0.7rem" }}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${evt.id}-detail`}>
                    <TableCell
                      colSpan={8}
                      sx={{
                        py: 0,
                        borderBottom:
                          expandedId === evt.id ? undefined : "none",
                      }}
                    >
                      <Collapse in={expandedId === evt.id}>
                        <Box sx={{ py: 1.5, px: 2, bgcolor: "grey.50" }}>
                          <Grid container spacing={1}>
                            <Grid size={{ xs: 6, md: 3 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Full Path
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ wordBreak: "break-all" }}
                              >
                                {evt.httpMethod} {evt.requestPath}
                                {evt.queryString && `?${evt.queryString}`}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6, md: 3 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                User ID
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ wordBreak: "break-all" }}
                              >
                                {evt.userId}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6, md: 2 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Role
                              </Typography>
                              <Typography variant="body2">
                                {evt.userRole}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 6, md: 2 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Client IP
                              </Typography>
                              <Typography variant="body2">
                                {evt.clientIp ?? "—"}
                              </Typography>
                            </Grid>
                            <Grid size={{ xs: 12, md: 2 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Integrity Hash
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontFamily: "monospace",
                                  fontSize: "0.7rem",
                                  wordBreak: "break-all",
                                }}
                              >
                                {evt.integrityHash}
                              </Typography>
                            </Grid>
                            {evt.detail && (
                              <Grid size={{ xs: 12 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Detail
                                </Typography>
                                <Typography variant="body2">
                                  {evt.detail}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>
    </Box>
  );
}
