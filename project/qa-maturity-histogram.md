---
name: QA-Maturity-Model: Гистограмма динамики зрелости
description: Реализация гистограммы с историей снимков метрик за Неделя/Месяц/Квартал
type: project
---

**Функционал:**
- Страница метрик (MetricsPage) теперь показывает гистограмму динамики зрелости команд
- Периоды: Неделя (7 дней), Месяц (30 дней), Квартал (90 дней)
- Гистограмма показывает распределение количества команд по уровням зрелости (0/1/2/3) в разрезе дат

**Архитектура:**
1. **База данных:** таблица `team_skill_snapshots` (team_id, skill_id, level, snapshot_date, UNIQUE на дату)
2. **Автоматический снимок:** cron-скрипт `pnpm run create-snapshot` (ежедневно в 00:00 МСК)
3. **Ручной снимок:** кнопка "Обновить снимок" на MetricsPage (POST /api/metrics/snapshot)
4. **API истории:** GET /api/metrics/history?period=week|month|quarter

**Почему не снимок при каждом изменении:**
- При 100 командах × 15 навыков × 50 изменений/день = 75,000 INSERT/день
- Это вызывает блокировки таблицы и заметные лаги (200-500ms вместо 50ms)
- Уникальный индекс на дату создаёт конфликты при повторных снимках
- Гибридный подход (cron + ручная кнопка) обеспечивает баланс между актуальностью и производительностью

**Файлы:**
- Миграция: `lib/db/drizzle/0004_team_snapshots.sql`
- Схема: `lib/db/src/schema/skills.ts` (teamSkillSnapshotsTable)
- API: `artifacts/api-server/src/routes/metrics.ts` (GET /history, POST /snapshot)
- Cron: `scripts/src/create-snapshot.ts`
- Компонент: `artifacts/qa-maturity/src/components/MaturityHistogram.tsx`
- Страница: `artifacts/qa-maturity/src/pages/MetricsPage.tsx` (обновлена)

**Настройка cron (на сервере):**
```bash
# Ежедневно в 00:00 МСК
0 0 * * * cd /path/to/QA-Maturity-Model && pnpm --filter @workspace/scripts run create-snapshot
```
