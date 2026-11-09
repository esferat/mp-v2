/**
 * Генерация OpenAPI из Zod-схем (0.6): Zod — источник истины для контрактов,
 * файлы в `openapi/` — производные и проверяются в CI на дрейф.
 *
 * Выход:
 * - `openapi/gateway.json` — агрегат всего, что отдаёт gateway;
 * - `openapi/<service>.yaml` — по-сервисные спецификации (0.6: чек-лист
 *   «OpenAPI-спецификации сервисов в contracts/openapi/<service>.yaml»).
 *
 * Запуск: pnpm gen (входит в корневой `pnpm gen`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { stringify } from 'yaml';
import { apiRoutes, apiSchemas } from '../src/api/registry';

type Json = Record<string, unknown>;
type Route = (typeof apiRoutes)[number];

/** Общие схемы попадают в каждую по-сервисную спецификацию (ошибки/пагинация). */
const SHARED_SCHEMAS = ['ApiError', 'PaginationQuery', 'Ok'] as const;

const DESCRIPTION = 'Сгенерировано из Zod-схем packages/contracts. Перегенерация: pnpm gen.';

function toJsonSchema(schema: z.ZodType, name: string): Json {
  try {
    return z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' }) as Json;
  } catch (error) {
    console.warn(`[gen-openapi] схема ${name} не сериализуется:`, String(error));
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

function buildParameters(route: Route): Json[] {
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

function buildPaths(routes: Route[]): Json {
  const paths: Json = {};
  for (const route of routes) {
    const item = (paths[route.path] ??= {}) as Json;
    const isArray = route.response.startsWith('array:');
    const responseName = isArray ? route.response.slice('array:'.length) : route.response;
    const responses: Json = {
      '200': {
        description: 'Успех:',
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
        description: 'Конфликт (запись занята, дубликат, уже обработано и т.п.)',
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

/** Документ для набора маршрутов: только используемые этим набором схемы. */
function buildDoc(routes: Route[], title: string, description: string): Json {
  const names = new Set<string>(SHARED_SCHEMAS);
  for (const route of routes) {
    if (route.body) names.add(route.body);
    const response = route.response.startsWith('array:')
      ? route.response.slice('array:'.length)
      : route.response;
    names.add(response);
    if (route.query) names.add(route.query);
  }

  const components: Record<string, Json> = {};
  for (const name of names) {
    const schema = apiSchemas[name as keyof typeof apiSchemas];
    if (schema) components[name] = toJsonSchema(schema as z.ZodType, name);
  }

  return {
    openapi: '3.1.0',
    info: { title, version: '0.1.0', description },
    paths: buildPaths(routes),
    components: { schemas: components },
  };
}

function main(): void {
  const outDir = join(process.cwd(), 'openapi');
  mkdirSync(outDir, { recursive: true });

  // Агрегат: всё, что отдаёт gateway (был и остаётся точкой входа для обзора)
  const aggregate = buildDoc(apiRoutes, 'mp-v2 gateway', DESCRIPTION);
  const aggregateFile = join(outDir, 'gateway.json');
  writeFileSync(aggregateFile, `${JSON.stringify(aggregate, null, 2)}\n`, 'utf8');
  console.log(`[gen-openapi] записан ${aggregateFile} (схем: ${Object.keys(apiSchemas).length})`);

  // По-сервисные спецификации (0.6): contracts/openapi/<service>.yaml
  const tags = [...new Set(apiRoutes.map((route) => route.tag))].sort();
  for (const tag of tags) {
    const routes = apiRoutes.filter((route) => route.tag === tag);
    const doc = buildDoc(
      routes,
      `mp-v2 ${tag}`,
      `${DESCRIPTION} Сервис: ${tag}, операций: ${routes.length}.`,
    );
    const file = join(outDir, `${tag}.yaml`);
    writeFileSync(file, stringify(doc), 'utf8');
    console.log(`[gen-openapi] записан ${file} (операций: ${routes.length})`);
  }
}

main();
