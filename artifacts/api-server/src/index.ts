/**
 * Точка входа API-сервера.
 *
 * Алгоритм запуска:
 * 1. Читаем PORT — обязательная переменная окружения.
 * 2. runMigrations() — применяет SQL-миграции к БД (безопасно при повторных запусках).
 *    В dev: миграции берутся из lib/db/drizzle/.
 *    В production: из dist/drizzle/ (скопировано build-скриптом).
 * 3. seedIfEmpty() — заполняет БД начальными данными, если она пустая.
 * 4. Запускаем HTTP-сервер только после успешных шагов 2 и 3.
 */

import path from "path";
import { fileURLToPath } from "url";
import app from "./app";
import { runMigrations } from "@workspace/db";
import { seedIfEmpty } from "./lib/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Определяем путь к папке миграций в зависимости от среды.
// В ESM (dev, tsx): import.meta.url корректно указывает на текущий файл.
// В CJS (prod, esbuild): import.meta.url пуст; используем process.argv[1] —
//   Node.js всегда устанавливает его равным пути к запускаемому файлу.
function getMigrationsFolder(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const metaUrl: string | undefined = import.meta.url;
  const currentDir = metaUrl
    ? path.dirname(fileURLToPath(metaUrl))
    : path.dirname(process.argv[1] ?? "");

  return isProduction
    ? path.join(currentDir, "drizzle")
    : path.join(currentDir, "..", "..", "..", "lib", "db", "drizzle");
}

runMigrations(getMigrationsFolder())
  .then(() => seedIfEmpty())
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
