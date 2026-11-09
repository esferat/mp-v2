import Skeleton, { type SkeletonProps } from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { forwardRef } from 'react';

export interface MpSkeletonProps extends Omit<SkeletonProps, 'children'> {
  /**
   * Количество строк текста: рендерит стопку заглушек
   * (последняя — короче, как в макетах: «карточка — 6 линий»).
   */
  lines?: number;
}

/**
 * Скелетон mp-ui-kit — загрузка вместо спиннера-центра.
 *
 * @example
 * <MpSkeleton lines={6} />            // карточка
 * <MpSkeleton variant="rectangular" height={24} />  // строка таблицы
 */
export const MpSkeleton = forwardRef<HTMLDivElement, MpSkeletonProps>(function MpSkeleton(
  { lines, variant = 'text', width, height, ...props },
  ref,
) {
  if (lines !== undefined && lines > 1) {
    return (
      <Stack ref={ref} spacing={0.75} sx={{ width: width ?? '100%' }} aria-hidden {...props}>
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton
            key={index}
            variant="text"
            height={height ?? 20}
            width={index === lines - 1 ? '60%' : '100%'}
          />
        ))}
      </Stack>
    );
  }

  return <Skeleton ref={ref} variant={variant} width={width} height={height} {...props} />;
});
