import { Module } from '@nestjs/common';
import { ListFilesController } from './api/list-files.controller';

/** Публичный API слайса (fsd.md S5): список файлов владельца (4.5/9.3). */
@Module({
  controllers: [ListFilesController],
})
export class ListFilesModule {}

export { listFiles } from './app/list-files';
export type { ListFilesDeps } from './app/list-files';
