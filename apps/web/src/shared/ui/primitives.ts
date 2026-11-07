/**
 * Примитивы MUI (задача 2.2): ЕДИНСТВЕННОЕ место, где импортируется @mui.
 * Прямой импорт @mui/* вне shared/ui блокируется линтом (fsd.md §6, п.8).
 *
 * Страницы и виджеты собираются из этих примитивов и предметных обёрток —
 * смена токена темы меняет весь портал, а переопределение компонента —
 * только здесь (единая точка).
 */

export {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem as MenuDropdownItem,
  Paper,
  Skeleton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';

export { default as Alert } from '@mui/material/Alert';
export { default as MuiAlert } from '@mui/material/Alert';
export { default as MuiDialog } from '@mui/material/Dialog';
export { default as MuiDialogActions } from '@mui/material/DialogActions';
export { default as MuiDialogContent } from '@mui/material/DialogContent';
export { default as MuiDialogTitle } from '@mui/material/DialogTitle';
export { default as MuiMenu } from '@mui/material/Menu';
export { default as MuiSnackbar } from '@mui/material/Snackbar';
export { default as MuiTextField } from '@mui/material/TextField';
export { default as MuiMenuItem } from '@mui/material/MenuItem';
export { default as MuiSelect } from '@mui/material/Select';
export { default as MuiFormControl } from '@mui/material/FormControl';
export { default as MuiInputLabel } from '@mui/material/InputLabel';
export { default as MuiFormHelperText } from '@mui/material/FormHelperText';
export { default as MuiTable } from '@mui/material/Table';
export { default as MuiTableBody } from '@mui/material/TableBody';
export { default as MuiTableCell } from '@mui/material/TableCell';
export { default as MuiTableContainer } from '@mui/material/TableContainer';
export { default as MuiTableHead } from '@mui/material/TableHead';
export { default as MuiTableRow } from '@mui/material/TableRow';
export { default as MuiTablePagination } from '@mui/material/TablePagination';
export { default as MuiFormControlLabel } from '@mui/material/FormControlLabel';
export { default as MuiSwitch } from '@mui/material/Switch';
export { default as MuiTab } from '@mui/material/Tab';
export { default as MuiTabs } from '@mui/material/Tabs';
