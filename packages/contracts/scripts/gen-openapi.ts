/**
 * Генерация OpenAPI из Zod-реестра (0.6): Zod — единственный источник истины,
 * openapi/gateway.json — артефакт для документации и CI-сверки (дрейф контракта
 * ловится diff'ом закоммиченного файла).
 *
 * Запуск: pnpm gen (в каталоге packages/contracts).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { apiRoutes, apiSchemas } from '../src/api/registry';

type Json = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType, name: string): Json {
  try {
    return z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' }) as Json;
  } catch (error) {
    console.warn(`[gen-openapi] схема ${name} не сериализована:`, String(error));
    return { type: 'object' };
  }
}

function ref(name: string): Json {
  return { $ref: `#/components/schemas/${name}` };
}

function isOptional(schema: z.ZodType): boolean {
  return schema instanceof z.ZodOptional;
}

function pathParams(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1] as string);
}

function buildParameters(route: (typeof apiRoutes)[number]): Json[] {
  const params: Json[] = pathParams(route.path).map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));

  if (route.query) {
    const querySchema = apiSchemas[route.query];
    if (querySchema instanceof z.ZodObject) {
      const shape = querySchema.shape as Record<string, z.ZodType>;
      for (const [name, prop] of Object.entries(shape)) {
        const json = toJsonSchema(prop, `${route.query}.${name}`);
        params.push({
          name,
          in: 'query',
          required: !isOptional(prop) && prop.safeParse(undefined).success === false,
          schema: json,
        });
      }
    }
  }
  return params;
}

function buildPaths(): Json {
  const paths: Json = {};
  for (const route of apiRoutes) {
    const item = (paths[route.path] ??= {}) as Json;
    const isArray = route.response.startsWith('array:');
    const responseName = isArray ? route.response.slice('array:'.length) : route.response;
    const responses: Json = {
      '200': {
        description: 'Успех',
        content: {
          'application/json': {
            schema: isArray ? { type: 'array', items: ref(responseName) } : ref(responseName),
          },
        },
      },
      '400': {
        description: 'Ошибка валидации',
        content: { 'application/json': { schema: ref('ApiError') } },
      },
      '401': {
        description: 'Нет/просрочен токен',
        content: { 'application/json': { schema: ref('ApiError') } },
      },
      '403': {
        description: 'Недостаточно прав',
        content: { 'application/json': { schema: ref('ApiError') } },
      },
    };
    if (route.method === 'post' || route.method === 'put') {
      responses['409'] = {
        description: 'Конфликт (слот занят, дубль, недопустимый переход)',
        content: { 'application/json': { schema: ref('ApiError') } },
      };
    }

    item[route.method] = {
      tags: [route.tag],
      summary: route.summary,
      parameters: buildParameters(route),
      ...(route.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: ref(route.body) } },
            },
          }
        : {}),
      responses,
    };
  }
  return paths;
}

function main(): void {
  const components: Record<string, Json> = {};
  for (const [name, schema] of Object.entries(apiSchemas)) {
    components[name] = toJsonSchema(schema, name);
  }

  const doc = {
    openapi: '3.1.0',
    info: {
      title: 'mp-v2 gateway',
      version: '0.1.0',
      description:
        'Сгенерировано из Zod-схем packages/contracts. Не редактировать вручную: pnpm gen.',
    },
    paths: buildPaths(),
    components: { schemas: components },
  };

  const outDir = join(process.cwd(), 'openapi');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'gateway.json');
  writeFileSync(outFile, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(`[gen-openapi] записан ${outFile} (схем: ${Object.keys(components).length})`);
}

main();
