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
import { PatientForm } from '@/widgets/patient-form';
import { UploadPhoto } from '@/features/upload-photo';

export const metadata: Metadata = { title: 'Профиль — Кабинет' };

/**
 * Профиль пациента (4.2/4.3): карточка по sub из токена (SSR),
 * форма редактирования (4.2) в белой карточке, аватар с кропом (4.3).
 *
 * Разделение функций: аватар — своя колонка слева (обновляет только
 * владелец), документы — отдельный раздел меню «Мои документы»
 * (/patient/documents, 4.4/4.5) со своей загрузкой.
 */
export default async function ProfilePage(): Promise<ReactNode> {
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
      <Box>
        <MpPageHeader
          title="Профиль"
          subtitle={`${patient.lastName} ${patient.firstName} · Пациент (USER)`}
        />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{ alignItems: { sm: 'flex-start' } }}
        >
          <Stack spacing={1.5} sx={{ alignItems: 'center', maxWidth: 220 }}>
            <Typography variant="subtitle1">
              {`${patient.lastName} ${patient.firstName}`}
            </Typography>
            <MpAvatar
              {...(patient.photoUrl ? { src: patient.photoUrl } : {})}
              name={`${patient.lastName} ${patient.firstName}`}
              size="xl"
              sx={{ width: 150, height: 150, fontSize: 60 }}
            />
            <UploadPhoto ownerType="PATIENT" ownerId={patient.id} />
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              JPEG, PNG или WebP, до 5 МБ
            </Typography>
          </Stack>

          <Stack spacing={3} sx={{ flex: 1, minWidth: 0 }}>
            {/* Белая карточка за полями ввода (как в профилях врача/админа) */}
            <MpCard>
              <MpCardContent padding="lg">
                <PatientForm patient={patient} />
              </MpCardContent>
            </MpCard>
          </Stack>
        </Stack>
      </Box>
    );
  } catch (error) {
    // Не-API ошибки (в т.ч. NEXT_REDIRECT «на вход» после неудачного
    // refresh токена) — наружу: catch не должен поглощать редирект
    if (!(error instanceof ApiError)) throw error;
    const apiError = error;
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
