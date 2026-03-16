/**
 * Health-check эндпоинт.
 *
 * GET /api/healthz
 *
 * Используется системами мониторинга и балансировщиками нагрузки для проверки
 * того, что сервер жив и принимает запросы. Ответ проходит валидацию через
 * Zod-схему HealthCheckResponse, что гарантирует соответствие OpenAPI-спецификации.
 *
 * Возвращает: { status: "ok" }
 */

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
