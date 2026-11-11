'use client';

import type { AppointmentListResponse } from '@mp/contracts';
import { Box, DataTable, MpStatusBadge, Typography } from '@/shared/ui';
import { formatSlot } from '@/shared/lib';

/**
 * Приёмы пациента в карточке врача (9.3): его записи с этим пациентом —
 * дата/время, статус, результат приёма. Источник — GET appointments/doctor
 * c patientId (врач видит только свои записи: sub → doctorId, 9.1/9.2).
 *
 * @param initial — SSR-первая страница (сервер ограничивает выборку;
 * при большем числе виджет показывает «Показаны N из total»).
 */
export function DoctorPatientAppointments({
  initial,
}: {
  initial: AppointmentListResponse;
}): React.JSX.Element {
  if (initial.total === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Приёмов с этим пациентом пока нет
      </Typography>
    );
  }

  return (
    <Box>
      <DataTable<AppointmentListResponse['items'][number]>
        columns={[
          {
            key: 'slot',
            header: 'Дата и время',
            mono: true,
            render: (item) => formatSlot(item.slot.localDate, item.slot.start),
          },
          {
            key: 'status',
            header: 'Статус',
            render: (item) => <MpStatusBadge status={item.status} />,
          },
          {
            key: 'result',
            header: 'Результат приёма',
            render: (item) =>
              item.visitResult?.conclusion ? (
                <Typography variant="body2" sx={{ maxWidth: 360 }}>
                  {item.visitResult.conclusion}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              ),
          },
        ]}
        rows={initial.items}
        rowKey={(item) => item.id}
        pageSize={initial.items.length}
      />
      {initial.total > initial.items.length ? (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {`Показаны первые ${initial.items.length} из ${initial.total} приёмов`}
        </Typography>
      ) : null}
    </Box>
  );
}
