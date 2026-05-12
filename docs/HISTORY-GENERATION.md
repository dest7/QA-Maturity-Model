# Генерация исторических данных зрелости команд

## 📋 Обзор

Скрипт `generate-history.ts` автоматически генерирует исторические данные о зрелости команд для системы аналитики QA Maturity Model.

**Назначение:**
- Заполнение графиков "Динамика зрелости команд" и "Динамика зрелости навыков" историческими данными
- Создание реалистичной картины роста зрелости команд за период с октября 2025
- Генерация данных для тестирования и демонстрации возможностей системы

---

## 🚀 Быстрый старт

### Запуск генерации

```bash
# Из корня проекта (внутри Docker-контейнера)
docker exec qa-maturity-model-api-server-1 \
  pnpm --filter @workspace/scripts run seed:history
```

### Локальная разработка

```bash
# Если работаете вне контейнера
pnpm --filter @workspace/scripts run seed:history
```

---

## 📊 Что генерируется

### 1. Еженедельные снимки (`team_skill_snapshots`)

| Поле | Описание | Пример |
|------|----------|--------|
| `team_id` | ID команды | `1` |
| `skill_id` | ID навыка | `5` |
| `level` | Уровень зрелости (0-3) | `2` |
| `snapshot_date` | Дата снимка | `2025-10-06` |

**Периодичность:** каждый понедельник  
**Объём:** ~450 записей в неделю (30 команд × 15 навыков)

### 2. История изменений (`team_skill_history`)

| Поле | Описание | Пример |
|------|----------|--------|
| `team_id` | ID команды | `1` |
| `skill_id` | ID навыка | `5` |
| `old_level` | Предыдущий уровень | `1` |
| `new_level` | Новый уровень | `2` |
| `changed_at` | Дата и время изменения | `2025-10-06 14:30:00` |
| `changed_by_user_id` | ID пользователя (null для истории) | `NULL` |

**Частота изменений:** 1-2 навыка в неделю на команду  
**Объём:** ~50-70 записей за весь период

---

## ⚙️ Параметры генерации

### Период

| Параметр | Значение |
|----------|----------|
| **Дата начала** | 1 октября 2025 |
| **Дата окончания** | Текущая дата |
| **Частота снимков** | Еженедельно (понедельник) |
| **Длительность периода** | ~32 недели (октябрь 2025 — май 2026) |
| **Периоды отображения** | Неделя (7 дней), Месяц (30 дней), Квартал (90 дней), Год (365 дней) |

### Алгоритм роста зрелости

```
1. Чтение текущих уровней из БД (целевое состояние)
   ↓
2. Генерация начальных уровней (октябрь 2025):
   - 20% навыков: уже на целевом уровне
   - 50% навыков: целевой уровень - 1
   - 30% навыков: целевой уровень - 2
   ↓
3. Еженедельное улучшение (3-5 навыков в месяц):
   - Случайный выбор 1-2 навыков для улучшения
   - Повышение уровня на +1 (максимум до 3)
   - Движение к целевому состоянию
   ↓
4. Финальный снимок = текущее состояние в БД
```

### Распределение улучшений

| Навыков в месяц | Навыков в неделю | Вероятность |
|-----------------|------------------|-------------|
| 3-5 | 1-2 | 100% |

---

## 📁 Файлы

### Скрипт генерации

**Путь:** `scripts/src/generate-history.ts`

**Основные функции:**
- `getCurrentLevels()` — чтение текущих уровней из БД
- `initializeFromCurrent()` — генерация начальных уровней
- `improveTowardsTarget()` — плавное улучшение к целевым уровням
- `getMondays()` — получение всех понедельников за период

### Команды package.json

**Путь:** `scripts/package.json`

```json
{
  "scripts": {
    "seed:history": "tsx ./src/generate-history.ts",
    "generate-history": "tsx ./src/generate-history.ts"
  }
}
```

---

## 🔍 Проверка результатов

### SQL-запросы для проверки

