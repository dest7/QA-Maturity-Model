import { Router, type IRouter } from "express";
import { db, teamsTable, skillsTable, teamSkillLevelsTable, orgUnitsTable, teamSkillSnapshotsTable, teamSkillHistoryTable } from "@workspace/db";
import { isNull, sql, eq, and, gte, lte, lt, inArray } from "drizzle-orm";
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

/**
 * GET /api/metrics/history — исторические данные для гистограммы.
 * Доступно только для ролей manager и admin.
 *
 * Query params:
 *   period — 'week' (7 дней), 'month' (30 дней), 'quarter' (90 дней), 'year' (365 дней)
 *   orgUnitId — опционально, фильтр по узлу оргструктуры (включая всех потомков)
 *
 * Возвращает:
 *   snapshots — массив снимков по дням с распределением команд по уровням
 *   (гибрид: прошлые дни из snapshots, сегодня из team_skill_history)
 */
router.get("/history", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const periodSchema = z.enum(["week", "month", "quarter", "year"]);
  const period = periodSchema.parse(req.query.period ?? "week");
  const queryOrgUnitId = req.query.orgUnitId ? z.coerce.number().int().positive().safeParse(req.query.orgUnitId).data : null;

  const daysMap = { week: 7, month: 30, quarter: 90, year: 365 };
  const days = daysMap[period];

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  // Если задан orgUnitId — BFS по дереву, собираем все узлы-потомки включительно
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
    const allActiveTeams = await db.select({ id: teamsTable.id, orgUnitId: teamsTable.orgUnitId }).from(teamsTable).where(isNull(teamsTable.deletedAt));
    filteredTeamIds = allActiveTeams
      .filter((t) => t.orgUnitId !== null && descendantIds.has(t.orgUnitId))
      .map((t) => t.id);
  }

  // Получаем все снимки за период (кроме сегодня)
  const snapshots = await db
    .select()
    .from(teamSkillSnapshotsTable)
    .where(
      and(
        gte(teamSkillSnapshotsTable.snapshotDate, fromDateStr),
        lt(teamSkillSnapshotsTable.snapshotDate, today),
        filteredTeamIds && filteredTeamIds.length > 0 ? inArray(teamSkillSnapshotsTable.teamId, filteredTeamIds) : undefined
      )
    )
    .orderBy(teamSkillSnapshotsTable.snapshotDate);

  // Получаем все активные команды для подсчёта (с учётом фильтра)
  const allTeamsRaw = await db.select({ id: teamsTable.id }).from(teamsTable).where(isNull(teamsTable.deletedAt));
  const allTeams = filteredTeamIds
    ? allTeamsRaw.filter((t) => filteredTeamIds!.includes(t.id))
    : allTeamsRaw;

  // Получаем количество всех навыков для расчёта среднего уровня команды
  const allSkills = await db.select({ id: skillsTable.id }).from(skillsTable);
  const totalSkills = allSkills.length;

  // Получаем текущие уровни для отфильтрованных команд (источник истины для сегодня)
  let currentTeamLevels: { teamId: number; skillId: number; level: number }[] = [];
  if (filteredTeamIds && filteredTeamIds.length > 0) {
    currentTeamLevels = await db
      .select({ teamId: teamSkillLevelsTable.teamId, skillId: teamSkillLevelsTable.skillId, level: teamSkillLevelsTable.level })
      .from(teamSkillLevelsTable)
      .where(inArray(teamSkillLevelsTable.teamId, filteredTeamIds));
  } else {
    currentTeamLevels = await db
      .select({ teamId: teamSkillLevelsTable.teamId, skillId: teamSkillLevelsTable.skillId, level: teamSkillLevelsTable.level })
      .from(teamSkillLevelsTable);
  }

  // Группируем по датам
  const byDate = new Map<string, { teamId: number; skillId: number; level: number }[]>();

  // Добавляем снимки за прошлые дни
  for (const snapshot of snapshots) {
    const dateStr = snapshot.snapshotDate;
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, []);
    }
    byDate.get(dateStr)!.push({ teamId: snapshot.teamId, skillId: snapshot.skillId, level: snapshot.level });
  }

  // Добавляем сегодняшнее состояние — все текущие уровни для консистентности
  if (currentTeamLevels.length > 0) {
    byDate.set(today, currentTeamLevels);
  }

  // Формируем результат
  const result = [];
  for (const [dateStr, data] of byDate.entries()) {
    // Группируем по командам и считаем уровень каждой
    const teamSkills = new Map<number, number[]>();
    for (const item of data) {
      if (!teamSkills.has(item.teamId)) {
        teamSkills.set(item.teamId, []);
      }
      teamSkills.get(item.teamId)!.push(item.level);
    }

    // teamDistribution: сколько команд на каждом уровне (0/1/2/3)
    // Для расчёта уровня команды используем средний уровень по всем 15 навыкам
    const teamDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const [teamId, levels] of teamSkills.entries()) {
      // Если у команды есть не все навыки, считаем отсутствующие как 0
      const missingSkills = totalSkills - levels.length;
      const totalLevel = levels.reduce((a, b) => a + b, 0);
      const avgLevel = totalLevel / totalSkills; // Делим на общее количество навыков
      const roundedLevel = Math.round(avgLevel);
      teamDistribution[roundedLevel as keyof typeof teamDistribution]++;
    }

    // skillDistribution: сколько всего навыков на каждом уровне (0/1/2/3)
    const skillDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const item of data) {
      skillDistribution[item.level as keyof typeof skillDistribution]++;
    }

    result.push({
      date: dateStr,
      teamDistribution,
      skillDistribution,
    });
  }

  // Сортируем по дате
  result.sort((a, b) => a.date.localeCompare(b.date));

  res.json({ period, days, snapshots: result });
});

/**
 * POST /api/metrics/snapshot — создать снимок уровней навыков вручную.
 * Доступно только для ролей manager и admin.
 *
 * Проверяет, не был ли уже создан снимок сегодня.
 * Если нет — создаёт снимок всех активных команд.
 */
router.post("/snapshot", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const today = new Date().toISOString().split("T")[0];

  // Проверяем, есть ли уже снимки за сегодня
  const existingSnapshots = await db
    .select({ id: teamSkillSnapshotsTable.id })
    .from(teamSkillSnapshotsTable)
    .where(eq(teamSkillSnapshotsTable.snapshotDate, today))
    .limit(1);

  if (existingSnapshots.length > 0) {
    return res.status(409).json({ error: "Снимок за сегодня уже создан", date: today });
  }

  // Получаем все активные команды
  const teams = await db.select({ id: teamsTable.id }).from(teamsTable).where(isNull(teamsTable.deletedAt));

  // Получаем текущие уровни навыков
  const allLevels = await db.select().from(teamSkillLevelsTable);

  // Создаём снимки
  const snapshotsToInsert = [];
  for (const team of teams) {
    const teamLevels = allLevels.filter(l => l.teamId === team.id);
    for (const level of teamLevels) {
      snapshotsToInsert.push({
        teamId: team.id,
        skillId: level.skillId,
        level: level.level,
        snapshotDate: today,
      });
    }
  }

  // Вставляем батчем
  if (snapshotsToInsert.length > 0) {
    await db.insert(teamSkillSnapshotsTable).values(snapshotsToInsert);
  }

  res.json({ 
    success: true, 
    message: `Создано ${snapshotsToInsert.length} записей снимка`, 
    date: today,
    teamCount: teams.length,
  });
});

export default router;
