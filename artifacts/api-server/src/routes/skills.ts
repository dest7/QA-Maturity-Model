/**
 * Маршруты справочника навыков (Skills).
 *
 * Навыки — это статический справочник из 15 позиций, разбитых на 5 категорий:
 *   - Test Strategy (3 навыка)
 *   - Test Design (3 навыка)
 *   - Test Automation (3 навыка)
 *   - Quality Metrics (3 навыка)
 *   - Process (3 навыка)
 *
 * Каждый навык содержит описание 4 уровней зрелости (0–3) и соответствующие:
 *   - levelRequirements    — что должно выполняться на данном уровне
 *   - levelArtifacts       — артефакты, подтверждающие уровень
 *   - levelRecommendations — рекомендации для перехода на следующий уровень
 *
 * GET /api/skills — возвращает все навыки, отсортированные по ID.
 *                   Используется фронтендом как статический справочник.
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { skillsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/", async (_req, res) => {
  const skills = await db.select().from(skillsTable).orderBy(skillsTable.id);
  res.json(skills);
});

export default router;
