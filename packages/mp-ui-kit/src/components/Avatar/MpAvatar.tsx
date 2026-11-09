import Avatar, { type AvatarProps } from '@mui/material/Avatar';
import { forwardRef, type ReactNode } from 'react';
import { mpTokens } from '../../theme/tokens';

export type MpAvatarSize = keyof typeof mpTokens.avatarSize;

export interface MpAvatarProps extends Omit<AvatarProps, 'children'> {
  /** Размер аватара. @default 'md' */
  size?: MpAvatarSize;
  /** Имя — превращается в инициалы, если нет `src`. */
  name?: string;
  /** Произвольный контент внутри (например, иконка). Имеет приоритет над `name`. */
  children?: ReactNode;
}

function toInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * Аватар mp-ui-kit с фиксированными размерами и инициалами из имени.
 *
 * @example
 * <MpAvatar name="Иван Петров" />
 */
export const MpAvatar = forwardRef<HTMLDivElement, MpAvatarProps>(function MpAvatar(
  { size = 'md', name, src, children, sx, alt, ...props },
  ref,
) {
  const px = mpTokens.avatarSize[size];
  const content = children ?? (name ? toInitials(name) : undefined);
  const avatarAlt = alt ?? name;

  return (
    <Avatar
      ref={ref}
      src={src}
      alt={avatarAlt}
      sx={[
        { width: px, height: px, fontSize: Math.round(px * 0.4) },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {content}
    </Avatar>
  );
});
