import { describe, expect, it } from 'vitest';
import { HealthRegistry } from '../src/health/health.registry';

describe('HealthRegistry', () => {
  it('возвращает ok для прошедших проверок', async () => {
    const registry = new HealthRegistry();
    registry.register({ name: 'db', check: async () => undefined });

    const results = await registry.runAll();
    expect(results).toEqual([{ name: 'db', status: 'ok', durationMs: expect.any(Number) }]);
  });

  it('ловит ошибку проверки, не прерывая остальные', async () => {
    const registry = new HealthRegistry();
    registry.register({
      name: 'db',
      check: async () => {
        throw new Error('connection refused');
      },
    });
    registry.register({ name: 'rabbit', check: async () => undefined });

    const results = await registry.runAll();
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ name: 'db', status: 'fail', error: 'connection refused' });
    expect(results[1]).toMatchObject({ name: 'rabbit', status: 'ok' });
  });

  it('считает durationMs', async () => {
    const registry = new HealthRegistry();
    registry.register({
      name: 'slow',
      check: () => new Promise((resolve) => setTimeout(resolve, 15)),
    });

    const [result] = await registry.runAll();
    expect(result?.durationMs).toBeGreaterThanOrEqual(10);
  });
});
