import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, MpCard, MpCardContent, MpPageHeader, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { EditProfileForm } from '@/features/edit-profile';

export const metadata: Metadata = { title: 'Профиль — Администрирование' };

/**
 * Личный профиль администратора (10.1, Этап 2.1): ФИО и email — источник
 * истины Keycloak через `GET/PATCH /api/identity/me` (sub из токена, правка
 * только своих данных); занятый email → 409 с полем в форме.
 */
export default async function AdminProfilePage(): Promise<ReactNode> {
  try {
    const api = await createServerApi();
    const me = await api.identity.getMe();

    return (
      <Box sx={{ maxWidth: 760 }}>
        <MpPageHeader title="Профиль" subtitle={`${me.email} · Администратор (ADMIN)`} />
        <MpCard>
          <MpCardContent padding="lg">
            <EditProfileForm initial={me} editableNames />
          </MpCardContent>
        </MpCard>
      </Box>
    );
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    if (apiError && (apiError.status === 401 || apiError.status === 403)) {
      return <Alert severity="warning">Сессия не найдена — войдите заново.</Alert>;
    }
    return (
      <Alert severity="error" role="alert">
        Не удалось загрузить профиль: {apiError?.message ?? 'Неизвестная ошибка'}
        {apiError?.requestId ? (
          <Typography variant="caption" sx={{ display: 'block' }}>
            requestId: {apiError.requestId}
          </Typography>
        ) : null}
      </Alert>
    );
  }
}
