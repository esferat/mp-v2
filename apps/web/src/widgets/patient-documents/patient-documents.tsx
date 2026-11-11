'use client';

import { useEffect, useState } from 'react';
import type { FileListResponse, FileMeta } from '@mp/contracts';
import {
  Box,
  MpAlert,
  MpButton,
  MpCard,
  MpCardContent,
  MpDialog,
  MpDialogActions,
  MpDialogContent,
  MpSpinner,
  PaginationBar,
  Stack,
  Typography,
  useToast,
} from '@/shared/ui';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';
import { usePagination } from '@/shared/lib';

/**
 * Документы владельца (4.5: «Скачать скан документа»): список из реестра
 * file-service + presigned-скачивание (TTL 5 мин) и удаление своего
 * документа (4.4) с подтверждением — доступ проверяет file-service
 * (владелец PATIENT-файла или связанный врач).
 *
 * Пагинация (4.5): максимум 5 документов на страницу, при большем числе —
 * подвал «Всего: N / Страница X из Y» (offset/limit API файлов).
 *
 * @param onChanged — вызывается после удаления (внешний контейнер
 * обновляет список, см. widgets/my-documents).
 */
const PAGE_SIZE = 5;

const CATEGORY_LABELS: Record<string, string> = {
  ANALYSIS: 'Анализ',
  REFERRAL: 'Направление',
  DISCHARGE: 'Выписка',
  OTHER: 'Документ',
};

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function fileTitle(file: FileMeta): string {
  return `${file.category ? (CATEGORY_LABELS[file.category] ?? file.category) : 'Документ'} · ${file.mime}`;
}

export function PatientDocuments({
  patientId,
  onChanged,
}: {
  patientId: string;
  /** Успешное удаление — внешний контейнер перезагружает список. */
  onChanged?: () => void;
}): React.JSX.Element {
  const [data, setData] = useState<FileListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<FileMeta | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();
  const pagination = usePagination({ limit: PAGE_SIZE, total: data?.total ?? 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    browserApi.files
      .list({
        ownerType: 'PATIENT',
        ownerId: patientId,
        offset: pagination.offset,
        limit: PAGE_SIZE,
      })
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(toApiError(caught).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, pagination.offset]);

  async function download(key: string): Promise<void> {
    if (downloading) return;
    setDownloading(key);
    try {
      const link = await browserApi.files.getLink(key);
      window.open(link.url, '_blank', 'noopener');
    } catch (caught) {
      const apiError = toApiError(caught);
      setError(apiError.message);
    } finally {
      setDownloading(null);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteFor || deleting) return;
    setDeleting(true);
    try {
      await browserApi.files.remove(deleteFor.key);
      setDeleteFor(null);
      toast.success('Документ удалён');
      onChanged?.();
    } catch (caught) {
      const apiError = toApiError(caught);
      setDeleteFor(null);
      toast.error(apiError.message, apiError.requestId);
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !data) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <MpSpinner minHeight={24} />
        <Typography variant="body2" color="text.secondary">
          Загружаем документы…
        </Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <MpAlert severity="error" role="alert">
        {error}
      </MpAlert>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Документов пока нет: сканы появятся после загрузки врачом или администратором.
      </Typography>
    );
  }

  return (
    <Box>
      {data.items.map((file) => (
        <MpCard key={file.key} variant="flat" sx={{ mb: 1 }}>
          <MpCardContent
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              py: 1.5,
            }}
          >
            <Box>
              <Typography variant="subtitle2">{fileTitle(file)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(file.createdAt).toLocaleDateString('ru-RU')} · {formatSize(file.size)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
              <MpButton
                size="small"
                variant="outlined"
                loading={downloading === file.key}
                onClick={() => void download(file.key)}
              >
                Скачать
              </MpButton>
              <MpButton
                size="small"
                variant="text"
                color="error"
                disabled={deleting}
                onClick={() => setDeleteFor(file)}
              >
                Удалить
              </MpButton>
            </Stack>
          </MpCardContent>
        </MpCard>
      ))}

      {data.total > PAGE_SIZE ? (
        <PaginationBar
          meta={{ ...pagination, total: data.total }}
          onPageChange={(page) => pagination.setPage(page)}
        />
      ) : null}

      {/* Подтверждение удаления (4.4 AC: не удаляется случайно) */}
      <MpDialog
        open={deleteFor !== null}
        title="Удалить документ?"
        onClose={() => {
          if (!deleting) setDeleteFor(null);
        }}
      >
        <MpDialogContent>
          <Typography>
            {deleteFor
              ? `«${fileTitle(deleteFor)}» от ${new Date(deleteFor.createdAt).toLocaleDateString('ru-RU')}`
              : ''}
            {' — действие необратимо.'}
          </Typography>
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
