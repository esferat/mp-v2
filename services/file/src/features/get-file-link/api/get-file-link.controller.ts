import { Controller, Get, Inject, Param, Req, UnauthorizedException } from '@nestjs/common';
import type { FileDownload } from '@mp/contracts';
import { LOGGER, type Logger, type RequestAuth } from '@mp/service-kit';
import { ACCESS_PORTS, type AccessPorts } from '../../../entities/access';
import type { FileLinkSigner, FileRepository } from '../../../entities/file';
import { FILE_REPOSITORY, LINK_SIGNER } from '../../../entities/file';
import { getFileLink } from '../app/get-file-link';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа (4.5): ключ из пути → реестр → права → presigned. */
@Controller('api/files')
export class GetFileLinkController {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly files: FileRepository,
    @Inject(ACCESS_PORTS)
    private readonly access: AccessPorts,
    @Inject(LINK_SIGNER)
    private readonly signer: FileLinkSigner,
    @Inject(LOGGER)
    private readonly log: Logger,
  ) {}

  @Get(':key')
  async link(@Param('key') key: string, @Req() request: AuthedRequest): Promise<FileDownload> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Требуется токен доступа');
    }
    return getFileLink(
      { files: this.files, access: this.access, signer: this.signer, log: this.log },
      key,
      { sub: auth.sub, roles: auth.realmRoles },
    );
  }
}
