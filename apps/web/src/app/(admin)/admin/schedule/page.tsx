import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  appointmentStatusSchema,
  type AppointmentListQuery,
  type AppointmentListResponse,
  type DoctorListItem,
} from '@mp/contracts';
import { Alert, Box, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { cachedCatalog, CATALOG_TAGS, getSpecializationsCached } from '@/shared/api/catalog-cache';
import { AppointmentsTable } from '@/widgets/appointments-table';

export const metadata: Metadata = { title: 'Управление записями — Администрирование' };

const LIMIT = 10;

interface Filters {
  status?: string;
  specId?: string;
  doctorId?: string;
  from?: string;
  to?: string;
}

function readFilters(raw: Record<string, string | undefined>): Filters {
  const status =
    raw.status && appointmentStatusSchema.safeParse(raw.status).success ? raw.status : undefined;
  const date = (value: string | undefined): string | undefined =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  return {
    ...(status ? { status } : {}),
    ...(raw.specId ? { specId: raw.specId } : {}),
    ...(raw.doctorId ? { doctorId: raw.doctorId } : {}),
    ...(date(raw.from) ? { from: date(raw.from) } : {}),
    ...(date(raw.to) ? { to: date(raw.to) } : {}),
  };
}

/**
 * Управление записями (5.4): SSR по ?page/status/specId/doctorId/from/to —
 * F5 восстанавливает фильтры (AC 2.5), действия — клиентский остов виджета.
 */
export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<ReactNode> {
  const raw = await searchParams;
  const filters = readFilters(raw);
  const pageValue = Number(raw.page ?? '0');
  const offset = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) * LIMIT : 0;

  try {
    const api = await createServerApi();
    const [initial, specializations, doctors] = await Promise.all([
      api.scheduling.getAppointments({ offset, limit: LIMIT, ...filters } as AppointmentListQuery),
      // Справочники — серверный кэш (2.6): записи не кэшируем, они меняются часто
      getSpecializationsCached(api),
      cachedCatalog(['doctors', 'limit-100'], CATALOG_TAGS.doctors, () =>
        api.catalog.getDoctors({ limit: 100 }),
      ),
    ]);

    const doctorOptions = doctors.items.map((doctor: DoctorListItem) => ({
      id: doctor.id,
      name: `${doctor.lastName} ${doctor.firstName}`,
    }));

    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Управление записями ({(initial as AppointmentListResponse).total})
        </Typography>
        <AppointmentsTable
          initial={initial as AppointmentListResponse}
          initialFilters={filters}
          specializations={specializations}
          doctors={doctorOptions}
        />
      </Box>
    );
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить записи: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
