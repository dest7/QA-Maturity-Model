# QA Maturity Model Dashboard

Интерактивный дашборд для оценки и отслеживания зрелости QA-процессов команды.

## Что делает приложение

- Оценивает 15 ключевых QA-навыков по 4 уровням зрелости (0 — Initial, 1 — Developing, 2 — Defined, 3 — Optimized)
- Автоматически рассчитывает общий уровень зрелости команды: уровень N присваивается, когда не менее 85% навыков достигли уровня N
- Визуализирует профиль зрелости на радарной диаграмме
- Поддерживает несколько команд с независимыми профилями
- Позволяет создавать, редактировать, архивировать и восстанавливать команды
- Система ролей: viewer, contributor, reviewer, manager, admin
- Страница метрик компании (Metrics Page) для manager и admin

## Как устроен проект (монорепозиторий)

Проект использует подход **монорепозитория** с pnpm workspaces — несколько отдельных приложений и библиотек живут в одной папке и управляются вместе.

```
.
├── docker-compose.yml           # Postgres + API + Frontend
├── docker-compose.dev.yml       # + pgAdmin (dev)
├── Dockerfile.api               # API-сервер build
├── Dockerfile.web               # Frontend build
├── pnpm-workspace.yaml          # @workspace/* пакеты
├── package.json                 # Root workspace
├── pnpm-lock.yaml               # Зафиксированные версии зависимостей
├── artifacts/
│   ├── api-server/              # Express + Drizzle ORM
│   │   ├── src/
│   │   │   ├── routes/          # teams.ts, skills.ts, auth.ts, metrics.ts, users.ts
│   │   │   ├── middlewares/     # Auth middleware
│   │   │   ├── lib/seed.ts      # 15 skills + 5 test teams + users
│   │   │   ├── app.ts           # Express app
│   │   │   └── index.ts         # Server entry (migrations + seed)
│   ├── qa-maturity/             # React 19 + Vite + shadcn/ui
│   │   └── src/
│   │       ├── components/      # AppLayout, SkillCard, MaturityRadar, modals
│   │       ├── pages/           # DashboardView, TeamDashboard, MetricsPage, LoginPage
│   │       ├── contexts/        # AuthContext
│   │       └── hooks/           # use-toast, etc.
│   └── mockup-sandbox/          # Песочница для прототипов
├── lib/
│   ├── db/                      # Drizzle schema и миграции
│   │   ├── src/schema/          # skills.ts, users.ts, index.ts
│   │   ├── drizzle/             # SQL миграции
│   │   └── migrations/          # Инициализационные миграции
│   ├── api-spec/                # OpenAPI spec → codegen
│   ├── api-zod/                 # Zod схемы для API
│   └── api-client-react/        # TanStack Query hooks (orval)
└── scripts/                     # Вспомогательные скрипты
```

## Схема базы данных

### skills (справочник навыков, 15 записей)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial PK | Уникальный ID |
| `name` | text NOT NULL | Название навыка |
| `description` | text NOT NULL | Описание |
| `category` | text NOT NULL | Категория (Test Strategy, Test Design, Test Automation, Quality Metrics, Process) |
| `level_descriptions` | text[] | Описание уровней [0,1,2,3] |
| `level_requirements` | text[] | Требования к уровню [0,1,2,3] |
| `level_artifacts` | text[] | Артефакты для уровня [0,1,2,3] |
| `level_recommendations` | text[] | Рекомендации по переходу [0,1,2,3] |

### teams (команды)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial PK | Уникальный ID |
| `name` | text NOT NULL | Название команды |
| `description` | text NOT NULL | Описание |
| `overall_level` | integer DEFAULT 0 | Общий уровень (0-3, auto-calc) |
| `assessment_status` | text DEFAULT 'planned' | Статус: planned, in_progress, completed, on_hold |
| `last_assessed_at` | timestamp NULL | Дата последней оценки |
| `created_at` | timestamp DEFAULT now() | Дата создания |
| `deleted_at` | timestamp NULL | NULL=активна, дата=архив |

### team_skill_levels (уровни навыков команды)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial PK | Уникальный ID |
| `team_id` | integer FK(teams.id) | Ссылка на команду (CASCADE delete) |
| `skill_id` | integer FK(skills.id) | Ссылка на навык (CASCADE delete) |
| `level` | integer DEFAULT 0 | Уровень навыка (0-3) |

**При создании команды**: auto-insert 15 записей `team_skill_levels` (все навыки level=0).

### team_skill_artifacts (артефакты команды)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial PK | Уникальный ID |
| `team_id` | integer FK(teams.id) | Ссылка на команду (CASCADE delete) |
| `skill_id` | integer FK(skills.id) | Ссылка на навык (CASCADE delete) |
| `name` | text NOT NULL | Название артефакта |
| `link` | text NULL | Ссылка на артефакт |
| `note` | text NULL | Заметка |
| `created_at` | timestamp DEFAULT now() | Дата создания |

