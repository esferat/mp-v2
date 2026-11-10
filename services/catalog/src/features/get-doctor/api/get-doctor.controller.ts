import { Controller, Get, Inject, Param, Req, UnauthorizedException } from '@nestjs/common';
import type { RequestAuth } from '@mp/service-kit';
import {
  DOCTOR_REPOSITORY,
  type DoctorListItem,
  type DoctorRepository,
  PHOTO_URL_SIGNER,
  type PhotoUrlSigner,
} from '../../../entities/doctor';
import { getDoctor, getDoctorByUser } from '../app/get-doctor';

type AuthedRequest = { auth?: RequestAuth };

/** Адаптер входа: id из пути -> use-case (3.2); нет врача -> 404. */
@Controller('api/catalog/doctors')
export class GetDoctorController {
  constructor(
    @Inject(DOCTOR_REPOSITORY)
    private readonly repository: DoctorRepository,
    @Inject(PHOTO_URL_SIGNER)
    private readonly signer: PhotoUrlSigner,
  ) {}

  /**
   * Карточка СВОЕГО врача по токену (10.4, Этап 2.1): sub из токена,
   * id не нужен — чужая карточка недоступна. Объявлен ДО ':id': односегментный
   * 'me' иначе был бы схвачен параметрическим маршрутом.
   */
  @Get('me')
  getMe(@Req() request: AuthedRequest): Promise<DoctorListItem> {
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException('Требуется токен доступа');
    return getDoctorByUser(this.repository, this.signer, auth.sub);
  }

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
