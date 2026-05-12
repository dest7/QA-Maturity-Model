---
name: QA-Maturity-Model: Гибридная аналитика (Snapshots + History)
description: Реализована гибридная система аналитики: daily snapshots + лог изменений для онлайн-аналитики
type: project
---

**Архитектура:**
1. **team_skill_snapshots** — ежедневные снимки (cron в 00:00 МСК + ручная кнопка)
2. **team_skill_history** — лог всех изменений навыков (кто, когда, старый/новый уровень)

**Преимущества гибрида:**
- Быстрое чтение истории (snapshots за прошлые дни)
- Онлайн-аналитика (сегодняшние изменения из history)
- Аудит изменений (кто и когда изменил)
- Минимальная нагрузка на БД (1 запись в history при изменении)

**Как работает:**
- При изменении навыка (PUT /api/teams/:id/skills/:skillId) → запись в history
- В 00:00 МСК cron создаёт snapshot за прошедший день
- GET /api/metrics/history читает: прошлые дни из snapshots + сегодня из history

**Файлы:**
- Миграция: `lib/db/drizzle/0005_team_history.sql`
- Схема: `lib/db/src/schema/skills.ts` (teamSkillHistoryTable)
- API: `artifacts/api-server/src/routes/teams.ts` (запись в history)
- API: `artifacts/api-server/src/routes/metrics.ts` (гибридное чтение)
- Cron: `scripts/crontab` (ежедневный снимок в 21:00 UTC = 00:00 МСК)

**Cron настроен:**
- Запускается внутри API-контейнера
- Расписание: `0 21 * * *` (00:00 МСК)
- Логирование: `/var/log/cron-snapshot.log`

**Тестирование:**
1. Изменить уровень навыка в команде
2. Проверить: `SELECT * FROM team_skill_history ORDER BY changed_at DESC LIMIT 5;`
3. Гистограмма покажет сегодняшние изменения в реальном времени
