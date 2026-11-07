'use client';

import NextLink from 'next/link';
import { Button } from '@mui/material';
import type { ButtonProps } from '@mui/material';

/**
 * Кнопка-ссылка со soft navigation (next/link): `<Button href>` рендерит
 * обычный `<a>` и перезагружает страницу целиком (842 КБ бандла заново).
 *
 * Отдельный клиентский компонент нужен потому, что в Server Components нельзя
 * передавать функцию-компонент (next/link) в клиентский MUI Button — RSC
 * падает при сериализации (проверено на build в header.tsx).
 */
type LinkButtonProps = Omit<ButtonProps, 'href'> & { href: string };

export function LinkButton({ href, ...props }: LinkButtonProps): React.JSX.Element {
  return <Button component={NextLink} href={href} {...props} />;
}
