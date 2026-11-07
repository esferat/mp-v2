import type { ReactNode } from 'react';
import { SectionLayout } from '@/widgets/layout';

/**
 * Layout раздела администрирования (2.1): route group (admin).
 * Доступ — роль ADMIN (гард в src/proxy.ts, 1.3); меню — только ADMIN-пункты.
 */
export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <SectionLayout
      section="/admin"
      title="Администрирование"
      description="Врачи, специализации, пациенты и отчёты портала"
    >
      {children}
    </SectionLayout>
  );
}