```sql
-- Количество снимков по датам
SELECT snapshot_date, COUNT(*) as skills_count
FROM team_skill_snapshots
GROUP BY snapshot_date
ORDER BY snapshot_date;

-- История изменений навыков
SELECT 
  DATE(changed_at) as date,
  COUNT(*) as changes_count,
  SUM(CASE WHEN new_level > old_level THEN 1 ELSE 0 END) as improvements,
  SUM(CASE WHEN new_level < old_level THEN 1 ELSE 0 END) as declines
FROM team_skill_history
GROUP BY DATE(changed_at)
ORDER BY date;

-- Распределение уровней по командам (на сегодня)
SELECT 
  t.name as team_name,
  ROUND(AVG tsl.level::numeric, 2) as avg_level,
  COUNT(*) FILTER (WHERE tsl.level = 0) as level0,
  COUNT(*) FILTER (WHERE tsl.level = 1) as level1,
  COUNT(*) FILTER (WHERE tsl.level = 2) as level2,
  COUNT(*) FILTER (WHERE tsl.level = 3) as level3
FROM team_skill_levels tsl
JOIN teams t ON t.id = tsl.team_id
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name
ORDER BY avg_level DESC;
```

### Визуальная проверка

1. Откройте http://localhost:5173
2. Войдите как **edward@company.com** / **password**
3. Перейдите на страницу **Company Metrics**
4. Переключите период на **"Квартал"** или **"Месяц"**
5. Проверьте графики:
   - **Динамика зрелости команд** — stacked bar chart с распределением команд по уровням
   - **Динамика зрелости навыков** — stacked bar chart с распределением навыков по уровням

---

## 🧹 Очистка и перегенерация

### Полная очистка данных

```bash
# Очистка таблиц
docker exec qa-maturity-model-postgres-1 \
  psql -U qa_user -d qa_maturity \
  -c "TRUNCATE TABLE team_skill_snapshots, team_skill_history RESTART IDENTITY CASCADE;"

# Перегенерация
docker exec qa-maturity-model-api-server-1 \
  pnpm --filter @workspace/scripts run seed:history
```

### Частичная очистка (только история)

```bash
docker exec qa-maturity-model-postgres-1 \
  psql -U qa_user -d qa_maturity \
  -c "TRUNCATE TABLE team_skill_history RESTART IDENTITY;"
```

---

## 🛠️ Отладка

### Включение подробного логирования

Откройте `scripts/src/generate-history.ts` и раскомментируйте отладочные выводы:

```typescript
console.log(`  Skills to improve: ${toImprove.length}`);
console.log(`  Actually improved: ${improved}`);
console.log(`  Week ${weekIdx + 1}: ${changesCount} changes`);
```

### Проверка перед запуском

```bash
# Проверка текущих уровней в БД
docker exec qa-maturity-model-postgres-1 \
  psql -U qa_user -d qa_maturity \
  -c "SELECT level, COUNT(*) FROM team_skill_levels GROUP BY level ORDER BY level;"
```

**Ожидаемое распределение:**
- Level 0: ~20-30 навыков
- Level 1: ~150-200 навыков
- Level 2: ~150-180 навыков
- Level 3: ~80-100 навыков

---

## ⚠️ Важные замечания

1. **Порядок выполнения:** Скрипт должен запускаться **после** создания команд и навыков в системе
2. **Идемпотентность:** Перед повторным запуском необходимо очистить таблицы `team_skill_snapshots` и `team_skill_history`
3. **Производительность:** Генерация занимает ~5-10 секунд для 30 команд и 15 навыков
4. **Совместимость:** Последний снимок всегда совпадает с текущим состоянием в БД

---

## 📈 Пример отчёта после генерации

```
[2026-05-12T16:00:00.000Z] Starting history generation...
Period: 2025-10-01T00:00:00.000Z to 2026-05-12T16:00:00.000Z
Current skill levels: 450
Generating 32 weekly snapshots...
Initial skill levels (Oct 2025): 450
  Week 1/32: 2 changes
  Week 2/32: 1 changes
  ...
  Week 32/32: 2 changes
Inserting 15300 snapshots...
  Inserted 15300/15300 snapshots
Inserting 53 history records...
  Inserted 53/53 history records
History generation completed successfully!
Total snapshots: 15300
Total history records: 53
```

---

## 🔗 Связанные документы

- [Docker Architecture](./DOCKER-ARCHITECTURE.md) — архитектура контейнеров
- [Docker Architecture (Free)](./DOCKER-ARCHITECTURE-FREE.md) — упрощённая версия
- [QA-Maturity-Model: Гибридная архитектура истории навыков](../project/qa-maturity-hybrid-analytics.md) — описание архитектуры хранения истории

---

**Последнее обновление:** 12 мая 2026  
**Автор:** QA Maturity Model Team
