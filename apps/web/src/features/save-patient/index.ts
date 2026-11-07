/**
 * Публичный API слайса (fsd.md §5): сохранение профиля пациента (4.2).
 */
export { savePatient, toIsoDate, toPatientFormValues, validatePatientForm } from './save-patient';
export type { PatientFormErrors, PatientFormValues } from './validate';
