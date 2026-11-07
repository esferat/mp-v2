'use client';

import Cropper, { type Area } from 'react-easy-crop';
import { Box, Button, Stack } from '@mui/material';

/**
 * Кроппер фото (2.2, используется в задаче 3.4 — фото врача с кроппером):
 * обёртка над react-easy-crop + подтверждение результата.
 */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropper({
  image,
  crop,
  zoom,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onApply,
  onReset,
  applying,
}: {
  image: string;
  crop: { x: number; y: number };
  zoom: number;
  onCropChange: (value: { x: number; y: number }) => void;
  onZoomChange: (value: number) => void;
  /** Область в пикселях исходного изображения — для финальной обрезки. */
  onCropComplete: (_croppedArea: Area, _croppedAreaPixels: Area) => void;
  onApply: () => void;
  onReset: () => void;
  applying?: boolean;
}): React.JSX.Element {
  return (
    <Box sx={{ position: 'relative', width: '100%', height: 320, bgcolor: 'grey.100' }}>
      <Cropper
        image={image}
        crop={crop}
        zoom={zoom}
        aspect={1}
        onCropChange={onCropChange}
        onZoomChange={onZoomChange}
        onCropComplete={onCropComplete}
      />
      <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8 }}>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          aria-label="Масштаб"
          onChange={(event) => onZoomChange(Number(event.target.value))}
          style={{ width: '100%' }}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: 'flex-end' }}>
          <Button onClick={onReset} color="inherit" size="small">
            Сбросить
          </Button>
          <Button onClick={onApply} variant="contained" size="small" disabled={applying}>
            Применить
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
