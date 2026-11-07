import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  uploadFileFieldsSchema,
  type UploadFileFields,
  type UploadFileResponse,
} from '@mp/contracts';
import { LOGGER, type Logger, type RequestAuth } from '@mp/service-kit';
import { ACCESS_PORTS, type AccessPorts } from '../../../entities/access';
import {
  MAX_FILE_BYTES,
  OBJECT_STORE,
  PHOTO_LINKER,
  type FileContext,
  type ObjectStore,
  type PhotoLinker,
} from '../../../entities/file';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { ForbiddenError, ValidationError } from '../../../shared/model';
import { uploadFile } from '../app/upload-file';

/** Файл multer: нужен только буфер (глобальные express-типы не подключаем). */
type UploadedFileLike = { buffer: Buffer };

/** Запрос с claims из JwtAuthGuard (request.auth, 1.2). */
type AuthedRequest = { auth?: RequestAuth };

/**
 * Адаптер входа (4.4): multipart → ZodPipe полей → валидация и запись.
 * Лимит размера задаётся здесь же (multer), доменные правила — в use-case.
 */
@Controller('api/files')
export class UploadFileController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<FileContext>,
    @Inject(OBJECT_STORE)
    private readonly store: ObjectStore,
    @Inject(ACCESS_PORTS)
    private readonly access: AccessPorts,
    @Inject(PHOTO_LINKER)
    private readonly photos: PhotoLinker,
    @Inject(LOGGER)
    private readonly log: Logger,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  async upload(
    @Body(new ZodPipe(uploadFileFieldsSchema)) fields: UploadFileFields,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Req() request: AuthedRequest,
  ): Promise<UploadFileResponse> {
    const auth = request.auth;
    if (!auth) {
      // Guard обязан был положить claims: защита в глубину от прямого вызова
      throw new UnauthorizedException('Требуется токен доступа');
    }
    if (!file) {
      throw new ValidationError('Файл не передан (ожидается поле file)', 'file');
    }

    try {
      return await uploadFile(
        {
          unitOfWork: this.unitOfWork,
          store: this.store,
          access: this.access,
          photos: this.photos,
          log: this.log,
        },
        {
          fields,
          file: { buffer: file.buffer },
          subject: { sub: auth.sub, roles: auth.realmRoles },
        },
      );
    } catch (error) {
      // AC 4.5/9.3: отказы по правам логируются с subject и причиной
      if (error instanceof ForbiddenError) {
        this.log.warn(
          {
            subject: auth.sub,
            ownerType: fields.ownerType,
            ownerId: fields.ownerId,
            reason: error.message,
          },
          'доступ к файлу отклонён',
        );
      }
      throw error;
    }
  }
}
