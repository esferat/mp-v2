import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { eventSchemas } from '../src/events/index';

/**
 * Проверка совместимости событий (0.6): изменение, ломающее потребителей
 * (удаление обязательного поля, переименование, смена типа), валит тест → CI.
 * Добавление новых полей — совместимо и разрешено.
 */
interface FieldBaseline {
  type: string | undefined;
}
interface EventBaseline {
  required: string[];
  properties: Record<string, FieldBaseline>;
}

const baseline = JSON.parse(
  readFileSync(join(process.cwd(), 'compat', 'events.baseline.json'), 'utf8'),
) as Record<string, EventBaseline>;

function describeSchema(schema: z.ZodType): EventBaseline {
  const json = z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' }) as {
    required?: string[];
    properties?: Record<string, { type?: string }>;
  };
  const properties: Record<string, FieldBaseline> = {};
  for (const [name, prop] of Object.entries(json.properties ?? {})) {
    properties[name] = { type: prop.type };
  }
  return { required: [...(json.required ?? [])].sort(), properties };
}

describe('совместимость схем событий с baseline', () => {
  it('ни одно событие не удалено и не переименовано', () => {
    const currentKeys = Object.keys(eventSchemas);
    const removed = Object.keys(baseline).filter((key) => !currentKeys.includes(key));
    expect(removed, `Удалённые события: ${removed.join(', ')}`).toEqual([]);
  });

  for (const [routingKey, base] of Object.entries(baseline)) {
    it(`${routingKey}: обязательные поля сохранены, типы не изменились`, () => {
      const schema = eventSchemas[routingKey as keyof typeof eventSchemas];
      expect(schema, `Схема ${routingKey} отсутствует`).toBeDefined();
      const current = describeSchema(schema);

      const missingRequired = base.required.filter((f) => !current.required.includes(f));
      expect(missingRequired, `Удалены обязательные поля: ${missingRequired.join(', ')}`).toEqual(
        [],
      );

      for (const [field, baseType] of Object.entries(base.properties)) {
        const currentType = current.properties[field]?.type;
        expect(
          currentType,
          `Поле ${field} имело тип ${baseType.type}, стало ${String(currentType)}`,
        ).toBe(baseType.type);
      }
    });
  }
});
