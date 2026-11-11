import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { DoctorListItem } from '@mp/contracts';
import { Alert, Box, MpPageHeader, Typography } from '@/shared/ui';
import { ApiError, createServerApi, loadSpecializations } from '@/shared/api';
import { cachedCatalog, CATALOG_TAGS } from '@/shared/api/catalog-cache';
import { DoctorForm } from '@/features/doctor-form';

export const metadata: Metadata = { title: 'Врач — Администрирование' };

type LoadResult<T> = { value: T } | { error: string; requestId?: string } | null;

async function loadDoctor(id: string): Promise<LoadResult<DoctorListItem>> {
  try {
    const api = await createServerApi();
    // Карточка врача — тоже справочник: серверный кэш с тегом (2.6),
    // правки через BFF сбрасывают тег сразу
    const value = await cachedCatalog(['doctor', id], CATALOG_TAGS.doctors, () =>
      api.catalog.getDoctor(id),
    );
    return { value };
  } catch (error) {
    // Не-API ошибки (в т.ч. NEXT_REDIRECT «на вход» после неудачного
    // refresh токена) — наружу: catch не должен поглощать редирект
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 404) return null;
    return {
      error: error.message,
      ...(error.requestId ? { requestId: error.requestId } : {}),
    };
  }
}

function ErrorAlert({
  result,
  subject = 'врача',
}: {
  result: { error: string; requestId?: string };
  /** Что не загрузилось: «врача» (по умолчанию) или «email врача». */
  subject?: string;
}): React.JSX.Element {
  return (
    <Alert severity="error" role="alert">
      Не удалось загрузить {subject}: {result.error}
      {result.requestId ? (
        <Typography variant="caption" sx={{ display: 'block' }}>
          requestId: {result.requestId}
        </Typography>
      ) : null}
    </Alert>
  );
}

/**
 * Email учётной записи врача из Keycloak (3.2: видит/правит админ и сам врач).
 * Без привязки userId — врача без учётной записи возвращаем null.
 */
async function loadAccountEmail(userId: string): Promise<LoadResult<string>> {
  try {
    const api = await createServerApi();
    const profile = await api.identity.getUserProfile(userId);
    return { value: profile.email };
  } catch (error) {
    // Не-API ошибки (в т.ч. NEXT_REDIRECT «на вход» после неудачного
    // refresh токена) — наружу: catch не должен поглощать редирект
    if (!(error instanceof ApiError)) throw error;
    return {
      error: error.message,
      ...(error.requestId ? { requestId: error.requestId } : {}),
    };
  }
}

/**
 * Страница редактирования врача (3.2): карточка и справочник грузятся
 * на сервере; 404 -> not-found; форма — клиентский остов.
 */
export default async function DoctorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;
  const [doctorResult, specializationsResult] = await Promise.all([
    loadDoctor(id),
    loadSpecializations(),
  ]);

  if (doctorResult === null) notFound();

  if ('error' in doctorResult) return <ErrorAlert result={doctorResult} />;
  if ('error' in specializationsResult) return <ErrorAlert result={specializationsResult} />;

  // Email учётной записи (Keycloak, 3.2): у врача может не быть привязки
  // userId — тогда поля email в форме нет
  const userId = doctorResult.value.userId;
  const emailResult = userId ? await loadAccountEmail(userId) : null;
  if (emailResult && 'error' in emailResult) {
    return <ErrorAlert result={emailResult} subject="email врача" />;
  }
  const accountEmail = emailResult && 'value' in emailResult ? emailResult.value : null;

  return (
    <Box>
      <MpPageHeader
        title={`${doctorResult.value.lastName} ${doctorResult.value.firstName}${
          doctorResult.value.middleName ? ` ${doctorResult.value.middleName}` : ''
        }`}
        backHref="/admin/doctors"
        backLabel="Врачи"
      />
      {/* Форма редактирования (design/doctor-form.md). Аватар врача здесь не
          редактируется: фото меняет только владелец в своём профиле (10.1) —
          разделение «аватар в профиле» / «карточка админа — данные» */}
      <Box sx={{ maxWidth: 760 }}>
        <DoctorForm
          mode="edit"
          initial={doctorResult.value}
          accountEmail={accountEmail}
          specializations={specializationsResult.items}
        />
      </Box>
    </Box>
  );
}
