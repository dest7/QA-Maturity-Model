import { Router, type IRouter } from "express";
import { db, teamsTable, skillsTable, teamSkillLevelsTable, orgUnitsTable } from "@workspace/db";
import { isNull } from "drizzle-orm";
import { requireAuth, requireManagerOrAdmin } from "../lib/auth";
import { z } from "zod/v4";

const router: IRouter = Router();

/**
 * GET /api/metrics — сводная аналитика по всей компании.
 * Доступно только для ролей manager и admin.
 *
 * Query params:
 *   orgUnitId — фильтр по узлу оргструктуры (включая всех потомков)
 *
 * Возвращает:
 *   teams          — список команд с уровнями и статусами
 *   heatmap        — матрица команда × навык с уровнями
 *   skillAverages  — средний уровень и распределение по каждому навыку
 *   categoryAvgs   — средний уровень по каждой категории
 *   statusSummary  — количество команд в каждом статусе оценки
 */
router.get("/", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const queryOrgUnitId = req.query.orgUnitId ? z.coerce.number().int().positive().parse(req.query.orgUnitId) : null;

  // Если задан фильтр — BFS по дереву, собираем все узлы-потомки включительно
  let filteredTeamIds: number[] | null = null;
  if (queryOrgUnitId !== null) {
    const allUnits = await db.select().from(orgUnitsTable);
    const descendantIds = new Set<number>();
    const queue = [queryOrgUnitId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      descendantIds.add(current);
      allUnits.filter((u) => u.parentId === current).forEach((u) => queue.push(u.id));
    }
    const allActiveTeams = await db.select().from(teamsTable).where(isNull(teamsTable.deletedAt));
    filteredTeamIds = allActiveTeams
      .filter((t) => t.orgUnitId !== null && descendantIds.has(t.orgUnitId))
      .map((t) => t.id);
  }

  const allTeams = await db.select().from(teamsTable).where(isNull(teamsTable.deletedAt));
  const teams = filteredTeamIds !== null ? allTeams.filter((t) => filteredTeamIds!.includes(t.id)) : allTeams;

  const skills = await db.select().from(skillsTable).orderBy(skillsTable.id);
  const allLevels = await db.select().from(teamSkillLevelsTable);
  const levels = filteredTeamIds !== null
    ? allLevels.filter((l) => filteredTeamIds!.includes(l.teamId))
    : allLevels;

  // Heatmap: команда → навыки с уровнями
  const heatmap = teams.map((team) => ({
    team: { id: team.id, name: team.name, overallLevel: team.overallLevel, orgUnitId: team.orgUnitId },
    skills: skills.map((skill) => {
      const entry = levels.find((l) => l.teamId === team.id && l.skillId === skill.id);
      return { skillId: skill.id, skillName: skill.name, category: skill.category, level: entry?.level ?? 0 };
    }),
  }));

  // Средние уровни по навыкам
  const skillAverages = skills.map((skill) => {
    const skillLevels = levels.filter((l) => l.skillId === skill.id).map((l) => l.level);
    const distribution = [0, 1, 2, 3].map((lvl) => skillLevels.filter((l) => l === lvl).length);
    const avg = skillLevels.length ? skillLevels.reduce((a, b) => a + b, 0) / skillLevels.length : 0;
    return { skillId: skill.id, skillName: skill.name, category: skill.category, avgLevel: avg, distribution };
  });

  // Средние уровни по категориям
  const categories = [...new Set(skills.map((s) => s.category))];
  const categoryAvgs = categories.map((cat) => {
    const catSkillIds = skills.filter((s) => s.category === cat).map((s) => s.id);
    const catLevels = levels.filter((l) => catSkillIds.includes(l.skillId)).map((l) => l.level);
    const avg = catLevels.length ? catLevels.reduce((a, b) => a + b, 0) / catLevels.length : 0;
    return { category: cat, avgLevel: avg };
  });

  // Сводка по статусам оценки
  const statusSummary = { planned: 0, in_progress: 0, completed: 0, on_hold: 0 } as Record<string, number>;
  for (const team of teams) {
    const s = team.assessmentStatus ?? "planned";
    statusSummary[s] = (statusSummary[s] ?? 0) + 1;
  }

  res.json({ teams, heatmap, skillAverages, categoryAvgs, statusSummary });
});

export default router;
