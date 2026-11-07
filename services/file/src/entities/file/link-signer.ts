/**
 * Порт presigned-ссылки на скачивание (4.5): TTL и подпись — в адаптере
 * (@mp/storage), здесь только контракт.
 */
export interface FileLinkSigner {
  sign(bucket: string, key: string): Promise<{ url: string; expiresInSeconds: number }>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const LINK_SIGNER = Symbol('FileLinkSigner');
