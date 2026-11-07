'use client';

import { useState, type FormEvent } from 'react';
import type { Specialization } from '@mp/contracts';
import {
  Box,
  DataTable,
  MpAlert,
  MpButton,
  MpDialog,
  MpDialogActions,
  MpDialogContent,
  MpTextField,
  Stack,
  Typography,
  useToast,
} from '@/shared/ui';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

/**
 * Таблица специализаций (3.3: widgets/specializations-table): создание
 * через модалку, удаление с подтверждением. Ошибки сервера — на поле формы
 * (дубликат → 409) или тостом (занятая → 409 с числом врачей,3.3 AC).
 */
export function SpecializationsTable({
  initial,
}: {
  initial: Specialization[];
}): React.JSX.Element {
  const toast = useToast();

  const [items, setItems] = useState<Specialization[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Модалка создания: name — значение поля, fieldError — ошибка поля. */
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Специализация, которую подтверждаем удалить. */
  const [deleteFor, setDeleteFor] = useState<Specialization | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      setItems(await browserApi.catalog.getSpecializations());
      setError(null);
    } catch (caught) {
      setError(toApiError(caught).message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate(): void {
    setName('');
    setFieldError(null);
    setCreateOpen(true);
  }

  async function submitCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (saving) return;

    const value = name.trim();
    if (value.length < 2) {
      setFieldError('Название: минимум 2 символа');
      return;
    }

    setSaving(true);
    setFieldError(null);
    try {
      await browserApi.catalog.createSpecialization({ name: value });
      setCreateOpen(false);
      toast.success(`Специализация «${value}» создана`);
      await refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      // Дубликат (unique case-insensitive) и прочие 409 — сообщение на поле
      if (apiError.status === 409) {
        setFieldError(apiError.message);
      } else {
        setFieldError(
          `${apiError.message}${apiError.requestId ? ` (requestId: ${apiError.requestId})` : ''}`,
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deleting || !deleteFor) return;
    const target = deleteFor;

    setDeleting(true);
    try {
      await browserApi.catalog.deleteSpecialization(target.id);
      setDeleteFor(null);
      toast.success(`Специализация «${target.name}» удалена`);
      await refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      setDeleteFor(null);
      if (apiError.status === 409) {
        // Занята: сервер отвечает с числом врачей (3.3 AC)
        toast.error(apiError.message, apiError.requestId);
        await refresh();
      } else {
        toast.error(apiError.message, apiError.requestId);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <MpButton variant="contained" onClick={openCreate}>
          Создать специализацию
        </MpButton>
      </Stack>

      {error ? (
        <MpAlert severity="error" role="alert" sx={{ mb: 2 }}>
          {error}
        </MpAlert>
      ) : null}

      <DataTable<Specialization>
        columns={[
          { key: 'name', header: 'Название' },
          {
            key: 'doctorsCount',
            header: 'Врачей',
            render: (item) => String(item.doctorsCount),
          },
          {
            key: 'actions',
            header: '',
            render: (item) => (
              <MpButton
                size="small"
                variant="text"
                color="error"
                disabled={deleting}
                onClick={() => setDeleteFor(item)}
              >
                Удалить
              </MpButton>
            ),
          },
        ]}
        rows={items}
        rowKey={(item) => item.id}
        loading={loading}
        emptyTitle="Специализаций нет"
        emptyDescription="Создайте первую специализацию, чтобы добавлять врачей"
      />

      {/* Создание: дубликат → ошибка под полем (3.3 AC) */}
      <MpDialog
        open={createOpen}
        title="Новая специализация"
        onClose={() => {
          if (!saving) setCreateOpen(false);
        }}
      >
        <MpDialogContent>
          <form id="create-spec-form" onSubmit={(event) => void submitCreate(event)}>
            <MpTextField
              label="Название"
              required
              fullWidth
              value={name}
              disabled={saving}
              error={fieldError !== null}
              {...(fieldError ? { helperText: fieldError } : {})}
              slotProps={{ htmlInput: { minLength: 2, maxLength: 120 } }}
              onChange={(event) => {
                setName(event.target.value);
                setFieldError(null);
              }}
            />
          </form>
        </MpDialogContent>
        <MpDialogActions>
          <MpButton color="inherit" disabled={saving} onClick={() => setCreateOpen(false)}>
            Отмена
          </MpButton>
          <MpButton type="submit" form="create-spec-form" variant="contained" loading={saving}>
            Создать
          </MpButton>
        </MpDialogActions>
      </MpDialog>

      {/* Удаление: подтверждение; занятая → 409 с числом врачей в тосте */}
      <MpDialog
        open={deleteFor !== null}
        title="Удалить специализацию?"
        onClose={() => {
          if (!deleting) setDeleteFor(null);
        }}
      >
        <MpDialogContent>
          <Stack spacing={0.5}>
            <Typography>
              {deleteFor ? `«${deleteFor.name}»` : ''}
              {deleteFor && deleteFor.doctorsCount > 0
                ? ` используется ${deleteFor.doctorsCount} врачами — удаление будет отклонено.`
                : ' будет удалена.'}
            </Typography>
          </Stack>
        </MpDialogContent>
        <MpDialogActions>
          <MpButton color="inherit" disabled={deleting} onClick={() => setDeleteFor(null)}>
            Отмена
          </MpButton>
          <MpButton
            variant="contained"
            color="error"
            loading={deleting}
            onClick={() => void confirmDelete()}
          >
            Удалить
          </MpButton>
        </MpDialogActions>
      </MpDialog>
    </Box>
  );
}
