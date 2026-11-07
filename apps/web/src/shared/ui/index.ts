/**
 * Единый экспорт дизайн-системы (задача 2.2).
 *
 * Правило: @mui/* импортируется ТОЛЬКО в этом слое (fsd.md §6, п.8 —
 * проверяется линтом и намеренным нарушением); страницы и виджеты
 * собираются отсюда. Токены — только через тему (shared/ui/theme).
 */

// Провайдеры темы и дат (SSR-совместимый кэш Emotion, date-fns адаптер)
export { UiProviders } from './providers';
export { theme } from './theme';
export { DatePickersProvider } from './date-pickers';

// Примитивы MUI
export * from './primitives';

// Библиотека компонентов mp-ui-kit (единственные Mp*-компоненты в web)
export * from 'mp-ui-kit';

// Предметные обёртки
export { StatusBadge } from './status-badge';
export type { StatusTone } from './status-badge';
export { EmptyState } from './empty-state';
export { FormField } from './form-field';
export { DataTable, Spinner } from './data-table';
export type { DataTableProps, TableColumn } from './data-table';
export { AppModal } from './app-modal';
export { ToastProvider, useToast } from './toast';
export type { ToastTone } from './toast';
export { DateField, DateRangeField } from './date-pickers';
export { ImageCropper } from './image-cropper';
export type { CropArea } from './image-cropper';
export { ErrorState } from './error-state';
export { PaginationBar } from './pagination-bar';
export { LinkButton } from './link-button';
