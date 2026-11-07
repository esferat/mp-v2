import { createTheme, type Theme } from '@mui/material';

/**
 * Единая тема портала (2.2: дизайн-система в shared/ui — все компоненты
 * берут токены отсюда, прямой импорт @mui/* во фичах запрещён FSD-линтом).
 */
export const theme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#00897b' },
    error: { main: '#d32f2f' },
    background: { default: '#f5f7fa' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { elevation: 1 } },
  },
});
