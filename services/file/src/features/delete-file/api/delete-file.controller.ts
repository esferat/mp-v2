import { Controller, Delete, Inject, Param, Req, UnauthorizedException } from '@nestjs/common';
import { LOGGER, type Logger, type RequestAuth } from '@mp/service-kit';
import { ACCESS_PORTS, type AccessPorts } from '../../../entities/access';
import { type FileContext, OBJECT_STORE, type ObjectStore } from '../../../entities/file';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ForbiddenError } from '../../../shared/model';
import { deleteFile } from '../app/delete-file';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (4.4): ключ из пути, права и удаление в use-case. */
@Controller('api/files')
export class DeleteFileController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<FileContext>,
    @Inject(OBJECT_STORE)
    private readonly store: ObjectStore,
    @Inject(ACCESS_PORTS)
    private readonly access: AccessPorts,
    @Inject(LOGGER)
    private readonly log: Logger,
  ) {}

  @Delete(':key')
  async remove(@Param('key') key: string, @Req() request: AuthedRequest): Promise<{ ok: true }> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }

    try {
      await deleteFile(
        { unitOfWork: this.unitOfWork, store: this.store, access: this.access, log: this.log },
        key,
        { sub: auth.sub, roles: auth.realmRoles },
      );
    } catch (error) {
      // Отказы по правам логируются с subject и причиной (4.4/4.5 AC)
      if (error instanceof ForbiddenError) {
        this.log.warn({ subject: auth.sub, key, reason: error.message }, 'доступ к файлу отклонён');
      }
      throw error;
    }

    return { ok: true };
  }
}
