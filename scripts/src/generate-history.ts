/**
 * generate-history.ts — генерация исторических данных зрелости команд.
 *
 * Запуск:
 *   pnpm --filter @workspace/scripts run seed:history
 *
 * Параметры:
 * - Период: с 1 октября 2025 по сегодня
 * - Частота: 1 снимок в неделю (каждый понедельник)
 * - Рост: плавный от начальных уровней до текущих в БД
 *
 * Генерирует:
 * - team_skill_snapshots — еженедельные снимки
 * - team_skill_history — история изменений навыков
 *
 * Важно: последний снимок совпадает с текущим состоянием в БД
 */

import { db } from "@workspace/db";
import { teamsTable, skillsTable, teamSkillLevelsTable, teamSkillSnapshotsTable, teamSkillHistoryTable } from "@workspace/db";
import { isNull, eq } from "drizzle-orm";

// Конфигурация
const START_DATE = new Date("2025-10-01");
const END_DATE = new Date();

interface TeamSkillState {
  teamId: number;
  skillId: number;
  level: number;
}

// Генерация случайного числа в диапазоне
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Получить все понедельники между датами
function getMondays(startDate: Date, endDate: Date): Date[] {
  const mondays: Date[] = [];
  const current = new Date(startDate);
  
  // Найти первый понедельник после startDate
  while (current.getDay() !== 1) {
    current.setDate(current.getDate() + 1);
  }
  
  // Добавить все понедельники до endDate
  while (current <= endDate) {
    mondays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  return mondays;
}

// Получить текущие уровни навыков из БД
async function getCurrentLevels(): Promise<TeamSkillState[]> {
  const currentLevels = await db
    .select({
      teamId: teamSkillLevelsTable.teamId,
      skillId: teamSkillLevelsTable.skillId,
      level: teamSkillLevelsTable.level,
    })
    .from(teamSkillLevelsTable)
    .innerJoin(teamsTable, eq(teamSkillLevelsTable.teamId, teamsTable.id))
    .where(isNull(teamsTable.deletedAt));
  
  return currentLevels.map(row => ({
    teamId: row.teamId,
    skillId: row.skillId,
    level: row.level,
  }));
}

// Инициализация начальных уровней (октябрь 2025) на основе текущих
function initializeFromCurrent(currentStates: TeamSkillState[]): TeamSkillState[] {
  const initialStates: TeamSkillState[] = [];
  
  for (const state of currentStates) {
    // Начальный уровень: всегда хотя бы на 1 меньше текущего (но не ниже 0)
    // Для реалистичного роста: 50% навыков -1, 30% -2, 20% -0 (уже на целевом уровне)
    const rand = Math.random();
    let decrease = 1; // по умолчанию -1 уровень
    if (rand > 0.8) decrease = 2; // 20% навыков -2 уровня
    if (rand < 0.2) decrease = 0; // 20% навыков уже на целевом уровне
    
    const newLevel = Math.max(0, state.level - decrease);
    
    initialStates.push({
      teamId: state.teamId,
      skillId: state.skillId,
      level: newLevel,
    });
  }
  
  return initialStates;
}

// Плавное улучшение навыков к целевым уровням
function improveTowardsTarget(
  current: TeamSkillState[],
  target: TeamSkillState[],
  maxImprovements: number
): TeamSkillState[] {
  const newStates = [...current];
  let improved = 0;
  
  // Найти навыки, которые нужно улучшить
  const toImprove: number[] = [];
  for (let i = 0; i < newStates.length; i++) {
    if (newStates[i].level < target[i].level) {
      toImprove.push(i);
    }
  }
  
  // Случайно улучшить maxImprovements навыков
  while (improved < maxImprovements && toImprove.length > 0) {
    const randomIdx = randomInt(0, toImprove.length - 1);
    const stateIdx = toImprove[randomIdx];
    
    newStates[stateIdx].level += 1;
    improved++;
    
    // Если достигли целевого уровня, убрать из списка
    if (newStates[stateIdx].level >= target[stateIdx].level) {
      toImprove.splice(randomIdx, 1);
    }
  }
  
  return newStates;
}

async function generateHistory() {
  console.log(`[${new Date().toISOString()}] Starting history generation...`);
  console.log(`Period: ${START_DATE.toISOString()} to ${END_DATE.toISOString()}`);

  try {
    // Получить текущие уровни навыков из БД (целевое состояние)
    const targetStates = await getCurrentLevels();
    console.log(`Current skill levels: ${targetStates.length}`);

    if (targetStates.length === 0) {
      console.log("No skill levels found. Exiting.");
      return;
    }

    // Получить все понедельники за период
    const mondays = getMondays(START_DATE, END_DATE);
    console.log(`Generating ${mondays.length} weekly snapshots...`);

    // Подготовить массивы для данных
    const snapshotsToInsert: { teamId: number; skillId: number; level: number; snapshotDate: string }[] = [];
    const historyToInsert: { teamId: number; skillId: number; oldLevel: number | null; newLevel: number; changedAt: Date; changedByUserId: null }[] = [];

    // Инициализировать начальные уровни (октябрь 2025) на основе текущих
    let currentStates = initializeFromCurrent(targetStates);
    console.log(`Initial skill levels (Oct 2025): ${currentStates.length}`);

    // Добавить начальный снимок (1 октября 2025)
    const initialDate = START_DATE.toISOString().split("T")[0];
    for (const state of currentStates) {
      snapshotsToInsert.push({
        teamId: state.teamId,
        skillId: state.skillId,
        level: state.level,
        snapshotDate: initialDate,
      });
    }

    // Рассчитать сколько навыков нужно улучшать в неделю
    const totalWeeks = mondays.length;
    let previousStates: TeamSkillState[] = [...currentStates];

    for (let weekIdx = 0; weekIdx < mondays.length; weekIdx++) {
      const monday = mondays[weekIdx];
      const dateStr = monday.toISOString().split("T")[0];
      
      // Улучшить навыки, двигаясь к целевым уровням
      // 3-5 навыков в месяц = ~1-2 в неделю
      const improvementsThisWeek = randomInt(1, 2);
      
      // Глубокая копия для previousStates
      previousStates = currentStates.map(s => ({ ...s }));
      currentStates = improveTowardsTarget(currentStates, targetStates, improvementsThisWeek);

      // Добавить снимок
      for (const state of currentStates) {
        snapshotsToInsert.push({
          teamId: state.teamId,
          skillId: state.skillId,
          level: state.level,
          snapshotDate: dateStr,
        });
      }

      // Добавить записи в историю изменений (сравниваем по teamId+skillId)
      const prevStateMap = new Map<string, number>();
      for (const ps of previousStates) {
        prevStateMap.set(`${ps.teamId}-${ps.skillId}`, ps.level);
      }

      let changesCount = 0;
      for (const cs of currentStates) {
        const key = `${cs.teamId}-${cs.skillId}`;
        const oldLevel = prevStateMap.get(key);
        if (oldLevel !== undefined && oldLevel !== cs.level) {
          changesCount++;
          // Случайная дата в течение недели
          const changeDate = new Date(monday);
          changeDate.setDate(monday.getDate() - randomInt(0, 3));

          historyToInsert.push({
            teamId: cs.teamId,
            skillId: cs.skillId,
            oldLevel: oldLevel,
            newLevel: cs.level,
            changedAt: changeDate,  // Date объект, не строка
            changedByUserId: null,
          });
        }
      }
      
      if (changesCount > 0) {
        console.log(`  Week ${weekIdx + 1}/${mondays.length}: ${changesCount} changes`);
      }
    }

    // Добавить финальный снимок с текущими уровнями из БД (сегодня)
    const today = new Date().toISOString().split("T")[0];
    for (const state of targetStates) {
      snapshotsToInsert.push({
        teamId: state.teamId,
        skillId: state.skillId,
        level: state.level,
        snapshotDate: today,
      });
    }
    
    // Вставить данные батчами
    console.log(`Inserting ${snapshotsToInsert.length} snapshots...`);
    const BATCH_SIZE = 1000;
    
    for (let i = 0; i < snapshotsToInsert.length; i += BATCH_SIZE) {
      const batch = snapshotsToInsert.slice(i, i + BATCH_SIZE);
      await db.insert(teamSkillSnapshotsTable).values(batch);
      console.log(`  Inserted ${Math.min(i + BATCH_SIZE, snapshotsToInsert.length)}/${snapshotsToInsert.length} snapshots`);
    }
    
    console.log(`Inserting ${historyToInsert.length} history records...`);
    for (let i = 0; i < historyToInsert.length; i += BATCH_SIZE) {
      const batch = historyToInsert.slice(i, i + BATCH_SIZE);
      await db.insert(teamSkillHistoryTable).values(batch);
      console.log(`  Inserted ${Math.min(i + BATCH_SIZE, historyToInsert.length)}/${historyToInsert.length} history records`);
    }
    
    console.log(`[${new Date().toISOString()}] History generation completed successfully!`);
    console.log(`Total snapshots: ${snapshotsToInsert.length}`);
    console.log(`Total history records: ${historyToInsert.length}`);
    
  } catch (error) {
    console.error("✗ History generation failed:", error);
    process.exit(1);
  }
}

generateHistory();
