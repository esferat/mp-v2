/**
 * Обновление baseline совместимости событий (0.6): фиксирует обязательные поля и
 * типы всех версионированных схем. CI сравнивает текущее состояние с baseline —
 * удаление/смена типа поля ломает билд (semver-правила для событий).
 *
 * Запуск ТОЛЬКО осознанно при изменении контракта: pnpm test:update-baseline
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { eventSchemas } from '../src/events/index';

interface FieldBaseline {
  type: string | undefined;
}

interface EventBaseline {
  required: string[];
  properties: Record<string, FieldBaseline>;
}

function describe(schema: z.ZodType): EventBaseline {
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

const baseline: Record<string, EventBaseline> = {};
for (const [routingKey, schema] of Object.entries(eventSchemas)) {
  baseline[routingKey] = describe(schema);
}

const outDir = join(process.cwd(), 'compat');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'events.baseline.json'),
  `${JSON.stringify(baseline, null, 2)}\n`,
  'utf8',
);
console.log(`[events-baseline] записан baseline для ${Object.keys(baseline).length} событий`);
