import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

interface AccessDeniedProps {
  title?: string;
  message: string;
  onBack?: () => void;
}

export default function AccessDenied({
  title = "Access denied",
  message,
  onBack,
}: AccessDeniedProps) {
  return (
    <Box sx={{ p: 4, maxWidth: 560, mx: "auto", mt: 6 }}>
      <Alert
        severity="warning"
        action={
          onBack ? (
            <Button color="inherit" size="small" onClick={onBack}>
              Go back
            </Button>
          ) : undefined
        }
      >
        <AlertTitle>{title}</AlertTitle>
        {message}
      </Alert>
    </Box>
  );
}
