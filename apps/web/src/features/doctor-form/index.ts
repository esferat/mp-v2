/**
 * Публичный API слайса (fsd.md S5): форма врача (3.2).
 */
export { DoctorForm } from './doctor-form';
export {
  DAY_LABELS,
  DURATION_OPTIONS,
  formatMinutes,
  isFormField,
  schedulePreview,
  toMinutes,
  validateDoctorForm,
} from './validate';
export type { DoctorFormField, DoctorFormErrors, DoctorFormValues } from './validate';
