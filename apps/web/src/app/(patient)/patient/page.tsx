import type { Metadata } from 'next';
import { RoleLanding } from '@/widgets/role-landing';

export const metadata: Metadata = { title: 'Кабинет пациента — Медицинский портал' };

/**
 * Лендинг пациента после входа (новое требование): обзор доступного
 * функционала карточками. Маршрут защищён гардом роли USER (1.3).
 */
export default function PatientLandingPage(): React.JSX.Element {
  return (
    <RoleLanding
      section="/patient"
      title="Кабинет пациента"
      subtitle="Запись к врачу, история приёмов и документы — выберите раздел"
    />
  );
}
