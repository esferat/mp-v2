import type { Metadata } from 'next';
import { RoleLanding } from '@/widgets/role-landing';

export const metadata: Metadata = { title: 'Кабинет врача — Медицинский портал' };

/**
 * Лендинг врача после входа (новое требование): обзор доступного
 * функционала карточками. Маршрут защищён гардом роли DOCTOR (1.3).
 */
export default function DoctorLandingPage(): React.JSX.Element {
  return (
    <RoleLanding
      section="/doctor"
      title="Кабинет врача"
      subtitle="Приёмы, расписание и пациенты — выберите раздел"
    />
  );
}
