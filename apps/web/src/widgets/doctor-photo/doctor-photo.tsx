'use client';

import type { DoctorListItem } from '@mp/contracts';
import { MpAvatar, Stack, Typography } from '@/shared/ui';
import { UploadPhoto } from '@/features/upload-photo';

/**
 * Блок фото в карточке врача (3.4, макет design/doctor-form.md):
 * аватар (presigned photoUrl, инициалы пока фото нет) + кроп-загрузка.
 */
export function DoctorPhoto({
  doctor,
}: {
  doctor: Pick<DoctorListItem, 'firstName' | 'lastName' | 'photoUrl'> & { id: string };
}): React.JSX.Element {
  const fullName = `${doctor.lastName} ${doctor.firstName}`;

  return (
    <Stack spacing={1.5} sx={{ alignItems: 'center', maxWidth: 220 }}>
      <MpAvatar
        name={fullName}
        {...(doctor.photoUrl ? { src: doctor.photoUrl } : {})}
        alt={fullName}
        sx={{ width: 120, height: 120 }}
      />
      <UploadPhoto ownerType="DOCTOR" ownerId={doctor.id} />
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        JPEG, PNG или WebP, до 5 МБ
      </Typography>
    </Stack>
  );
}
