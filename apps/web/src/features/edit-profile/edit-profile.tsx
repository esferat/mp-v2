'use client';

import { type ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MeProfile } from '@mp/contracts';
import { Box, MpAlert, MpButton, MpTextField, Stack, Typography, useToast } from '@/shared/ui';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EditProfileFormProps {
  initial: MeProfile;
  /**
   * Правка ФИО доступна только админу (10.1): у врача ФИО/специализация
   * read-only — их правит администратор в форме 3.2.
   */
  editableNames?: boolean;
  /** Read-only блок сверху (врач: ФИО, специализация, статус). */
  details?: ReactNode;
}

/**
 * Форма личного профиля (10.1, Этап 2.1): правка СВОИХ данных через
 * `PATCH /api/identity/me` — sub берётся из токена, чужой id не передаётся.
 * Источник истины — Keycloak: занятый email → 409 с полем `email`
 * (подсвечивается в поле), логин следует за email; смена действует сразу
 * (верификация адреса — с Этапа 3, 6.2).
 */
export function EditProfileForm({
  initial,
  editableNames = false,
  details,
}: EditProfileFormProps): React.JSX.Element {
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState(initial.email);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [errors, setErrors] = useState<{ email?: string; firstName?: string; lastName?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearError(field: 'email' | 'firstName' | 'lastName'): void {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function submit(): Promise<void> {
    const found: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) found.email = 'Некорректный email';
    if (editableNames) {
      if (!firstName.trim()) found.firstName = 'Укажите имя';
      if (!lastName.trim()) found.lastName = 'Укажите фамилию';
    }
    setErrors(found);
    setFormError(null);
    if (Object.values(found).some(Boolean)) return;

    setSaving(true);
    try {
      await browserApi.identity.updateMe({
        email: email.trim(),
        ...(editableNames ? { firstName: firstName.trim(), lastName: lastName.trim() } : {}),
      });
      toast.success('Профиль обновлён');
      router.refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      if (
        apiError.field === 'email' ||
        apiError.field === 'firstName' ||
        apiError.field === 'lastName'
      ) {
        setErrors({ [apiError.field]: apiError.message });
      } else {
        setFormError(
          `${apiError.message}${apiError.requestId ? ` (requestId: ${apiError.requestId})` : ''}`,
        );
      }
      toast.error(apiError.message, apiError.requestId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      {details}

      {formError ? (
        <MpAlert severity="error" role="alert">
          {formError}
        </MpAlert>
      ) : null}

      {editableNames ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          useFlexGap
          sx={{ flexWrap: 'wrap' }}
        >
          <MpTextField
            label="Имя"
            required
            value={firstName}
            error={Boolean(errors.firstName)}
            {...(errors.firstName ? { helperText: errors.firstName } : {})}
            sx={{ flex: '1 1 220px' }}
            onChange={(event) => {
              setFirstName(event.target.value);
              clearError('firstName');
            }}
          />
          <MpTextField
            label="Фамилия"
            required
            value={lastName}
            error={Boolean(errors.lastName)}
            {...(errors.lastName ? { helperText: errors.lastName } : {})}
            sx={{ flex: '1 1 220px' }}
            onChange={(event) => {
              setLastName(event.target.value);
              clearError('lastName');
            }}
          />
        </Stack>
      ) : (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            ФИО
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {`${initial.lastName} ${initial.firstName}`.trim() || '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ФИО правит администратор (форма врача 3.2)
          </Typography>
        </Box>
      )}

      <MpTextField
        label="Email"
        type="email"
        required
        value={email}
        error={Boolean(errors.email)}
        {...(errors.email ? { helperText: errors.email } : {})}
        sx={{ maxWidth: 420 }}
        onChange={(event) => {
          setEmail(event.target.value);
          clearError('email');
        }}
      />

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <MpButton variant="contained" loading={saving} onClick={() => void submit()}>
          Сохранить
        </MpButton>
        <Typography variant="caption" color="text.secondary">
          Логин — тоже email; смена действует сразу (подтверждение адреса — с Этапа 3)
        </Typography>
      </Stack>
    </Stack>
  );
}
