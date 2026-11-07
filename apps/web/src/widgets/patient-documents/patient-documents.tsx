'use client';

import { useEffect, useState } from 'react';
import type { FileListResponse } from '@mp/contracts';
import {
  Box,
  MpAlert,
  MpButton,
  MpCard,
  MpCardContent,
  MpSpinner,
  Stack,
  Typography,
} from '@/shared/ui';
import { browserApi } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';

/**
 * Документы пациента в профиле (4.5: «Скачать скан документа»):
 * список из реестра file-service + presigned-скачивание (TTL 5 мин),
 * ссылка открывается во вкладке — токен в URL не попадает.
 */
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

export function PatientDocuments({ patientId }: { patientId: string }): React.JSX.Element {
  const [data, setData] = useState<FileListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    browserApi.files
      .list({ ownerType: 'PATIENT', ownerId: patientId })
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
  }, [patientId]);

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

  if (loading) {
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
              <Typography variant="subtitle2">
                {file.category ? (CATEGORY_LABELS[file.category] ?? file.category) : 'Документ'} ·{' '}
                {file.mime}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(file.createdAt).toLocaleDateString('ru-RU')} · {formatSize(file.size)}
              </Typography>
            </Box>
            <MpButton
              size="small"
              variant="outlined"
              loading={downloading === file.key}
              onClick={() => void download(file.key)}
            >
              Скачать
            </MpButton>
          </MpCardContent>
        </MpCard>
      ))}
    </Box>
  );
}
