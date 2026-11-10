-- 4.3: ключ фото пациента в карточке (привязывает file-service после загрузки)
ALTER TABLE "Patient"
  ADD COLUMN "photoKey" TEXT;
