'use client';

import { useCallback, useState } from 'react';
import { Box, MpPageHeader, Stack, Typography } from '@/shared/ui';
import { PatientDocuments } from '@/widgets/patient-documents';
import { UploadPatientDocument } from '@/features/upload-patient-document';

/**
 * Раздел «Мои документы» (4.4/4.5): сканы пациента + своя загрузка.
 *
 * Кнопка «Загрузить документ» — в шапке раздела (actions MpPageHeader),
 * как кнопки действий в других разделах («Добавить врача» у админа):
 * contained medium справа от заголовка, ниже — список с пагинацией.
 *
 * Загрузка документов отделена от аватара профиля (фото — в профиле).
 * Доступ file-service: PATIENT-объект + владелец (userId = sub) → allowed.
 */
export function MyDocuments({
  patientId,
  patientName,
}: {
  patientId: string;
  /** ФИО пациента — подпись в шапке раздела. */
  patientName: string;
}): React.JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploaded = useCallback(() => setRefreshKey((value) => value + 1), []);

  return (
    <Box>
      <MpPageHeader
        title="Мои документы"
        subtitle={`${patientName} · анализы, направления и выписки`}
        actions={<UploadPatientDocument patientId={patientId} onUploaded={handleUploaded} />}
      />
      <Stack spacing={2}>
        <PatientDocuments key={refreshKey} patientId={patientId} />
        <Typography variant="caption" color="text.secondary">
          Форматы: PDF, JPEG или PNG, до 5 МБ. Файл проверяется по содержимому (магические байты).
        </Typography>
      </Stack>
    </Box>
  );
}
