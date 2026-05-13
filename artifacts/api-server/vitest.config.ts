import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    // Переменные окружения для тестов
    env: {
      DATABASE_URL: 'postgresql://qa_user:postgres@localhost:5432/qa_maturity?schema=public',
      SESSION_SECRET: 'test-session-secret-for-vitest',
    },
    // Пути к тестам
    include: [
      'src/**/*.test.ts',      // Unit-тесты рядом с кодом
      'tests/**/*.test.ts',    // Интеграционные тесты
    ],
    // Запуск тестов последовательно (важно для интеграционных тестов с БД)
    sequence: {
      concurrent: false,
    },
  },
});
