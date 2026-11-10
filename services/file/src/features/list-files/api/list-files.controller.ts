import { Controller, Get, Inject, Query, Req, UnauthorizedException } from '@nestjs/common';
import { type FileListQuery, fileListQuerySchema, type FileListResponse } from '@mp/contracts';
import { LOGGER, type Logger, type RequestAuth } from '@mp/service-kit';
import { ACCESS_PORTS, type AccessPorts } from '../../../entities/access';
import { FILE_REPOSITORY, type FileRepository } from '../../../entities/file';
import { ZodPipe } from '../../../shared/lib';
import { listFiles } from '../app/list-files';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (4.5/9.3): список документов владельца. */
@Controller('api/files')
export class ListFilesController {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly files: FileRepository,
    @Inject(ACCESS_PORTS)
    private readonly access: AccessPorts,
    @Inject(LOGGER)
    private readonly log: Logger,
  ) {}

  @Get()
  async list(
    @Query(new ZodPipe(fileListQuerySchema)) query: FileListQuery,
    @Req() request: AuthedRequest,
  ): Promise<FileListResponse> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }
    return listFiles({ files: this.files, access: this.access, log: this.log }, query, {
      sub: auth.sub,
      roles: auth.realmRoles,
    });
  }
}
