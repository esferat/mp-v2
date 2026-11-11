import type { Metadata } from 'next';
import { RoleLanding } from '@/widgets/role-landing';

export const metadata: Metadata = { title: 'Администрирование — Медицинский портал' };

/**
 * Лендинг администратора после входа (новое требование): обзор доступного
 * функционала карточками. Маршрут защищён гардом роли ADMIN (1.3).
 */
export default function AdminLandingPage(): React.JSX.Element {
  return (
    <RoleLanding
      section="/admin"
      title="Администрирование"
      subtitle="Справочники, управление записями и отчёты — выберите раздел"
    />
  );
}
