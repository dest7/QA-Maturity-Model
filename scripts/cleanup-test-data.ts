#!/usr/bin/env node
/**
 * Скрипт для очистки тестовых данных из БД.
 * 
 * Использование:
 *   pnpm tsx scripts/cleanup-test-data.ts
 * 
 * Что делает:
 * - Удаляет все команды, созданные тестами (по префиксу имени)
 * - Удаляет связанные записи team_skill_levels
 * - Не затрагивает seed-данные (30 команд)
 */

import { db, teamsTable, teamSkillLevelsTable } from '@workspace/db';
import { like, eq } from 'drizzle-orm';

async function cleanup() {
  console.log('🧹 Очистка тестовых данных...\n');

  // Находим все тестовые команды по префиксу имени
  const testTeamPrefixes = [
    'Test Team%',
    'Skill Test Team%',
    'Team without org%',
    'Team with org%',
    'Update Test Team%',
    'Updated Team%',
  ];

  let totalDeleted = 0;

  for (const prefix of testTeamPrefixes) {
    const testTeams = await db.select({ id: teamsTable.id }).from(teamsTable).where(
      like(teamsTable.name, prefix)
    );

    for (const team of testTeams) {
      // Удаляем связанные записи
      await db.delete(teamSkillLevelsTable).where(eq(teamSkillLevelsTable.teamId, team.id));
      // Удаляем команду
      await db.delete(teamsTable).where(eq(teamsTable.id, team.id));
      totalDeleted++;
    }
  }

  console.log(`✅ Удалено ${totalDeleted} тестовых команд\n`);
}

cleanup().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
