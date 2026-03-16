/**
 * Конфигурация Orval — генератора клиентского кода из OpenAPI-спецификации.
 *
 * Orval читает openapi.yaml и генерирует два независимых пакета:
 *
 * 1. api-client-react (lib/api-client-react/src/generated/)
 *    Генерирует React Query хуки (useGetTeams, useCreateTeam и т.д.) для использования
 *    в React-компонентах. Режим "split" создаёт отдельные файлы на каждый ресурс.
 *    В качестве транспортного слоя используется customFetch (не axios, не встроенный fetch).
 *    baseUrl: "/api" — все запросы автоматически получают префикс /api.
 *
 * 2. zod (lib/api-zod/src/generated/)
 *    Генерирует Zod-схемы для валидации запросов/ответов API.
 *    Используется на сервере для валидации входящих данных (req.body, req.params).
 *    coerce включён для query/param — автоматически приводит строки к нужным типам
 *    (например, "42" → 42 для числовых параметров пути).
 *
 * Как перегенерировать код после изменения openapi.yaml:
 *   pnpm --filter @workspace/api-spec run generate
 */

import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Трансформер фиксирует заголовок API на "Api", чтобы сгенерированные файлы
// всегда назывались api.ts (Orval использует title для имён файлов)
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
          },
        },
        useDates: true,
      },
    },
  },
});
