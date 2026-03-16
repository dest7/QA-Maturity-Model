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
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
