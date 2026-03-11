/**
 * Подключение к базе данных PostgreSQL через Drizzle ORM.
 *
 * Используется пул соединений (pg.Pool), что позволяет эффективно переиспользовать
 * TCP-соединения при высокой нагрузке вместо открытия нового соединения на каждый запрос.
 *
 * DATABASE_URL — строка подключения вида:
 *   postgresql://user:password@host:5432/dbname
 * Задаётся как переменная окружения. В Replit она создаётся автоматически
 * при подключении встроенной PostgreSQL. При локальной разработке прописывается в .env.
 *
 * Экспортируемые значения:
 *   pool — сырой pg.Pool для прямых запросов при необходимости
 *   db   — экземпляр Drizzle с типизацией по схеме; используется во всём приложении
 *   *    — все типы и таблицы из ./schema (ре-экспорт для удобного импорта)
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
