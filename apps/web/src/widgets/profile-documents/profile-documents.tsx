'use client';

import { useCallback, useState } from 'react';
import { Stack } from '@/shared/ui';
import { PatientDocuments } from '@/widgets/patient-documents';
import { UploadPatientDocument } from '@/features/upload-patient-document';

/**
 * Секция «Документы» в профиле пациента (4.4/4.5): сверху — компактная
 * кнопка отдельной загрузки документа (категория → файл, PDF/JPEG/PNG
 * ≤ 5 МБ), ниже — список сканов с пагинацией (максимум 5 на страницу).
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
      <UploadPatientDocument patientId={patientId} onUploaded={handleUploaded} size="small" />
      <PatientDocuments key={refreshKey} patientId={patientId} />
    </Stack>
  );
}
