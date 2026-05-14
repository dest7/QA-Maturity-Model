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

  return res.json({
    success: true,
    message: `Создано ${snapshotsToInsert.length} записей снимка`,
    date: today,
    teamCount: teams.length,
  });
});

/**
 * GET /api/metrics/teams/criticality — распределение команд по уровням зрелости и критичности.
 * Доступно только для ролей manager и admin.
 *
 * Query params:
 *   orgUnitId — опционально, фильтр по узлу оргструктуры (включая всех потомков)
 *
 * Возвращает:
 *   byCriticality — группировка по критичности (MC/BC+/BC) с распределением по уровням
 *   summary — общее количество команд и средний уровень
 */
router.get("/teams/criticality", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const queryOrgUnitId = req.query.orgUnitId ? z.coerce.number().int().positive().safeParse(req.query.orgUnitId).data : null;

  // BFS по дереву для фильтрации
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

  // Получаем все активные команды с критичностью
  const allTeamsRaw = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      overallLevel: teamsTable.overallLevel,
      criticality: teamsTable.criticality,
      orgUnitId: teamsTable.orgUnitId,
    })
    .from(teamsTable)
    .where(isNull(teamsTable.deletedAt));

  const teams = filteredTeamIds
    ? allTeamsRaw.filter((t) => filteredTeamIds!.includes(t.id))
    : allTeamsRaw;

  // Группировка по критичности и уровням
  const criticalityLevels = ["MC", "BC+", "BC", "BO", "OP"] as const;
  const byCriticality = criticalityLevels.map((crit) => {
    const critTeams = teams.filter((t) => t.criticality === crit);
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const team of critTeams) {
      distribution[team.overallLevel as keyof typeof distribution]++;
    }
    const avgLevel = critTeams.length > 0
      ? critTeams.reduce((sum, t) => sum + t.overallLevel, 0) / critTeams.length
      : 0;
    return {
      criticality: crit,
      count: critTeams.length,
      distribution,
      avgLevel: parseFloat(avgLevel.toFixed(2)),
      teams: critTeams.map((t) => ({ id: t.id, name: t.name, overallLevel: t.overallLevel })),
    };
  });

  const totalTeams = teams.length;
  const avgLevel = totalTeams > 0
    ? teams.reduce((sum, t) => sum + t.overallLevel, 0) / totalTeams
    : 0;

  res.json({
    summary: {
      totalTeams,
      avgLevel: parseFloat(avgLevel.toFixed(2)),
    },
    byCriticality,
  });
});

/**
 * GET /api/metrics/skills/transition-time — среднее время перехода между уровнями навыков.
 * Доступно только для ролей manager и admin.
 *
 * Query params:
 *   orgUnitId — опционально, фильтр по узлу оргструктуры (включая всех потомков)
 *
 * Возвращает:
 *   bySkill — для каждого навыка: среднее время перехода между уровнями (0→1, 1→2, 2→3)
 *   overall — среднее время по всем навыкам
 */
