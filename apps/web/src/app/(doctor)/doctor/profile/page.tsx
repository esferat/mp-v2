import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  MpAvatar,
  MpCard,
  MpCardContent,
  MpPageHeader,
  Stack,
  Typography,
} from '@/shared/ui';
import { ApiError, createServerApi } from '@/shared/api';
import { auth } from '@/shared/config/auth';
import { EditProfileForm } from '@/features/edit-profile';
import { UploadPhoto } from '@/features/upload-photo';

export const metadata: Metadata = { title: 'Профиль — Кабинет врача' };

/**
 * Личный профиль врача (10.1, Этап 2.1): email правит сам врач через
 * `GET/PATCH /api/identity/me` (sub из токена); ФИО и специализация —
 * read-only (правка — админом в форме 3.2).
 *
 * Аватар (разделение с документами, 3.4/10.1): фото меняет только владелец
 * в своём профиле — `UploadPhoto ownerType=DOCTOR` (доступ в file-service:
 * sub → doctorId); в админской карточке врача фото больше не редактируется.
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
      <Box>
        <MpPageHeader title="Профиль" subtitle={`${me.email} · Врач (DOCTOR)`} />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{ alignItems: { sm: 'flex-start' } }}
        >
          {/* Аватар: текущее фото + обновление с кропом (4.3) */}
          <Stack spacing={1.5} sx={{ alignItems: 'center', maxWidth: 220 }}>
            <MpAvatar
              {...(doctor.photoUrl ? { src: doctor.photoUrl } : {})}
              name={`${doctor.lastName} ${doctor.firstName}`}
              size="xl"
            />
            <UploadPhoto ownerType="DOCTOR" ownerId={doctor.id} />
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              JPEG, PNG или WebP, до 5 МБ
            </Typography>
          </Stack>

          <Box sx={{ flex: 1, minWidth: 0, maxWidth: 760 }}>
            <MpCard>
              <MpCardContent>
                <EditProfileForm
                  initial={me}
                  details={
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 1 }}>
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          Специализация
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {doctor.specializationName}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
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
        </Stack>
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
