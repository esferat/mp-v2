/**
 * Публичный API процесса (fsd.md §5): единственный вход для вышестоящих
 * слоёв (controller фичи register) и app-сборки.
 */
export { registerUser } from './register-user';
export type { RegisterSagaDeps } from './register-user';
