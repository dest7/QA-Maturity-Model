/**
 * create-snapshot.ts — скрипт для создания ежедневного снимка уровней навыков.
 * 
 * Запуск:
 *   pnpm --filter @workspace/scripts run create-snapshot
 * 
 * Cron (ежедневно в 00:00 МСК):
 *   0 0 * * * cd /path/to/QA-Maturity-Model && pnpm --filter @workspace/scripts run create-snapshot
 */

import { db, teamsTable, teamSkillLevelsTable, teamSkillSnapshotsTable } from "@workspace/db";
import { isNull, eq } from "drizzle-orm";

async function createSnapshot() {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[${new Date().toISOString()}] Starting snapshot for ${today}...`);

  try {
    // Проверяем, есть ли уже снимки за сегодня
    const existingSnapshots = await db
      .select({ id: teamSkillSnapshotsTable.id })
      .from(teamSkillSnapshotsTable)
      .where(eq(teamSkillSnapshotsTable.snapshotDate, today))
      .limit(1);

    if (existingSnapshots.length > 0) {
      console.log(`✓ Snapshot for ${today} already exists. Skipping.`);
      return;
    }

    // Получаем все активные команды
    const teams = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(isNull(teamsTable.deletedAt));

    console.log(`Found ${teams.length} active teams`);

    // Получаем текущие уровни навыков
    const allLevels = await db.select().from(teamSkillLevelsTable);
    console.log(`Loaded ${allLevels.length} skill level records`);

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
      console.log(`✓ Created ${snapshotsToInsert.length} snapshot records for ${today}`);
    } else {
      console.log("No teams found. Nothing to snapshot.");
    }
  } catch (error) {
    console.error("✗ Snapshot failed:", error);
    process.exit(1);
  }
}

createSnapshot();
