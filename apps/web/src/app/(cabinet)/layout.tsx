import type { ReactNode } from 'react';
import { SectionLayout } from '@/widgets/layout';

/**
 * Layout личного кабинета пациента (2.1): route group (cabinet).
 * Доступ — роль USER (гард в src/proxy.ts, 1.3).
 */
export default function CabinetLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <SectionLayout
      section="/cabinet"
      title="Личный кабинет"
      description="Запись на приём, история и профиль пациента"
    >
      {children}
    </SectionLayout>
  );
}
