'use client';

import { useEffect, useRef, useState } from 'react';
import type { Appointment } from '@mp/contracts';
import {
  MpAlert,
  MpButton,
  MpDialog,
  MpDialogContent,
  MpDialogActions,
  MpTextField,
  Stack,
  Typography,
  useToast,
} from '@/shared/ui';
import { formatSlot } from '@/shared/lib';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

/**
 * Диалог результата приёма (9.2, design/visit-result.md):
 * - APPROVED → «Внести результат» (POST, статус уходит в COMPLETED);
 * - COMPLETED → «Посмотреть» (read-only), кнопка «Изправить» → PUT.
 *
 * `viewOnly` — просмотр без кнопки правки: так результат читает пациент в
 * истории (5.5/9.2 AC «запись COMPLETED — с результатом read-only»), где PUT
 * всё равно закончится 403.
 *
 * Заключение обязательно (≤ 4000) — клиентское зеркало доменной валидации
 * (истина — сервер); двойной submit заблокирован синхронным ref (как в формах).
 * 409 (запись уже обработана/не APPROVED) → тост + закрытие + обновление списка.
 */

const MAX = 4000;

type Mode = 'enter' | 'read' | 'edit';

export function VisitResultDialog({
  appointment,
  open,
  onClose,
  onChanged,
  viewOnly = false,
}: {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
  /** Вызывается после успешного внесения/правки (строка обновляется). */
  onChanged?: () => void;
  /** Только просмотр: кнопка «Изправить» скрыта, поля всегда read-only. */
  viewOnly?: boolean;
}): React.JSX.Element {
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('enter');
  const [conclusion, setConclusion] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Синхронная защита от двойного submit (9.2 AC). */
  const savingRef = useRef(false);

  // Смена записи → инициализация значений из строки (visitResult уже в ответе API)
  useEffect(() => {
    if (!appointment) return;
    setConclusion(appointment.visitResult?.conclusion ?? '');
    setRecommendations(appointment.visitResult?.recommendations ?? '');
    setError(null);
    setMode(viewOnly || appointment.status === 'COMPLETED' ? 'read' : 'enter');
  }, [appointment, viewOnly]);

  // Нормальная ссылка для замыканий save/close (appointment может смениться)
  const current = appointment;
  if (!current) return <></>;

  const readOnly = mode === 'read';

  function close(): void {
    if (saving) return;
    onClose();
  }

  async function save(): Promise<void> {
    if (savingRef.current || !current) return;
    const text = conclusion.trim();
    if (!text) {
      setError('Заключение обязательно');
      return;
    }
    if (text.length > MAX) {
      setError(`Заключение не длиннее ${MAX} символов`);
      return;
    }
    if (recommendations.trim().length > MAX) {
      setError(`Рекомендации не длиннее ${MAX} символов`);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const body = {
        conclusion: text,
        ...(recommendations.trim() ? { recommendations: recommendations.trim() } : {}),
      };
      if (current.status === 'APPROVED') {
        await browserApi.scheduling.enterVisitResult(current.id, body);
        toast.success('Приём завершён, результат сохранён');
      } else {
        await browserApi.scheduling.updateVisitResult(current.id, body);
        toast.success('Результат обновлён');
      }
      onClose();
      onChanged?.();
    } catch (caught) {
      const apiError = toApiError(caught);
      if (apiError.status === 409) {
        // Запись уже обработана другим запросом / не в APPROVED
        toast.error('Запись уже обработана или недоступна', apiError.requestId);
        onClose();
        onChanged?.();
      } else if (apiError.status === 403) {
        toast.error('Запись назначена другому врачу', apiError.requestId);
        onClose();
      } else {
        // 5xx/валидация: диалог остаётся открытым, текст сохранён
        setError(
          `${apiError.message}${apiError.requestId ? ` (requestId: ${apiError.requestId})` : ''}`,
        );
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <MpDialog open={open} title="Результат приёма" onClose={close} maxWidth="md" fullWidth>
      <MpDialogContent>
        <Stack spacing={1} sx={{ mb: 2 }}>
          {viewOnly ? null : (
            <Typography variant="body2">Пациент: {appointment.patientName}</Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {`Приём: ${formatSlot(appointment.slot.localDate, appointment.slot.start)} · ${appointment.specializationName}`}
          </Typography>
        </Stack>

        {error ? (
          <MpAlert severity="error" role="alert" sx={{ mb: 2 }}>
            {error}
          </MpAlert>
        ) : null}

        <MpTextField
          label="Заключение"
          required
          multiline
          minRows={4}
          fullWidth
          value={conclusion}
          disabled={saving}
          helperText={`${conclusion.length} / ${MAX}`}
          slotProps={{
            htmlInput: { maxLength: MAX },
            ...(readOnly ? { input: { readOnly: true } } : {}),
          }}
          onChange={(event) => {
            setConclusion(event.target.value);
            setError(null);
          }}
        />
        <MpTextField
          label="Рекомендации"
          multiline
          minRows={3}
          fullWidth
          value={recommendations}
          disabled={saving}
          helperText={`${recommendations.length} / ${MAX}`}
          slotProps={{
            htmlInput: { maxLength: MAX },
            ...(readOnly ? { input: { readOnly: true } } : {}),
          }}
          onChange={(event) => {
            setRecommendations(event.target.value);
            setError(null);
          }}
          sx={{ mt: 2 }}
        />
      </MpDialogContent>

      <MpDialogActions>
        <MpButton color="inherit" disabled={saving} onClick={close}>
          {readOnly ? 'Закрыть' : 'Отмена'}
        </MpButton>
        {readOnly ? (
          viewOnly ? null : (
            <MpButton variant="outlined" onClick={() => setMode('edit')}>
              Изправить
            </MpButton>
          )
        ) : (
          <MpButton variant="contained" loading={saving} onClick={() => void save()}>
            {current.status === 'APPROVED' ? 'Сохранить и завершить приём' : 'Сохранить'}
          </MpButton>
        )}
      </MpDialogActions>
    </MpDialog>
  );
}
