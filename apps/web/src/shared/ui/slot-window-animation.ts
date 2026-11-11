/**
 * Анимация ленты слотов при перелистывании (запись 5.2 и перенос 10.3):
 * одинаковая в обоих местах — сдвиг на 0.25 с в сторону движения (вперёд ›:
 * новый экран въезжает справа, назад ‹: слева) + fade-in.
 *
 * Использование: передать в sx контейнера ленты; `key` с началом окна
 * перемонтирует контейнер при смене недели — анимация проигрывается каждый раз.
 *
 * @param direction 1 — вперёд (›), -1 — назад (‹)
 */
export function slotWindowAnimation(direction: 1 | -1): Record<string, unknown> {
  return {
    animation: direction === 1 ? 'mpWeekNext 0.25s ease' : 'mpWeekPrev 0.25s ease',
    '@keyframes mpWeekNext': {
      from: { opacity: 0, transform: 'translateX(24px)' },
      to: { opacity: 1, transform: 'none' },
    },
    '@keyframes mpWeekPrev': {
      from: { opacity: 0, transform: 'translateX(-24px)' },
      to: { opacity: 1, transform: 'none' },
    },
  };
}
