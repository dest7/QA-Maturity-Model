/**
 * Конфигурация Express-приложения.
 *
 * Здесь задаётся только структура middleware и маршрутизация.
 * Запуск сервера (listen) намеренно вынесен в index.ts,
 * чтобы app можно было использовать в тестах без реального открытия порта.
 *
 * Порядок middleware важен:
 * 1. cors()              — разрешает кросс-доменные запросы от фронтенда (React/Vite, localhost:5173)
 * 2. express.json()      — парсит тело запроса как JSON (Content-Type: application/json)
 * 3. express.urlencoded  — парсит URL-encoded формы (форм из HTML)
 * 4. router под /api     — все бизнес-маршруты имеют префикс /api (например, /api/teams)
 */

import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const PgStore = connectPgSimple(session);
const app: Express = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET ?? "qa-maturity-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api", router);

export default app;
