# QA Maturity Model Dashboard

Интерактивный дашборд для оценки и отслеживания зрелости QA-процессов команды.

## Что делает приложение

- Оценивает 15 ключевых QA-навыков по 4 уровням зрелости (0 — Initial, 1 — Developing, 2 — Defined, 3 — Optimized)
- Автоматически рассчитывает общий уровень зрелости команды: уровень N присваивается, когда не менее 85% навыков достигли уровня N
- Визуализирует профиль зрелости на радарной диаграмме
- Поддерживает несколько команд с независимыми профилями
- Позволяет создавать, редактировать, архивировать и восстанавливать команды

## Как устроен проект (монорепозиторий)

Проект использует подход **монорепозитория** — это когда несколько отдельных приложений и библиотек живут в одной папке и управляются вместе.

```
.
├── docker-compose.yml           # Postgres + API + Frontend
├── docker-compose.dev.yml       # + pgAdmin (dev)
├── Dockerfile.api               # API-сервер build
├── Dockerfile.web               # Frontend build  
├── entrypoint.sh                # DB push + seed на старте
├── pnpm-workspace.yaml          # @workspace/* пакеты
├── package.json                 # Root workspace
├── artifacts/
│   ├── api-server/              # Express + Drizzle ORM
│   │   ├── src/routes/          # teams.ts, skills.ts
│   │   └── src/lib/seed.ts      # 15 skills + 5 test teams
│   └── qa-maturity/             # React 19 + Vite + shadcn/ui
│       ├── src/App.tsx          # Routes + Layout
│       └── src/pages/           # Dashboard + Team view
├── lib/
│   ├── db/                      # Drizzle schema (skills, teams)
│   ├── api-client-react/        # TanStack Query hooks (orval)
│   └── api-spec/                # OpenAPI spec → codegen
```

## Схема базы данных

### skills (справочник навыков, 15 записей)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial PK | Уникальный ID |
| `name` | text NOT NULL | Название навыка |
| `description` | text NOT NULL | Описание |
| `category` | text NOT NULL | Категория (Strategy, Process...) |
| `level_descriptions` | text[] | Описание уровней [0,1,2,3] |
| `level_requirements` | text[] | Требования [0,1,2,3] |
| `level_artifacts` | text[] | Артефакты [0,1,2,3] |
| `level_recommendations` | text[] | Рекомендации [0,1,2,3] |

### teams (команды)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial PK | Уникальный ID |
| `name` | text NOT NULL | Название команды |
| `description` | text NOT NULL | Описание |
| `overallLevel` | integer DEFAULT 0 | Общий уровень (0-3, auto-calc) |
| `createdAt` | timestamp DEFAULT now() | Дата создания |
| `deletedAt` | timestamp NULL | NULL=активна, дата=архив |

### team_skill_levels (уровни навыков команды)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial PK | Уникальный ID |
| `teamId` | integer FK(teams.id) | Ссылка на команду |
| `skillId` | integer FK(skills.id) | Ссылка на навык |
| `level` | integer DEFAULT 0 | Уровень (0-3) |

**При создании команды**: auto-insert 15 записей `team_skill_levels` (все навыки level=0).

## Запуск через Docker Compose

### 1. Установка Docker Desktop

| ОС | Ссылка |
|----|--------|
| Windows 11 | [Docker Desktop](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe) |
| macOS Intel | [Docker.dmg](https://desktop.docker.com/mac/main/amd64/Docker.dmg) |
| macOS ARM | [Docker ARM](https://desktop.docker.com/mac/main/arm64/Docker.dmg) |

Запускаем Docker Desktop


### 2. Первый запуск

```bash
docker compose up --build -d
```

**Процесс**:
1. **Postgres** (5432): `qa_maturity` DB
2. **API** (8080): `db:push` → таблицы + `seed.ts` (15 skills, 5 teams)
3. **Frontend** (5173): Vite dev + proxy `/api` → api-server

### 3. Dev (pgAdmin)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```
pgAdmin: http://localhost:8081 (admin/admin)

### 4. Команды

```bash
docker compose logs -f          # Все логи
docker compose logs api-server  # API logs
docker compose ps              # Статус
docker compose down -v         # Stop + reset DB
```

**Windows/macOS**: на популярных ос
