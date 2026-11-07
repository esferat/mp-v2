import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from '../src/shared/lib';

describe('InMemoryRateLimiter (token bucket)', () => {
  it('пропускает burst запросов, затем блокирует с retryAfter', () => {
    const now = 0;
    const limiter = new InMemoryRateLimiter(1, 3, () => now);

    expect(limiter.take('ip1').allowed).toBe(true);
    expect(limiter.take('ip1').allowed).toBe(true);
    expect(limiter.take('ip1').allowed).toBe(true);

    const denied = limiter.take('ip1');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it('восстанавливается со скоростью ratePerSec', () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter(2, 2, () => now);
    expect(limiter.take('ip').allowed).toBe(true);
    expect(limiter.take('ip').allowed).toBe(true);
    expect(limiter.take('ip').allowed).toBe(false);

    now += 500; // 0.5с → +1 токен при rate=2/с
    expect(limiter.take('ip').allowed).toBe(true);
    expect(limiter.take('ip').allowed).toBe(false);
  });

  it('ключи независимы (разные клиенты)', () => {
    const now = 0;
    const limiter = new InMemoryRateLimiter(1, 1, () => now);
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
    expect(limiter.take('b').allowed).toBe(true);
  });

  it('не превышает burst при длительном простое', () => {
    let now = 0;
    const limiter = new InMemoryRateLimiter(10, 2, () => now);
    limiter.take('ip');
    now += 600_000; // 10 минут → токенов должно быть не больше burst
    expect(limiter.take('ip').allowed).toBe(true);
    expect(limiter.take('ip').allowed).toBe(true);
    expect(limiter.take('ip').allowed).toBe(false);
  });
});
