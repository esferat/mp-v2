import { LinkButton } from '@/shared/ui';

/**
 * Панель управления списком врачей (3.2): создание нового врача.
 * Вынесена в виджет, чтобы шапка страницы оставалась тонкой (FSD).
 */
export function DoctorControls(): React.JSX.Element {
  return (
    <LinkButton href="/admin/doctors/new" variant="contained">
      Создать врача
    </LinkButton>
  );
}