### users (пользователи системы)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | serial PK | Уникальный ID |
| `name` | text NOT NULL | Имя пользователя |
| `email` | text NOT NULL UNIQUE | Email (логин) |
| `password_hash` | text NOT NULL | Хеш пароля (bcrypt) |
| `role` | text DEFAULT 'viewer' | Роль: viewer, contributor, reviewer, manager, admin |
| `assigned_team_ids` | integer[] DEFAULT [] | Назначенные команды (для contributor/manager) |
| `is_active` | boolean DEFAULT true | Активен ли пользователь |
| `created_at` | timestamp DEFAULT now() | Дата создания |

**Роли:**
- **viewer** — только просмотр
- **contributor** — просмотр + добавление артефактов (только свои команды)
- **reviewer** — просмотр + изменение уровней + артефакты + статус оценки
- **manager** — reviewer + страница метрик компании (только свои команды)
- **admin** — полный доступ, включая управление пользователями и командами

## Запуск через Docker Compose

### 1. Установка Docker Desktop

| ОС | Ссылка |
|----|--------|
| Windows 11 | [Docker Desktop](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe) |
| macOS Intel | [Docker.dmg](https://desktop.docker.com/mac/main/amd64/Docker.dmg) |
| macOS ARM (M1/M2/M3) | [Docker ARM](https://desktop.docker.com/mac/main/arm64/Docker.dmg) |
| Linux | [Docker Engine](https://docs.docker.com/engine/install/) |

Запустите Docker Desktop перед запуском команд.

### 2. Первый запуск

```bash
docker compose up --build -d
```

**Процесс запуска:**
1. **Postgres** (порт 5432): создаёт БД `qa_maturity`
2. **API Server** (порт 8080): применяет миграции Drizzle, выполняет seed (15 навыков, 5 тестовых команд, 5 пользователей)
3. **Frontend** (порт 5173): Vite dev server с proxy `/api` → api-server

**Проверка:**
```bash
docker compose ps
docker compose logs -f api-server
```

Откройте http://localhost:5173 в браузере.

### 3. Dev-режим (с pgAdmin)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

pgAdmin: http://localhost:8081 (логин: admin, пароль: admin)

### 4. Основные команды

```bash
# Просмотр логов
docker compose logs -f          # Все логи
docker compose logs api-server  # Только API
docker compose logs qa-maturity # Только frontend

# Статус контейнеров
docker compose ps

# Пересборка и перезапуск
docker compose up --build -d

# Полная очистка (БД удаляется!)
docker compose down -v

# Остановить без удаления БД
docker compose down
```

### 5. Тестовые учётные данные

После первого запуска доступны пользователи:

| Имя | Email (логин) | Роль |
|-----|---------------|------|
| Edward | edward@company.com | admin |
| Anna | anna@company.com | viewer |
| Boris | boris@company.com | contributor |
| Clara | clara@company.com | reviewer |
| Igor | igor@company.com | manager |

## Локальная разработка (без Docker)

### Требования

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+

### Установка

```bash
pnpm install

# Запуск БД (локально)
# Создайте БД qa_maturity и пользователя qa_user

# Переменные окружения
export DATABASE_URL="postgresql://qa_user:postgres@localhost:5432/qa_maturity?schema=public"

# Применение миграций
pnpm --filter @workspace/db run db:push

# Запуск API
pnpm --filter @workspace/api-server run dev

# Запуск frontend (в другом терминале)
pnpm --filter @workspace/qa-maturity run dev
```

## Структура API

API доступно на http://localhost:8080

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/health` | GET | Проверка здоровья API |
| `/api/auth/login` | POST | Логин пользователя |
| `/api/auth/logout` | POST | Выход |
| `/api/auth/me` | GET | Текущий пользователь |
| `/api/skills` | GET | Список всех навыков |
| `/api/teams` | GET | Список команд |
| `/api/teams/:id` | GET | Детали команды |
| `/api/teams/:id/skills` | PUT | Обновить уровни навыков |
| `/api/teams/:id/artifacts` | POST | Добавить артефакт |
| `/api/metrics` | GET | Метрики компании (manager/admin) |
| `/api/users` | GET | Список пользователей (admin) |

## Технологии

**Frontend:**
- React 19 + TypeScript
- Vite 7
- shadcn/ui + Tailwind CSS 4
- TanStack Query (React Query)
- Wouter (роутинг)
- Recharts (радарная диаграмма)
- Framer Motion (анимации)

**Backend:**
- Node.js 20 + Express 5
- Drizzle ORM (PostgreSQL)
- Zod (валидация)
- bcryptjs (хеширование паролей)
- express-session (сессии)

**Инфраструктура:**
- PostgreSQL 16
- Docker Compose
- pnpm workspaces (монорепозиторий)

## Вклад в проект

```bash
# Создать ветку
git checkout -b feature/my-feature

# Внести изменения, закоммитить
git commit -m "feat: описание изменений"

# Отправить
git push origin feature/my-feature
```

## Лицензия

MIT
