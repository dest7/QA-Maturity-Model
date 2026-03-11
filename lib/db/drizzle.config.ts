/**
 * Конфигурация Drizzle Kit — инструмента для управления миграциями БД.
 *
 * Drizzle Kit читает TypeScript-схему из src/schema/index.ts и генерирует
 * SQL-миграции, которые можно применить к реальной базе данных.
 *
 * Основные команды (выполняются из корня монорепозитория):
 *   pnpm --filter @workspace/db run db:push     — применить схему к БД напрямую (без миграций, только для разработки)
 *   pnpm --filter @workspace/db run db:generate — сгенерировать SQL-файл миграции
 *   pnpm --filter @workspace/db run db:migrate  — применить накопленные миграции
 *   pnpm --filter @workspace/db run db:studio   — открыть Drizzle Studio (GUI для БД)
 */

import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
