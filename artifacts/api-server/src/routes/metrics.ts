import { Router, type IRouter } from "express";
import { db, teamsTable, skillsTable, teamSkillLevelsTable } from "@workspace/db";
import { isNull, eq } from "drizzle-orm";
import { requireAuth, requireManagerOrAdmin } from "../lib/auth";

const router: IRouter = Router();

/**
 * GET /api/metrics — сводная аналитика по всей компании.
 * Доступно только для ролей manager и admin.
 *
 * Возвращает:
 *   teams          — список команд с уровнями и статусами
 *   heatmap        — матрица команда × навык с уровнями
 *   skillAverages  — средний уровень и распределение по каждому навыку
 *   categoryAvgs   — средний уровень по каждой категории
 *   statusSummary  — количество команд в каждом статусе оценки
 */
router.get("/", requireAuth, requireManagerOrAdmin, async (_req, res) => {
  const teams = await db.select().from(teamsTable).where(isNull(teamsTable.deletedAt));
  const skills = await db.select().from(skillsTable).orderBy(skillsTable.id);
  const levels = await db.select().from(teamSkillLevelsTable);

  // Heatmap: команда → навыки с уровнями
  const heatmap = teams.map((team) => ({
    team: { id: team.id, name: team.name, overallLevel: team.overallLevel },
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
