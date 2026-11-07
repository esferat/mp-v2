import { randomUUID } from 'node:crypto';
import type { FileKind } from '@mp/contracts';

/**
 * Валидация файла до записи куда-либо (4.4): магические байты, лимит,
 * допустимые типы по виду загрузки. Единственная точка правил (DRY):
 * ею пользуются и загрузка (4.4/3.4), и её тесты.
 */

/** Лимит размера, байт (4.4: не больше 5 МБ). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Допустимые MIME по виду загрузки (bucket-политика 4.4). */
export const ALLOWED_MIMES: Record<FileKind, readonly string[]> = {
  PHOTO: ['image/jpeg', 'image/png', 'image/webp'],
  DOCUMENT: ['application/pdf', 'image/jpeg', 'image/png'],
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function asciiAt(buffer: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let index = offset; index < offset + length && index < buffer.length; index += 1) {
    out += String.fromCharCode(buffer[index] ?? 0);
  }
  return out;
}

/** MIME по первым байтам; null — формат не распознан. */
export function detectMime(buffer: Uint8Array): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && PNG_MAGIC.every((byte, index) => buffer[index] === byte)) {
    return 'image/png';
  }
  if (buffer.length >= 12 && asciiAt(buffer, 0, 4) === 'RIFF' && asciiAt(buffer, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.length >= 5 && asciiAt(buffer, 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

/** Расширение файла по MIME (ключи строятся до записи). */
export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      throw new Error(`нет расширения для MIME: ${mime}`);
  }
}

/**
 * Плоский ключ объекта: <uuid>.<ext> — один сегмент URL,
 * чтобы GET /api/files/:key работал без экранирования слэшей.
 */
export function buildFileKey(mime: string): string {
  return `${randomUUID()}.${extForMime(mime)}`;
}
