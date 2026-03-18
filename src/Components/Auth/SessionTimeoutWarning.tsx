import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

interface SessionTimeoutWarningProps {
  open: boolean;
  secondsLeft: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export default function SessionTimeoutWarning({
  open,
  secondsLeft,
  onStayLoggedIn,
  onLogout,
}: SessionTimeoutWarningProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeDisplay =
    minutes > 0
      ? `${minutes}:${seconds.toString().padStart(2, "0")}`
      : `${seconds}s`;

  return (
    <Dialog open={open} disableEscapeKeyDown>
      <DialogTitle>Session Expiring</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Your session will expire due to inactivity in{" "}
          <strong>{timeDisplay}</strong>. Do you want to stay logged in?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onLogout} color="inherit">
          Log out
        </Button>
        <Button onClick={onStayLoggedIn} variant="contained" autoFocus>
          Stay logged in
        </Button>
      </DialogActions>
    </Dialog>
  );
}
