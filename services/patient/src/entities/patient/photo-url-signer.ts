/** Порт подписи presigned-ссылки на фото пациента (0.5/4.1). */
export interface PhotoUrlSigner {
  sign(photoKey: string): Promise<string>;
}

/** DI-токен привязки реализации (сборка — в app/app.module.ts). */
export const PHOTO_URL_SIGNER = Symbol('PatientPhotoUrlSigner');