router.get("/skills/transition-time", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const queryOrgUnitId = req.query.orgUnitId ? z.coerce.number().int().positive().safeParse(req.query.orgUnitId).data : null;

  // BFS по дереву для фильтрации
  let filteredTeamIds: number[] | null = null;
  if (queryOrgUnitId !== null) {
    const allUnits = await db.select().from(orgUnitsTable);
    const descendantIds = new Set<number>();
    const queue = [queryOrgUnitId];
    while (queue.length) {
      const current = queue.shift()!;
      descendantIds.add(current);
      allUnits.filter((u) => u.parentId === current).forEach((u) => queue.push(u.id));
    }
    const allActiveTeams = await db.select({ id: teamsTable.id, orgUnitId: teamsTable.orgUnitId }).from(teamsTable).where(isNull(teamsTable.deletedAt));
    filteredTeamIds = allActiveTeams
      .filter((t) => t.orgUnitId !== null && descendantIds.has(t.orgUnitId))
      .map((t) => t.id);
  }

  // Получаем все навыки
  const skills = await db.select({ id: skillsTable.id, name: skillsTable.name, category: skillsTable.category }).from(skillsTable).orderBy(skillsTable.id);

  // Получаем всю историю изменений
  const history = await db
    .select({
      teamId: teamSkillHistoryTable.teamId,
      skillId: teamSkillHistoryTable.skillId,
      oldLevel: teamSkillHistoryTable.oldLevel,
      newLevel: teamSkillHistoryTable.newLevel,
      changedAt: teamSkillHistoryTable.changedAt,
    })
    .from(teamSkillHistoryTable)
    .orderBy(teamSkillHistoryTable.changedAt);

  // Фильтруем по командам если задан orgUnitId
  const filteredHistory = filteredTeamIds
    ? history.filter((h) => filteredTeamIds!.includes(h.teamId))
    : history;

  // Группируем по навыкам и переходам
  const bySkill = skills.map((skill) => {
    const skillHistory = filteredHistory.filter((h) => h.skillId === skill.id);
    
    // Группы переходов: 0→1, 1→2, 2→3
    const transitions = [
      { from: 0, to: 1, durations: [] as number[] },
      { from: 1, to: 2, durations: [] as number[] },
      { from: 2, to: 3, durations: [] as number[] },
    ];

    // Для каждой команды считаем время между переходами
    const teamTransitions = new Map<number, { level: number; timestamp: number }[]>();
    
    for (const h of skillHistory) {
      if (!teamTransitions.has(h.teamId)) {
        teamTransitions.set(h.teamId, []);
      }
      const arr = teamTransitions.get(h.teamId)!;
      arr.push({
        level: h.newLevel,
        timestamp: new Date(h.changedAt).getTime(),
      });
    }

    // Считаем длительности переходов
    for (const [teamId, events] of teamTransitions.entries()) {
      // Сортируем по времени
      events.sort((a, b) => a.timestamp - b.timestamp);
      
      // Ищем последовательные переходы
      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const curr = events[i];
        
        // Проверяем, что это последовательный переход (например, 0→1 затем 1→2)
        const transition = transitions.find((t) => t.from === prev.level && t.to === curr.level);
        if (transition) {
          const durationDays = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60 * 24);
          transition.durations.push(durationDays);
        }
      }
    }

    // Считаем среднее время по каждому переходу
    const avgTransitions = transitions.map((t) => ({
      from: t.from,
      to: t.to,
      avgDays: t.durations.length > 0
        ? parseFloat((t.durations.reduce((a, b) => a + b, 0) / t.durations.length).toFixed(1))
        : null,
      count: t.durations.length,
    }));

    const allDurations = transitions.flatMap((t) => t.durations);
    const overallAvg = allDurations.length > 0
      ? parseFloat((allDurations.reduce((a, b) => a + b, 0) / allDurations.length).toFixed(1))
      : null;

    return {
      skillId: skill.id,
      skillName: skill.name,
      category: skill.category,
      transitions: avgTransitions,
      overallAvgDays: overallAvg,
    };
  });

  // Общий средний показатель по всем навыкам
  const allAvgs = bySkill
    .map((s) => s.overallAvgDays)
    .filter((v): v is number => v !== null);
  const globalAvg = allAvgs.length > 0
    ? parseFloat((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length).toFixed(1))
    : null;

  res.json({
    bySkill,
    overall: {
      avgDays: globalAvg,
      skillsCount: bySkill.length,
    },
  });
});

/**
 * GET /api/metrics/tool/adoption — метрики использования инструмента.
 * Доступно только для ролей manager и admin.
 *
 * Query params:
 *   period — 'week' (7 дней), 'month' (30 дней), 'quarter' (90 дней), 'year' (365 дней)
 *   orgUnitId — опционально, фильтр по узлу оргструктуры (включая всех потомков)
 *
 * Возвращает:
 *   totalTeams — общее количество оценивших команд
 *   completedTeams — количество команд со статусом 'completed'
 *   inProgressTeams — количество команд со статусом 'in_progress'
 *   byPeriod — динамика по дням/неделям
 */
router.get("/tool/adoption", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const periodSchema = z.enum(["week", "month", "quarter", "year"]);
  const period = periodSchema.parse(req.query.period ?? "month");
  const queryOrgUnitId = req.query.orgUnitId ? z.coerce.number().int().positive().safeParse(req.query.orgUnitId).data : null;

  const daysMap = { week: 7, month: 30, quarter: 90, year: 365 };
  const days = daysMap[period];

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  // BFS по дереву для фильтрации
  let filteredTeamIds: number[] | null = null;
  if (queryOrgUnitId !== null) {
    const allUnits = await db.select().from(orgUnitsTable);
    const descendantIds = new Set<number>();
    const queue = [queryOrgUnitId];
    while (queue.length) {
      const current = queue.shift()!;
      descendantIds.add(current);
      allUnits.filter((u) => u.parentId === current).forEach((u) => queue.push(u.id));
    }
    const allActiveTeams = await db.select({ id: teamsTable.id, orgUnitId: teamsTable.orgUnitId }).from(teamsTable).where(isNull(teamsTable.deletedAt));
    filteredTeamIds = allActiveTeams
      .filter((t) => t.orgUnitId !== null && descendantIds.has(t.orgUnitId))
      .map((t) => t.id);
  }

  // Получаем все активные команды
  const allTeamsRaw = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      assessmentStatus: teamsTable.assessmentStatus,
      lastAssessedAt: teamsTable.lastAssessedAt,
      createdAt: teamsTable.createdAt,
    })
    .from(teamsTable)
    .where(isNull(teamsTable.deletedAt));

  const allTeams = filteredTeamIds
    ? allTeamsRaw.filter((t) => filteredTeamIds!.includes(t.id))
    : allTeamsRaw;

  // Фильтруем команды, которые начали оценку в периоде
  const teamsInPeriod = allTeams.filter((t) => {
    const assessmentDate = t.lastAssessedAt ?? t.createdAt;
    return assessmentDate >= fromDate;
  });

  // Группировка по статусам
  const statusCounts: Record<string, number> = {
    planned: 0,
    in_progress: 0,
    completed: 0,
    on_hold: 0,
  };

  for (const team of allTeams) {
    const status = team.assessmentStatus ?? "planned";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  // Динамика по дням (количество команд, завершивших оценку в каждый день)
  const byDay = new Map<string, number>();
  for (const team of teamsInPeriod) {
    if (team.assessmentStatus === "completed" && team.lastAssessedAt) {
      const dateStr = team.lastAssessedAt.toISOString().split("T")[0];
      byDay.set(dateStr, (byDay.get(dateStr) ?? 0) + 1);
    }
  }

  const byPeriod = Array.from(byDay.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    period,
    days,
    summary: {
      totalTeams: allTeams.length,
      assessedInPeriod: teamsInPeriod.length,
      statusCounts,
    },
    byPeriod,
  });
});

