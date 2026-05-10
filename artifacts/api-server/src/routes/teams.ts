/**
 * Маршруты управления командами (Teams).
 *
 * Ключевой алгоритм — расчёт общего уровня зрелости команды (calculateOverallLevel):
 *   Уровень N присваивается команде, если >= 85% навыков достигли уровня N или выше.
 *   Поиск ведётся сверху вниз (от 3 до 1), чтобы вернуть максимально достигнутый уровень.
 *   Если ни один уровень не достигнут порогом — возвращается 0.
 *
 * Soft-delete (мягкое удаление):
 *   Команды не удаляются физически. Вместо этого при архивировании заполняется
 *   поле deletedAt = текущая дата. При выборке активных команд фильтруется WHERE deletedAt IS NULL.
 *   Восстановление сбрасывает deletedAt = null.
 *
 * ВАЖНО: маршрут GET /deleted объявлен ДО GET /:teamId, иначе Express воспримет
 *   строку "deleted" как значение параметра :teamId и вернёт 404.
 *
 * Маршруты:
 *   GET    /api/teams                                 — активные команды
 *   GET    /api/teams/deleted                         — архивные команды
 *   POST   /api/teams                                 — создать команду
 *   GET    /api/teams/:teamId                         — команда + навыки (JOIN)
 *   PUT    /api/teams/:teamId                         — изменить name/description
 *   PATCH  /api/teams/:teamId/status                  — изменить статус оценки
 *   DELETE /api/teams/:teamId                         — архивировать (soft delete)
 *   POST   /api/teams/:teamId/restore                 — восстановить из архива
 *   PUT    /api/teams/:teamId/skills/:skillId         — изменить уровень навыка,
 *                                                       пересчитать overallLevel,
 *                                                       обновить lastAssessedAt
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { teamsTable, skillsTable, teamSkillLevelsTable } from "@workspace/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod/v4";
import {
  CreateTeamBody,
  UpdateSkillLevelBody,
  UpdateTeamBody,
  GetTeamParams,
  DeleteTeamParams,
  UpdateTeamParams,
  RestoreTeamParams,
  UpdateSkillLevelParams,
  UpdateTeamStatusBody,
  UpdateTeamStatusParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Вычисляет общий уровень зрелости команды на основе уровней всех навыков.
 *
 * Алгоритм: для уровней от 3 до 1 считаем количество навыков с level >= N.
 * Если это количество составляет >= 85% от общего числа навыков — возвращаем N.
 * Если ни один порог не достигнут — возвращаем 0.
 */
function calculateOverallLevel(skillLevels: { level: number }[]): number {
  const total = skillLevels.length;
  if (total === 0) return 0;
  const threshold = 0.85;
  for (let level = 3; level >= 1; level--) {
    const count = skillLevels.filter((s) => s.level >= level).length;
    if (count / total >= threshold) return level;
  }
  return 0;
}

// Список активных команд (не архивированных)
router.get("/", async (_req, res) => {
  const teams = await db
    .select()
    .from(teamsTable)
    .where(isNull(teamsTable.deletedAt))
    .orderBy(teamsTable.id);
  res.json(teams);
});

// Список архивных команд (soft-deleted)
// ВАЖНО: этот маршрут должен быть ДО GET /:teamId
router.get("/deleted", async (_req, res) => {
  const teams = await db
    .select()
    .from(teamsTable)
    .where(isNotNull(teamsTable.deletedAt))
    .orderBy(teamsTable.id);
  res.json(teams);
});

// Создание новой команды
router.post("/", async (req, res) => {
  const body = CreateTeamBody.parse(req.body);
  const skills = await db.select().from(skillsTable);

  const [team] = await db
    .insert(teamsTable)
    .values({
      name: body.name,
      description: body.description,
      overallLevel: 0,
      assessmentStatus: "planned",
    })
    .returning();

  if (skills.length > 0) {
    await db.insert(teamSkillLevelsTable).values(
      skills.map((s) => ({ teamId: team.id, skillId: s.id, level: 0 }))
    );
  }

  res.status(201).json(team);
});

// Получение команды с полными данными о навыках (JOIN между team_skill_levels и skills)
router.get("/:teamId", async (req, res) => {
  const { teamId } = GetTeamParams.parse(req.params);

  const team = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (team.length === 0) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const skillLevels = await db
    .select({
      skillId: skillsTable.id,
      skillName: skillsTable.name,
      skillCategory: skillsTable.category,
      skillDescription: skillsTable.description,
      levelDescriptions: skillsTable.levelDescriptions,
      levelRequirements: skillsTable.levelRequirements,
      levelArtifacts: skillsTable.levelArtifacts,
      levelRecommendations: skillsTable.levelRecommendations,
      level: teamSkillLevelsTable.level,
      notes: teamSkillLevelsTable.notes,
    })
    .from(teamSkillLevelsTable)
    .innerJoin(skillsTable, eq(skillsTable.id, teamSkillLevelsTable.skillId))
    .where(eq(teamSkillLevelsTable.teamId, teamId))
    .orderBy(skillsTable.id);

  res.json({ ...team[0], skillLevels });
});

