import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1565c0', // darkened from #1976d2 → WCAG AA contrast ≥ 4.5:1 on #f5f5f5
    },
    secondary: {
      main: '#b00036', // darkened for contrast (was #dc004e)
      contrastText: '#fff',
    },
    text: {
      primary: '#1a1a1a',
      secondary: '#444', // darker for better contrast
      disabled: '#757575', // darker for better contrast
    },
    action: {
      disabled: '#bdbdbd', // slightly darker
      disabledBackground: '#e0e0e0',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingTop: '20px',
          paddingBottom: '20px',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#fff',
            '& input::placeholder': {
              color: '#757575', // darker placeholder for contrast
              opacity: 1,
            },
          },
        },
      },
    },
  },
});
