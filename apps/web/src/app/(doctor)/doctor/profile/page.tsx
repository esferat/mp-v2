import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Alert, Box, MpCard, MpCardContent, MpPageHeader, Stack, Typography } from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { auth } from '@/shared/config/auth';
import { EditProfileForm } from '@/features/edit-profile';

export const metadata: Metadata = { title: 'Профиль — Кабинет врача' };

/**
 * Личный профиль врача (10.1, Этап 2.1): email правит сам врач через
 * `GET/PATCH /api/identity/me` (sub из токена); ФИО и специализация —
 * read-only (правка — админом в форме 3.2).
 */
export default async function DoctorProfilePage(): Promise<ReactNode> {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return <Alert severity="warning">Сессия не найдена — войдите заново.</Alert>;
    }

    const api = await createServerApi();
    const [me, doctor] = await Promise.all([api.identity.getMe(), api.catalog.getMyDoctor()]);

    return (
      <Box sx={{ maxWidth: 760 }}>
        <MpPageHeader title="Профиль" subtitle={`${me.email} · Врач (DOCTOR)`} />
        <MpCard>
          <MpCardContent>
            <EditProfileForm
              initial={me}
              details={
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Специализация
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {doctor.specializationName}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Статус карточки
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {doctor.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
                    </Typography>
                  </Box>
                </Stack>
              }
            />
          </MpCardContent>
        </MpCard>
      </Box>
    );
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    if (apiError && (apiError.status === 401 || apiError.status === 403)) {
      return <Alert severity="warning">Сессия не найдена — войдите заново.</Alert>;
    }
    if (apiError?.status === 404) {
      return (
        <Alert severity="warning">
          К вашей учётной записи не привязана карточка врача — обратитесь к администратору.
        </Alert>
      );
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