// Редактирование названия и описания команды
router.put("/:teamId", async (req, res) => {
  const { teamId } = UpdateTeamParams.parse(req.params);
  const body = UpdateTeamBody.parse(req.body);

  const existing = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (existing.length === 0) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const [updated] = await db
    .update(teamsTable)
    .set({ name: body.name, description: body.description })
    .where(eq(teamsTable.id, teamId))
    .returning();

  res.json(updated);
});

// Обновление статуса оценки зрелости команды (только для ревьюверов)
router.patch("/:teamId/status", async (req, res) => {
  const { teamId } = UpdateTeamStatusParams.parse(req.params);
  const body = UpdateTeamStatusBody.parse(req.body);

  const existing = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (existing.length === 0) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const [updated] = await db
    .update(teamsTable)
    .set({ assessmentStatus: body.assessmentStatus })
    .where(eq(teamsTable.id, teamId))
    .returning();

  res.json(updated);
});

// Мягкое удаление (архивирование): проставляем deletedAt = now()
router.delete("/:teamId", async (req, res) => {
  const { teamId } = DeleteTeamParams.parse(req.params);

  const existing = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (existing.length === 0) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  await db
    .update(teamsTable)
    .set({ deletedAt: new Date() })
    .where(eq(teamsTable.id, teamId));

  res.json({ success: true });
});

// Восстановление из архива: сбрасываем deletedAt = null
router.post("/:teamId/restore", async (req, res) => {
  const { teamId } = RestoreTeamParams.parse(req.params);

  const existing = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (existing.length === 0) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const [restored] = await db
    .update(teamsTable)
    .set({ deletedAt: null })
    .where(eq(teamsTable.id, teamId))
    .returning();

  res.json(restored);
});

// Назначение команды в узел оргструктуры (admin/manager)
router.patch("/:teamId/org-unit", async (req, res) => {
  const { teamId } = GetTeamParams.parse(req.params);
  const body = z.object({ orgUnitId: z.number().int().positive().nullable() }).parse(req.body);

  const existing = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (existing.length === 0) { res.status(404).json({ error: "Team not found" }); return; }

  const [updated] = await db
    .update(teamsTable)
    .set({ orgUnitId: body.orgUnitId })
    .where(eq(teamsTable.id, teamId))
    .returning();

  res.json(updated);
});

// Обновление заметок (notes) по навыку для команды
router.patch("/:teamId/skills/:skillId/notes", async (req, res) => {
  const { teamId, skillId } = UpdateSkillLevelParams.parse(req.params);
  const body = z.object({ notes: z.string().nullable() }).parse(req.body);

  await db
    .update(teamSkillLevelsTable)
    .set({ notes: body.notes })
    .where(and(eq(teamSkillLevelsTable.teamId, teamId), eq(teamSkillLevelsTable.skillId, skillId)));

  res.json({ success: true });
});

// Изменение уровня навыка для команды с пересчётом overallLevel и обновлением lastAssessedAt
router.put("/:teamId/skills/:skillId", async (req, res) => {
  const { teamId, skillId } = UpdateSkillLevelParams.parse(req.params);
  const body = UpdateSkillLevelBody.parse(req.body);

  // Upsert: вставляем запись, если её нет, иначе обновляем
  const existing = await db
    .select()
    .from(teamSkillLevelsTable)
    .where(
      and(eq(teamSkillLevelsTable.teamId, teamId), eq(teamSkillLevelsTable.skillId, skillId))
    );

  if (existing.length === 0) {
    await db
      .insert(teamSkillLevelsTable)
      .values({ teamId, skillId, level: body.level });
  } else {
    await db
      .update(teamSkillLevelsTable)
      .set({ level: body.level })
      .where(
        and(eq(teamSkillLevelsTable.teamId, teamId), eq(teamSkillLevelsTable.skillId, skillId))
      );
  }

  // Пересчитываем и сохраняем общий уровень зрелости команды
  const allLevels = await db
    .select({ level: teamSkillLevelsTable.level })
    .from(teamSkillLevelsTable)
    .where(eq(teamSkillLevelsTable.teamId, teamId));

  const overallLevel = calculateOverallLevel(allLevels);

  // Обновляем overallLevel и проставляем время последней оценки
  await db
    .update(teamsTable)
    .set({ overallLevel, lastAssessedAt: new Date() })
    .where(eq(teamsTable.id, teamId));

  res.json({ teamId, skillId, level: body.level });
});

export default router;
