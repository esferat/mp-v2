'use client';

import { useRouter } from 'next/navigation';
import { MpButton, MpUserMenu } from 'mp-ui-kit';
import { Stack } from '@/shared/ui';
import { signOutAction } from '@/features/signin';

/**
 * Правая часть шапки (visual/layout.html): меню пользователя
 * (аватар с инициалами + имя/email ▾ → «Профиль») и кнопка «Выйти»
 * (server-action signOut — Auth.js, 1.1).
 */
export function UserMenu({
  name,
  subtitle,
  profileHref,
  avatarSrc,
}: {
  /** ФИО или email пользователя (инициалы — в аватаре). */
  name: string;
  /** Роль/подпись в меню («Пациент (USER)»). */
  subtitle?: string;
  /** Переход «Профиль» (роль-specific: /patient|/admin|/doctor/profile). */
  profileHref?: string;
  /** Фото аватара (presigned из профиля; нет — инициалы из name). */
  avatarSrc?: string;
}): React.JSX.Element {
  const router = useRouter();

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <MpUserMenu
        name={name}
        {...(subtitle ? { subtitle } : {})}
        {...(avatarSrc ? { avatarSrc } : {})}
        {...(profileHref
          ? {
              items: [
                {
                  id: 'profile',
                  label: 'Профиль',
                  icon: '👤',
                  onClick: () => router.push(profileHref),
                },
              ],
            }
          : {})}
      />
      <form action={signOutAction}>
        <MpButton type="submit" variant="text" size="small">
          Выйти
        </MpButton>
      </form>
    </Stack>
  );
}
