import { Body, Controller, Inject, Param, Put } from '@nestjs/common';
import { type LinkDoctorUserRequest, linkDoctorUserSchema } from '@mp/contracts';
import type { DoctorListItem } from '../../../entities/doctor';
import { type DoctorContext } from '../../../entities/doctor';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../entities/repository';
import { ZodPipe } from '../../../shared/lib';
import { linkDoctorUser } from '../app/link-doctor-user';

/**
 * Адаптер входа: PUT /api/catalog/doctors/:id/user — привязка учётной записи
 * к карточке (правило «учётная запись всегда от админа», сага identity 9.1+).
 * Рубеж ADMIN — gateway (PUT /api/catalog/doctors), сервис права не проверяет
 * (как весь CRUD каталога 3.1–3.3).
 */
@Controller('api/catalog/doctors')
export class LinkDoctorUserController {
  constructor(
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWork<DoctorContext>,
  ) {}

  @Put(':id/user')
  link(
    @Param('id') id: string,
    @Body(new ZodPipe(linkDoctorUserSchema)) body: LinkDoctorUserRequest,
  ): Promise<DoctorListItem> {
    return linkDoctorUser(this.unitOfWork, id, body);
  }
}
