import { Module } from '@nestjs/common';
import { GetFileLinkController } from './api/get-file-link.controller';

/** Публичный API слайса (fsd.md S5): presigned-скачивание (4.5). */
@Module({
  controllers: [GetFileLinkController],
})
export class GetFileLinkModule {}

export { getFileLink } from './app/get-file-link';
export type { GetFileLinkDeps } from './app/get-file-link';
