import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MIMES,
  MAX_FILE_BYTES,
  buildFileKey,
  detectMime,
  extForMime,
} from '../src/entities/file';

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = new Uint8Array(16);
WEBP.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
WEBP.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
const PDF = new Uint8Array(8);
PDF.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 0); // %PDF-1.7

describe('detectMime (магические байты, 4.4)', () => {
  it('распознаёт JPEG/PNG/WebP/PDF', () => {
    expect(detectMime(JPEG)).toBe('image/jpeg');
    expect(detectMime(PNG)).toBe('image/png');
    expect(detectMime(WEBP)).toBe('image/webp');
    expect(detectMime(PDF)).toBe('application/pdf');
  });

  it('возвращает null для неизвестного содержимого', () => {
    expect(detectMime(Uint8Array.from([1, 2, 3, 4, 5, 6]))).toBeNull();
    expect(detectMime(new Uint8Array(0))).toBeNull();
  });

  it('текстовый файл с .pdf в имени не считается PDF (проверка по байтам)', () => {
    const text = new TextEncoder().encode('%PDF is fake but not really');
    expect(detectMime(text.slice(0, 5))).toBeNull();
  });
});

describe('лимиты и допустимые типы (4.4)', () => {
  it('лимит размера 5 МБ', () => {
    expect(MAX_FILE_BYTES).toBe(5 * 1024 * 1024);
  });

  it('PHOTO: JPEG/PNG/WebP без PDF; DOCUMENT: PDF/JPEG/PNG без WebP', () => {
    expect(ALLOWED_MIMES.PHOTO).toContain('image/webp');
    expect(ALLOWED_MIMES.PHOTO).not.toContain('application/pdf');
    expect(ALLOWED_MIMES.DOCUMENT).toContain('application/pdf');
    expect(ALLOWED_MIMES.DOCUMENT).not.toContain('image/webp');
  });
});

describe('ключи файлов (4.4)', () => {
  it('extForMime отдаёт расширения', () => {
    expect(extForMime('image/jpeg')).toBe('jpg');
    expect(extForMime('application/pdf')).toBe('pdf');
    expect(() => extForMime('text/plain')).toThrow();
  });

  it('buildFileKey плоский: uuid + расширение, без слэшей', () => {
    const key = buildFileKey('image/png');
    expect(key).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(key).not.toContain('/');
  });
});
