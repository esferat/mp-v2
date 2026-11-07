/**
 * Публичный API процесса (fsd.md §5): единственный вход для вышестоящих
 * слоёв (controller фичи register-doctor) и app-сборки.
 */
export { registerDoctor } from './register-doctor';
export type { RegisterDoctorSagaDeps } from './register-doctor';
