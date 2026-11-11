import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { auth } from '@/shared/config/auth';
import { MyDocuments } from '@/widgets/my-documents';

export const metadata: Metadata = { title: 'Мои документы — Кабинет' };

/**
 * Раздел «Мои документы» (4.4/4.5): сканы пациента из реестра file-service
 * с presigned-скачиванием и отдельной загрузкой. Перенесено из профиля
 * в отдельный пункт бокового меню (макет: разделы кабинета).
 */
export default async function MyDocumentsPage(): Promise<ReactNode> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return (
        <Alert severity="warning" role="alert">
          Сессия не найдена — войдите заново.
        </Alert>
      );
    }

    const api = await createServerApi();
    const patient = await api.patient.getByUser(userId);

    return (
      <MyDocuments
        patientId={patient.id}
        patientName={`${patient.lastName} ${patient.firstName}`}
      />
    );
  } catch (error) {
    // Не-API ошибки (в т.ч. NEXT_REDIRECT «на вход» после неудачного
    // refresh токена) — наружу: catch не должен поглощать редирект
    if (!(error instanceof ApiError)) throw error;
    const apiError = error;
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить документы: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
