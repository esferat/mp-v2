'use client';

import { useCallback, useState } from 'react';
import { Stack } from '@/shared/ui';
import { PatientDocuments } from '@/widgets/patient-documents';
import { UploadPatientDocument } from '@/features/upload-patient-document';

/**
 * Секция «Документы» в профиле пациента (4.4/4.5): список сканов +
 * отдельная загрузка документа (категория → файл, PDF/JPEG/PNG ≤ 5 МБ).
 *
 * Загрузка документов тут — отдельная от аватара функция: фото профиля
 * меняется кнопкой «Загрузить фото» в колонке аватара, документы —
 * своей кнопкой в этой секции. Успешная загрузка инвалидирует список
 * (счётчик ключа перезапускает useEffect).
 *
 * Доступ file-service: PATIENT-объект + владелец (userId = sub) → allowed.
 */
export function ProfileDocuments({ patientId }: { patientId: string }): React.JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploaded = useCallback(() => setRefreshKey((value) => value + 1), []);

  return (
    <Stack spacing={2}>
      <PatientDocuments key={refreshKey} patientId={patientId} />
      <UploadPatientDocument patientId={patientId} onUploaded={handleUploaded} />
    </Stack>
  );
}
