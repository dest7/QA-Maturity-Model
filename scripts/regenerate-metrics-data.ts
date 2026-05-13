/**
 * Скрипт для перегенерации данных метрик (snapshot'ы и история).
 * 
 * Использование:
 *   pnpm tsx scripts/regenerate-metrics-data.ts
 * 
 * Что делает:
 * 1. Очищает таблицу team_skill_snapshots
 * 2. Очищает таблицу team_skill_history
 * 3. Генерирует snapshot'ы с 1 октября 2025 по текущий день
 * 4. Генерирует историю изменений (2 изменения на навык)
 * 
 * Snapshot'ы консистентны с текущими данными в team_skill_levels.
 */

import { db, teamSkillSnapshotsTable, teamSkillHistoryTable } from '@workspace/db';
import { generateSnapshots, generateHistory } from '../artifacts/api-server/src/lib/seed';

async function regenerateMetricsData() {
  console.log('🔄 Regenerating metrics data...\n');

  console.log('🗑️  Clearing old snapshots...');
  await db.delete(teamSkillSnapshotsTable);
  console.log('   ✓ Snapshots cleared\n');

  console.log('🗑️  Clearing old history...');
  await db.delete(teamSkillHistoryTable);
  console.log('   ✓ History cleared\n');

  console.log('📊 Generating snapshots (Oct 1, 2025 — today)...');
  await generateSnapshots();
  console.log();

  console.log('📝 Generating history (2 changes per skill)...');
  await generateHistory();
  console.log();

  console.log('✅ Metrics data regeneration complete!');
}

regenerateMetricsData().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
