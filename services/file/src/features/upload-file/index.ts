import { Module } from '@nestjs/common';
import { UploadFileController } from './api/upload-file.controller';

/** Публичный API слайса (fsd.md S5): загрузка файла (4.4/3.4). */
@Module({
  controllers: [UploadFileController],
})
export class UploadFileModule {}

export { uploadFile } from './app/upload-file';
export type { UploadFileCommand, UploadFileDeps } from './app/upload-file';
