'use client';

import { type ChangeEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentCategory } from '@mp/contracts';
import { browserApiClient } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';
import {
  MpAlert,
  MpButton,
  MpDialog,
  MpDialogActions,
  MpDialogContent,
  MpSelect,
  Stack,
  Typography,
  useToast,
} from '@/shared/ui';

/**
 * Загрузка документа пациента врачом/админом (9.3, design/doctor-patients.md):
 * выбор категории → выбор файла (PDF/JPEG/PNG, ≤ 5 МБ) → multipart POST
 * /files/upload (ownerType=PATIENT, kind=DOCUMENT) — file-service проверяет
 * связь «врач-пациент» (9.3) и публикует document.uploaded.v1 с category.
 *
 * Ограничения клиента зеркалят серверные (4.4); сервер дополнительно
 * проверяет магические байты.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const CATEGORY_OPTIONS: ReadonlyArray<{ value: DocumentCategory; label: string }> = [
  { value: 'ANALYSIS', label: 'Анализ' },
  { value: 'REFERRAL', label: 'Направление' },
  { value: 'DISCHARGE', label: 'Выписка' },
  { value: 'OTHER', label: 'Другое' },
];

export function UploadPatientDocument({
  patientId,
  onUploaded,
}: {
  patientId: string;
  /** Вызывается после успешной загрузки (обновление списка). */
  onUploaded: () => void;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>('ANALYSIS');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Синхронная защита от двойного submit. */
  const uploadingRef = useRef(false);

  function onSelect(event: ChangeEvent<HTMLInputElement>): void {
    setError(null);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Допустимы только PDF, JPEG или PNG');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Файл больше 5 МБ');
      return;
    }
    void upload(file);
  }

  async function upload(file: File): Promise<void> {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('ownerType', 'PATIENT');
      form.set('ownerId', patientId);
      form.set('kind', 'DOCUMENT');
      form.set('category', category);
      form.set('file', file, file.name);

      await browserApiClient.request('/files/upload', { method: 'POST', body: form });

      setOpen(false);
      toast.success('Документ загружен');
      onUploaded();
      router.refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      if (apiError.status === 403) {
        // Нет действующей записи с пациентом (9.3) — закрываем и объясняем
        setOpen(false);
        toast.error('Нет действующей записи с этим пациентом', apiError.requestId);
      } else {
        setError(
          `${apiError.message}${apiError.requestId ? ` (requestId: ${apiError.requestId})` : ''}`,
        );
      }
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  return (
    <>
      <MpButton variant="contained" onClick={() => setOpen(true)}>
        Загрузить документ
      </MpButton>

      <MpDialog
        open={open}
        title="Загрузка документа"
        onClose={() => {
          if (!uploading) setOpen(false);
        }}
      >
        <MpDialogContent>
          <Stack spacing={2}>
            {error ? (
              <MpAlert severity="error" role="alert">
                {error}
              </MpAlert>
            ) : null}

            <MpSelect
              label="Категория"
              required
              value={category}
              options={CATEGORY_OPTIONS.map((option) => ({ ...option }))}
              onChange={(event) => setCategory(event.target.value as DocumentCategory)}
            />

            <Typography variant="caption" color="text.secondary">
              PDF, JPEG или PNG, до 5 МБ. Файл проверяется по содержимому (магические байты).
            </Typography>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              hidden
              onChange={onSelect}
            />
            <MpButton
              variant="outlined"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Выбрать файл
            </MpButton>
          </Stack>
        </MpDialogContent>
        <MpDialogActions>
          <MpButton color="inherit" disabled={uploading} onClick={() => setOpen(false)}>
            Отмена
          </MpButton>
        </MpDialogActions>
      </MpDialog>
    </>
  );
}
