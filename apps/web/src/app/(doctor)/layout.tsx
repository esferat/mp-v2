import type { ReactNode } from 'react';
import { SectionLayout } from '@/widgets/layout';

/**
 * Layout кабинета врача (2.1): route group (doctor).
 * Доступ — роль DOCTOR (гард в src/proxy.ts, 1.3).
 */
export default function DoctorLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <SectionLayout section="/doctor" title="Кабинет врача" description="Приёмы и пациенты">
      {children}
    </SectionLayout>
  );
}
