/**
 * In-memory rate-limit на token bucket (1.2: «Redis или in-memory на MVP»).
 *
 * Хранение — Map<ключ, ведро> в памяти процесса: для одного инстанса gateway
 * этого достаточно; при горизонтальном масштабировании меняется реализация
 * порта (Storage), не потребитель.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Сколько запросов ещё можно делать в текущем окне. */
  remaining: number;
  /** Секунд до восстановления (0, если allowed). */
  retryAfterSec: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweepAt = 0;

  /**
   * @param ratePerSec — восполнение, запросов в секунду
   * @param burst — начальный и максимальный запас (бакет)
   */
  constructor(
    private readonly ratePerSec: number,
    private readonly burst: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Пытается взять один токен по ключу (обычно — IP клиента). */
  take(key: string): RateLimitResult {
    const time = this.now();
    this.sweep(time);

    const bucket = this.buckets.get(key) ?? { tokens: this.burst, updatedAt: time };
    const elapsedSec = Math.max(0, time - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(this.burst, bucket.tokens + elapsedSec * this.ratePerSec);
    bucket.updatedAt = time;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSec: 0 };
    }

    this.buckets.set(key, bucket);
    const deficit = 1 - bucket.tokens;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(deficit / this.ratePerSec)),
    };
  }

  /** Удаляет опустошённые бакеты, чтобы Map не рос бесконечно. */
  private sweep(time: number): void {
    if (time - this.lastSweepAt < 60_000) return;
    this.lastSweepAt = time;
    for (const [key, bucket] of this.buckets) {
      if (time - bucket.updatedAt > 60_000 && bucket.tokens >= this.burst - 0.001) {
        this.buckets.delete(key);
      }
    }
  }
}
