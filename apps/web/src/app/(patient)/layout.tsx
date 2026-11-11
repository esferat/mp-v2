import type { ReactNode } from 'react';
import { SectionLayout } from '@/widgets/layout';

/**
 * Layout кабинета пациента (2.1): route group (patient), пути /patient/*.
 * Доступ — роль USER (гард в src/proxy.ts, 1.3).
 */
export default function PatientLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <SectionLayout
      section="/patient"
      title="Кабинет пациента"
      description="Запись на приём, история и документы пациента"
    >
      {children}
    </SectionLayout>
  );
}
