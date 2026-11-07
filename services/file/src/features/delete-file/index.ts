import { Module } from '@nestjs/common';
import { DeleteFileController } from './api/delete-file.controller';

/** Публичный API слайса (fsd.md S5): удаление файла (4.4). */
@Module({
  controllers: [DeleteFileController],
})
export class DeleteFileModule {}

export { deleteFile } from './app/delete-file';
export type { DeleteFileDeps } from './app/delete-file';
