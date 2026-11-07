'use client';

import { useCallback, useState } from 'react';
import { PatientDocuments } from '@/widgets/patient-documents';
import { UploadPatientDocument } from '@/features/upload-patient-document';

/**
 * Документы пациента в кабинете врача (9.3): загрузка + список в одном
 * клиентском контейнере — успешная загрузка инвалидирует список
 * (счётчик ключа перезапускает useEffect списка).
 */
export function DoctorPatientDocuments({ patientId }: { patientId: string }): React.JSX.Element {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploaded = useCallback(() => setRefreshKey((value) => value + 1), []);

  return (
    <>
      <PatientDocuments key={refreshKey} patientId={patientId} />
      <UploadPatientDocument patientId={patientId} onUploaded={handleUploaded} />
    </>
  );
}
