'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { OwnerType } from '@mp/contracts';
import type { Area } from 'react-easy-crop';
import { browserApiClient } from '@/shared/api/browser';
import { toApiError } from '@/shared/api/errors';
import { ImageCropper, MpAlert, MpButton, MpDialog, MpDialogContent, useToast } from '@/shared/ui';

/**
 * Загрузка фото владельца с кроппингом (3.4/4.3): выбор файла → кроп
 * (react-easy-crop, квадрат) → multipart POST /api/bff/files/upload →
 * file-service сам привязывает photoKey к карточке (file → patient/catalog) →
 * router.refresh() подтягивает presigned-аватар.
 *
 * Ограничения клиента зеркалят серверные (4.4): JPEG/PNG/WebP, до 5 МБ;
 * сервер дополнительно проверяет магические байты.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('не удалось прочитать изображение'));
    image.src = source;
  });
}

/** Обрезка выбранной области в canvas → JPEG-блоб (квадрат, 3.4 AC). */
async function cropToBlob(source: string, area: Area): Promise<Blob> {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas недоступен в этом браузере');

  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('не удалось сформировать файл'))),
      'image/jpeg',
      0.92,
    );
  });
}

export function UploadPhoto({
  ownerType,
  ownerId,
  buttonLabel = 'Загрузить фото',
}: {
  ownerType: OwnerType;
  /** patient.id или doctor.id. */
  ownerId: string;
  buttonLabel?: string;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeDialog(): void {
    if (image) URL.revokeObjectURL(image);
    setImage(null);
    setAreaPixels(null);
  }

  function onSelect(event: ChangeEvent<HTMLInputElement>): void {
    setError(null);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Допустимы только JPEG, PNG или WebP');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Файл больше 5 МБ');
      return;
    }

    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPixels(null);
    setImage(URL.createObjectURL(file));
  }

  async function applyCrop(): Promise<void> {
    if (!image || !areaPixels || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await cropToBlob(image, areaPixels);
      const form = new FormData();
      form.set('ownerType', ownerType);
      form.set('ownerId', ownerId);
      form.set('kind', 'PHOTO');
      form.set('file', blob, 'photo.jpg');

      await browserApiClient.request('/files/upload', { method: 'POST', body: form });

      closeDialog();
      toast.success('Фото обновлено');
      router.refresh();
    } catch (caught) {
      const apiError = toApiError(caught);
      setError(
        `${apiError.message}${apiError.requestId ? ` (requestId: ${apiError.requestId})` : ''}`,
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        hidden
        onChange={onSelect}
      />
      <MpButton variant="outlined" onClick={() => inputRef.current?.click()}>
        {buttonLabel}
      </MpButton>

      {error ? (
        <MpAlert severity="error" role="alert" sx={{ mt: 1 }}>
          {error}
        </MpAlert>
      ) : null}

      <MpDialog
        open={image !== null}
        title="Кадр фото"
        onClose={() => {
          if (!uploading) closeDialog();
        }}
      >
        <MpDialogContent>
          {image ? (
            <ImageCropper
              image={image}
              crop={crop}
              zoom={zoom}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_cropped, croppedPixels) => setAreaPixels(croppedPixels)}
              onApply={() => void applyCrop()}
              onReset={closeDialog}
              applying={uploading}
            />
          ) : null}
        </MpDialogContent>
      </MpDialog>
    </>
  );
}
