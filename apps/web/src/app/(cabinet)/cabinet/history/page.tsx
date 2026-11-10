import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { AppointmentStatus } from '@mp/contracts';
import { appointmentStatusSchema } from '@mp/contracts';
import { Alert, Box, MpPageHeader, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { getSpecializationsCached } from '@/shared/api/catalog-cache';
import { HistoryTable } from '@/widgets/history-table';

export const metadata: Metadata = { title: 'История приёмов — Кабинет' };

const LIMIT = 10;

/** Фильтры из URL: статус валидируется контрактом, мусор игнорируется. */
function readFilters(raw: { status?: string; specId?: string }): {
  status?: AppointmentStatus;
  specId?: string;
} {
  const parsed = raw.status ? appointmentStatusSchema.safeParse(raw.status) : null;
  const status = parsed?.success ? parsed.data : undefined;
  return { ...(status ? { status } : {}), ...(raw.specId ? { specId: raw.specId } : {}) };
}

function readOffset(page?: string): number {
  const value = Number(page ?? '0');
  return Number.isFinite(value) && value > 0 ? Math.floor(value) * LIMIT : 0;
}

/**
 * История записей пациента (5.5): SSR читает ?page/status/specId из URL —
 * F5 восстанавливает состояние (AC 2.5), контент отдаётся в HTML (2.6).
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; specId?: string }>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const filters = readFilters(params);
  const offset = readOffset(params.page);

  try {
    const api = await createServerApi();
    const [initial, specializations] = await Promise.all([
      api.scheduling.getMyAppointments({ offset, limit: LIMIT, ...filters }),
      getSpecializationsCached(api),
    ]);

    return (
      <Box>
        <MpPageHeader title="История записей" subtitle={`Всего: ${initial.total}`} />
        <HistoryTable
          initial={initial}
          initialFilters={filters}
          specializations={specializations}
        />
      </Box>
    );
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить историю: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