/**
 * GET /api/metrics/teams/by-type — распределение команд по типам и уровням зрелости.
 * Доступно только для ролей manager и admin.
 *
 * Query params:
 *   orgUnitId — опционально, фильтр по узлу оргструктуры (включая всех потомков)
 *
 * Возвращает:
 *   byType — группировка по типам команд (product/platform/service) с распределением по уровням
 */
router.get("/teams/by-type", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const queryOrgUnitId = req.query.orgUnitId ? z.coerce.number().int().positive().safeParse(req.query.orgUnitId).data : null;

  // BFS по дереву для фильтрации
  let filteredTeamIds: number[] | null = null;
  if (queryOrgUnitId !== null) {
    const allUnits = await db.select().from(orgUnitsTable);
    const descendantIds = new Set<number>();
    const queue = [queryOrgUnitId];
    while (queue.length) {
      const current = queue.shift()!;
      descendantIds.add(current);
      allUnits.filter((u) => u.parentId === current).forEach((u) => queue.push(u.id));
    }
    const allActiveTeams = await db.select({ id: teamsTable.id, orgUnitId: teamsTable.orgUnitId }).from(teamsTable).where(isNull(teamsTable.deletedAt));
    filteredTeamIds = allActiveTeams
      .filter((t) => t.orgUnitId !== null && descendantIds.has(t.orgUnitId))
      .map((t) => t.id);
  }

  // Получаем все активные команды
  const allTeamsRaw = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      overallLevel: teamsTable.overallLevel,
      teamType: teamsTable.teamType,
    })
    .from(teamsTable)
    .where(isNull(teamsTable.deletedAt));

  const teams = filteredTeamIds
    ? allTeamsRaw.filter((t) => filteredTeamIds!.includes(t.id))
    : allTeamsRaw;

  // Группировка по типам и уровням
  const byType = ["product", "platform", "service"].map((type) => {
    const typeTeams = teams.filter((t) => t.teamType === type);
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
    typeTeams.forEach((t) => {
      distribution[t.overallLevel as 0 | 1 | 2 | 3]++;
    });
    const avgLevel = typeTeams.length > 0
      ? typeTeams.reduce((sum, t) => sum + t.overallLevel, 0) / typeTeams.length
      : 0;
    return {
      type,
      count: typeTeams.length,
      distribution,
      avgLevel: parseFloat(avgLevel.toFixed(2)),
      teams: typeTeams.map((t) => ({ id: t.id, name: t.name, overallLevel: t.overallLevel })),
    };
  });

  res.json({ byType });
});

/**
 * GET /api/metrics/skills/summary — сводные метрики по навыкам.
 * Доступно только для ролей manager и admin.
 *
 * Query params:
 *   period — 'week' | 'month' | 'quarter' | 'year' (для trending/declining)
 *   orgUnitId — опционально, фильтр по узлу оргструктуры (включая всех потомков)
 *
 * Возвращает:
 *   topSkills — топ-3 развитых навыков (макс. средний уровень)
 *   bottomSkills — топ-3 отсталых навыков (мин. средний уровень)
 *   trendingSkills — топ-3 популярных в изучении (макс. изменений за период)
 *   decliningSkills — топ-3 непопулярных (мин. изменений за период)
 *   allSkills — все навыки для тепловой карты
 */
