import { Controller, Get, Inject, Param } from '@nestjs/common';
import {
  DOCTOR_REPOSITORY,
  PHOTO_URL_SIGNER,
  type DoctorListItem,
  type DoctorRepository,
  type PhotoUrlSigner,
} from '../../../entities/doctor';
import { getDoctor, getDoctorByUser } from '../app/get-doctor';

/** Адаптер входа: id из пути -> use-case (3.2); нет врача -> 404. */
@Controller('api/catalog/doctors')
export class GetDoctorController {
  constructor(
    @Inject(DOCTOR_REPOSITORY)
    private readonly repository: DoctorRepository,
    @Inject(PHOTO_URL_SIGNER)
    private readonly signer: PhotoUrlSigner,
  ) {}

  @Get(':id')
  get(@Param('id') id: string): Promise<DoctorListItem> {
    return getDoctor(this.repository, this.signer, id);
  }

  /**
   * Врач по Keycloak sub (9.1): идемпотентность саги — повторное создание
   * возвращает СУЩЕСТВУЮЩУЮ карточку вместо уникального конфликта userId.
   * Маршрут объявлен после ':id': два сегмента не конфликтуют с одним.
   */
  @Get('by-user/:userId')
  getByUser(@Param('userId') userId: string): Promise<DoctorListItem> {
    return getDoctorByUser(this.repository, this.signer, userId);
  }
}
