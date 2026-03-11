/**
 * Точка входа API-сервера.
 *
 * Алгоритм запуска:
 * 1. Читаем переменную окружения PORT — она обязательна; если не задана, процесс падает с ошибкой.
 * 2. Вызываем seedIfEmpty() — функция проверяет базу данных и заполняет её начальными данными,
 *    если таблица skills пустая. Это нужно для автоматической инициализации продакшен-базы.
 * 3. Только после успешного завершения seed запускаем HTTP-сервер.
 *    Если seed завершился ошибкой — процесс завершается (exit code 1), чтобы оркестратор
 *    (Docker / Replit) знал о проблеме и мог перезапустить сервис.
 */

import app from "./app";
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

seedIfEmpty()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to seed database:", err);
    process.exit(1);
  });