router.get("/skills/summary", requireAuth, requireManagerOrAdmin, async (req, res) => {
  const periodSchema = z.enum(["week", "month", "quarter", "year"]);
  const period = periodSchema.parse(req.query.period ?? "month");
  const queryOrgUnitId = req.query.orgUnitId ? z.coerce.number().int().positive().safeParse(req.query.orgUnitId).data : null;

  const daysMap = { week: 7, month: 30, quarter: 90, year: 365 };
  const days = daysMap[period];

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  // BFS по дереву для фильтрации
  let filteredTeamIds: number[] | null = null;
  if (queryOrgUnitId !== null) {
    const allUnits = await db.select().from(orgUnitsTable);
    const descendantIds = new Set<number>();
    const queue = [queryOrgUnitId];
    while (queue.length) {
      const current = queue.shift()!;
      descendantIds.add(current);
      allUnits.filter((u) => u.parentId === current).forEach((u) => queue.push(u.id));
    }
    const allActiveTeams = await db.select({ id: teamsTable.id, orgUnitId: teamsTable.orgUnitId }).from(teamsTable).where(isNull(teamsTable.deletedAt));
    filteredTeamIds = allActiveTeams
      .filter((t) => t.orgUnitId !== null && descendantIds.has(t.orgUnitId))
      .map((t) => t.id);
  }

  // Получаем все навыки
  const skills = await db.select({ id: skillsTable.id, name: skillsTable.name, category: skillsTable.category }).from(skillsTable).orderBy(skillsTable.id);

  // Получаем текущие уровни всех команд
  const allLevels = await db.select().from(teamSkillLevelsTable);
  const levels = filteredTeamIds
    ? allLevels.filter((l) => filteredTeamIds!.includes(l.teamId))
    : allLevels;

  // Получаем историю изменений за период для trending/declining
  const history = await db
    .select({
      teamId: teamSkillHistoryTable.teamId,
      skillId: teamSkillHistoryTable.skillId,
      changedAt: teamSkillHistoryTable.changedAt,
    })
    .from(teamSkillHistoryTable)
    .where(gte(teamSkillHistoryTable.changedAt, fromDate));

  // Фильтруем историю по командам из orgUnit (если задан фильтр)
  const filteredHistory = filteredTeamIds
    ? history.filter((h) => filteredTeamIds!.includes(h.teamId))
    : history;

  // Агрегация по навыкам
  const allSkills = skills.map((skill) => {
    const skillLevels = levels.filter((l) => l.skillId === skill.id);
    const avgLevel = skillLevels.length > 0
      ? skillLevels.reduce((sum, l) => sum + l.level, 0) / skillLevels.length
      : 0;
    const teamCount = skillLevels.filter((l) => l.level > 0).length;
    const levelDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 } as { 0: number; 1: number; 2: number; 3: number };

    // Считаем распределение по уровням
    const teamsForSkill = new Set<number>();
    for (const l of skillLevels) {
      teamsForSkill.add(l.teamId);
      levelDistribution[l.level as keyof typeof levelDistribution]++;
    }

    // Для навыков, где нет данных, считаем все команды как уровень 0
    const totalTeams = filteredTeamIds?.length ?? new Set(allLevels.map((l) => l.teamId)).size;
    levelDistribution[0] = totalTeams - teamsForSkill.size;

    return {
      skillId: skill.id,
      skillName: skill.name,
      category: skill.category,
      avgLevel: parseFloat(avgLevel.toFixed(2)),
      teamCount,
      levelDistribution,
    };
  });

  // Сортировка для top/bottom
  const sortedByAvg = [...allSkills].sort((a, b) => b.avgLevel - a.avgLevel);
  const topSkills = sortedByAvg.slice(0, 3);
  // Bottom skills — только с avgLevel ≤ 1.5
  const bottomSkills = sortedByAvg
    .filter((s) => s.avgLevel <= 1.5)
    .slice(-3)
    .reverse();

  // Подсчёт изменений по навыкам за период
  const changesBySkill = new Map<number, number>();
  for (const h of filteredHistory) {
    changesBySkill.set(h.skillId, (changesBySkill.get(h.skillId) ?? 0) + 1);
  }

  const skillsWithChanges = allSkills.map((s) => ({
    ...s,
    changesCount: changesBySkill.get(s.skillId) ?? 0,
  }));

  // Сортировка для trending/declining
  const sortedByChanges = [...skillsWithChanges].sort((a, b) => b.changesCount - a.changesCount);
  const trendingSkills = sortedByChanges.slice(0, 3);
  // Declining skills — только с changesCount = 0 (или минимальные)
  const decliningSkills = sortedByChanges
    .filter((s) => s.changesCount === 0)
    .slice(0, 3);

  res.json({
    period,
    days,
    topSkills,
    bottomSkills,
    trendingSkills,
    decliningSkills,
    allSkills,
  });
});

export default router;
