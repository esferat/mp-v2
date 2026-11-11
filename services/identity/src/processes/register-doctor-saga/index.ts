/**
 * Публичный API процесса (fsd.md §5): единственный вход для вышестоящих
 * слоёв (controller фичи register-doctor) и app-сборки.
 */
export { createDoctorAccount, registerDoctor } from './register-doctor';
export type { CreateDoctorAccountCommand, RegisterDoctorSagaDeps } from './register-doctor';
