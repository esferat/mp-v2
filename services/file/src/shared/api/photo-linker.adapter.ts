import type { OwnerType } from '@mp/contracts';
import type { PhotoLinker } from '../../entities/file';
import type { CatalogHttpClient } from './catalog.http.client';
import type { PatientHttpClient } from './patient.http.client';

/**
 * Адаптер привязки фото (3.4/4.3): по владельцу выбирается карточка —
 * PATIENT идёт в patient-service, DOCTOR в catalog-service (единый порт).
 */
export class PhotoLinkerAdapter implements PhotoLinker {
  constructor(
    private readonly patient: PatientHttpClient,
    private readonly catalog: CatalogHttpClient,
  ) {}

  link(
    ownerType: OwnerType,
    ownerId: string,
    key: string | null,
  ): Promise<{ previousKey: string | null }> {
    return ownerType === 'PATIENT'
      ? this.patient.setPhoto(ownerId, key)
      : this.catalog.setDoctorPhoto(ownerId, key);
  }
}
