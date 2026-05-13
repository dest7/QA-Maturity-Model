/**
 * Скрипт перегенерации исторических данных для метрик.
 * 
 * Удаляет все snapshot'ы и историю, затем создаёт новые данные
 * с 1 октября 2025 по сегодняшний день.
 * 
 * Использование:
 *   pnpm --filter @workspace/api-server run tsx scripts/regenerate-history.ts
 */

import { db, teamsTable, skillsTable, teamSkillLevelsTable, teamSkillSnapshotsTable, teamSkillHistoryTable, usersTable } from "@workspace/db";
import { isNull, eq } from "drizzle-orm";

async function regenerateHistory() {
  console.log("🔄 Перегенерация исторических данных...\n");

  // Очищаем старые данные
  console.log("🗑️  Очистка старых snapshot'ов...");
  await db.delete(teamSkillSnapshotsTable);
  console.log("   ✓ Snapshot'ы удалены");

  console.log("🗑️  Очистка старой истории...");
  await db.delete(teamSkillHistoryTable);
  console.log("   ✓ История удалена\n");

  // Получаем данные
  console.log("📊 Получение данных...");
  const teams = await db.select().from(teamsTable).where(isNull(teamsTable.deletedAt));
  const skills = await db.select().from(skillsTable);
  const users = await db.select().from(usersTable);
  const currentLevels = await db.select().from(teamSkillLevelsTable);

  console.log(`   ✓ Команд: ${teams.length}`);
  console.log(`   ✓ Навыков: ${skills.length}`);
  console.log(`   ✓ Пользователей: ${users.length}`);
  console.log(`   ✓ Текущих уровней: ${currentLevels.length}\n`);

  // Создаём карту текущих уровней
  const levelsMap = new Map<string, number>();
  for (const level of currentLevels) {
    levelsMap.set(`${level.teamId}-${level.skillId}`, level.level);
  }

  // Генерируем snapshot'ы с 1 октября 2025 по сегодня
  console.log("📅 Генерация snapshot'ов (1 октября 2025 — сегодня)...");
  const startDate = new Date("2025-10-01");
  const today = new Date();
  const totalDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const snapshots = [];
  const snapshotDate = new Date(startDate);

  while (snapshotDate <= today) {
    const daysFromStart = Math.floor((snapshotDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const progress = Math.min(1, daysFromStart / totalDays); // 0.0 → 1.0

    for (const team of teams) {
      for (const skill of skills) {
        const currentLevel = levelsMap.get(`${team.id}-${skill.id}`) ?? 0;
        
        // Прогрессивный рост: к текущей дате уровень должен быть currentLevel
        // В начале периода уровень ниже, постепенно растёт
        const historicalLevel = Math.max(0, Math.floor(currentLevel * progress));

        snapshots.push({
          teamId: team.id,
          skillId: skill.id,
          level: historicalLevel,
          snapshotDate: snapshotDate.toISOString().split("T")[0],
        });
      }
    }

    snapshotDate.setDate(snapshotDate.getDate() + 1);
  }

  // Batch insert по 1000 записей
  const batchSize = 1000;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    await db.insert(teamSkillSnapshotsTable).values(batch);
  }

  console.log(`   ✓ Создано ${snapshots.length} snapshot'ов (${totalDays + 1} дней × ${teams.length} команд × ${skills.length} навыков)\n`);

  // Генерируем историю изменений (2-3 изменения на навык)
  console.log("📝 Генерация истории изменений...");
  const history = [];
  const periodStart = new Date("2025-10-01");

  for (const team of teams) {
    for (const skill of skills) {
      // Генерируем 2-3 изменения на каждый навык
      const numChanges = 2 + Math.floor(Math.random() * 2); // 2 или 3
      
      for (let changeIdx = 0; changeIdx < numChanges; changeIdx++) {
        // Распределяем изменения по периоду
        const changeDate = new Date(periodStart);
        const daysOffset = Math.floor((changeIdx + 1) * (totalDays / (numChanges + 1)));
        changeDate.setDate(changeDate.getDate() + daysOffset + Math.floor(Math.random() * 10));

        const oldLevel = changeIdx === 0 ? 0 : Math.min(2, changeIdx);
        const newLevel = Math.min(3, oldLevel + 1);
        const userId = users[Math.floor(Math.random() * users.length)]?.id ?? null;

        history.push({
          teamId: team.id,
          skillId: skill.id,
          oldLevel: changeIdx === 0 ? null : oldLevel,
          newLevel,
          changedAt: changeDate,
          changedByUserId: userId,
        });
      }
    }
  }

  await db.insert(teamSkillHistoryTable).values(history);
  console.log(`   ✓ Создано ${history.length} записей истории\n`);

  console.log("✅ Перегенерация завершена!");
  console.log(`\n📊 Итого:`);
  console.log(`   - Snapshot'ы: ${snapshots.length} записей`);
  console.log(`   - История: ${history.length} записей`);
  console.log(`   - Период: 2025-10-01 — ${today.toISOString().split("T")[0]}`);
}

// Запуск
regenerateHistory()
  .then(() => {
    console.log("\n✨ Готово!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Ошибка:", error);
    process.exit(1);
  });
