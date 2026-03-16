# QA Maturity Model Dashboard

Интерактивный дашборд для оценки и отслеживания зрелости QA-процессов команды.

## Что делает приложение

- Оценивает 15 ключевых QA-навыков по 4 уровням зрелости (0 — Initial, 1 — Developing, 2 — Defined, 3 — Optimized)
- Автоматически рассчитывает общий уровень зрелости команды: уровень N присваивается, когда не менее 85% навыков достигли уровня N
- Визуализирует профиль зрелости на радарной диаграмме
- Поддерживает несколько команд с независимыми профилями
- Позволяет создавать, редактировать, архивировать и восстанавливать команды

## Архитектура проекта

```
qa-maturity-model/
├── artifacts/
│   ├── api-server/          — Express API-сервер (Node.js + TypeScript)
│   │   └── src/
│   │       ├── index.ts     — точка входа, запуск сервера + автоматический seed
│   │       ├── app.ts       — настройка Express и middleware
│   │       ├── routes/      — маршруты API (/teams, /skills, /healthz)
│   │       └── lib/seed.ts  — заполнение БД начальными данными
│   └── qa-maturity/         — React-приложение (Vite + TypeScript + Tailwind)
│       └── src/
│           ├── pages/       — страницы: TeamDashboard, DashboardView
│           └── components/  — компоненты: AppLayout, SkillCard, EditTeamModal
├── lib/
│   ├── db/                  — схема БД и подключение (Drizzle ORM + PostgreSQL)
│   ├── api-spec/            — OpenAPI-спецификация и конфигурация кодогенерации
│   ├── api-client-react/    — сгенерированные React Query хуки для API
│   └── api-zod/             — сгенерированные Zod-схемы для валидации
└── scripts/                 — вспомогательные скрипты (ручной seed)
```

Монорепозиторий управляется через **pnpm workspaces**.

---

## Локальный запуск

### Предварительные требования

| Инструмент | Минимальная версия | Где скачать |
|---|---|---|
| Node.js | 20.x LTS или выше | https://nodejs.org |
| pnpm | 9.x или выше | https://pnpm.io/installation |
| PostgreSQL | 14 или выше | https://www.postgresql.org/download |

---

### Установка на macOS

#### 1. Node.js

Рекомендуется через [Homebrew](https://brew.sh):

```bash
# Установить Homebrew (если ещё не установлен)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установить Node.js
brew install node@20

# Проверить установку
node --version   # ожидается v20.x.x или выше
npm --version
```

#### 2. pnpm

```bash
npm install -g pnpm

# Проверить установку
pnpm --version   # ожидается 9.x.x или выше
```

#### 3. PostgreSQL

```bash
# Установить PostgreSQL через Homebrew
brew install postgresql@16

# Добавить в PATH (добавьте эту строку в ~/.zshrc или ~/.bash_profile)
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Применить изменения
source ~/.zshrc

# Запустить PostgreSQL как фоновый сервис
brew services start postgresql@16

# Проверить, что сервер запущен
psql --version
```

#### 4. Создание базы данных

```bash
# Подключиться к PostgreSQL под системным пользователем
psql postgres

# Внутри psql-консоли выполнить:
CREATE DATABASE qa_maturity;
CREATE USER qa_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE qa_maturity TO qa_user;
\q
```

---

### Установка на Windows

#### 1. Node.js

1. Перейдите на https://nodejs.org и скачайте установщик LTS (версия 20.x или выше)
2. Запустите установщик и следуйте инструкциям (все настройки по умолчанию)
3. Проверьте установку в **PowerShell** или **Командной строке**:

```powershell
node --version   # ожидается v20.x.x или выше
npm --version
```

#### 2. pnpm

```powershell
npm install -g pnpm

# Проверить установку
pnpm --version   # ожидается 9.x.x или выше
```

Если возникает ошибка прав доступа, запустите PowerShell от имени администратора.

#### 3. PostgreSQL

1. Перейдите на https://www.postgresql.org/download/windows/
2. Скачайте установщик от **EDB** для версии 16.x
3. Запустите установщик:
   - Выберите компоненты: **PostgreSQL Server**, **pgAdmin 4**, **Command Line Tools**
   - Задайте пароль для суперпользователя `postgres` (запомните его!)
   - Порт: `5432` (по умолчанию)
   - Завершите установку

4. Добавьте PostgreSQL в PATH:
   - Откройте: Панель управления → Система → Дополнительные параметры системы → Переменные среды
   - В переменной `Path` добавьте: `C:\Program Files\PostgreSQL\16\bin`

#### 4. Создание базы данных на Windows

Откройте **PowerShell** или **Командную строку**:

```powershell
# Подключиться к PostgreSQL
psql -U postgres

# Внутри psql-консоли выполнить (введите пароль, заданный при установке):
CREATE DATABASE qa_maturity;
CREATE USER qa_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE qa_maturity TO qa_user;
\q
```

Альтернативно можно создать базу через **pgAdmin 4** (графический интерфейс, устанавливается вместе с PostgreSQL).

---

### Общие шаги (для обеих ОС)

#### 5. Клонирование репозитория

```bash
git clone <URL репозитория>
cd qa-maturity-model
```

#### 6. Создание файла переменных окружения

В корне проекта создайте файл `.env`:

**macOS / Linux:**
```bash
cp .env.example .env   # если пример есть
# или создайте вручную:
touch .env
```

**Windows (PowerShell):**
```powershell
New-Item .env -ItemType File
```

Заполните `.env` следующим содержимым (замените значения на свои):

```env
# Строка подключения к PostgreSQL
# Формат: postgresql://пользователь:пароль@хост:порт/имя_базы
DATABASE_URL=postgresql://qa_user:your_password@localhost:5432/qa_maturity

# Порт API-сервера (можно оставить 8080)
PORT=8080
```

> **Важно:** файл `.env` содержит секреты и **не должен** попадать в git-репозиторий.
> Убедитесь, что `.env` указан в `.gitignore`.

#### 7. Установка зависимостей

```bash
pnpm install
```

Это установит зависимости для всех пакетов монорепозитория одной командой.

#### 8. Применение схемы базы данных

```bash
pnpm --filter @workspace/db run db:push
```

Эта команда создаёт таблицы в базе данных согласно схеме Drizzle ORM:
- `skills` — справочник QA-навыков
- `teams` — команды
- `team_skill_levels` — уровни навыков каждой команды

#### 9. Заполнение базы тестовыми данными (опционально)

Начальные данные (15 навыков и 5 тестовых команд) загружаются **автоматически при первом запуске** API-сервера, если база пустая.

Если нужно запустить seed вручную (например, для сброса данных):

```bash
pnpm --filter @workspace/scripts run seed
```

#### 10. Запуск приложения

Нужно запустить два сервиса в **отдельных терминалах**:

**Терминал 1 — API-сервер:**
```bash
pnpm --filter @workspace/api-server run dev
```
Сервер запустится на `http://localhost:8080`. При первом запуске автоматически загрузит тестовые данные в базу.

**Терминал 2 — Фронтенд (React):**
```bash
pnpm --filter @workspace/qa-maturity run dev
```
Приложение откроется на `http://localhost:5173`.

#### 11. Проверка работоспособности

Откройте в браузере:
- Фронтенд: `http://localhost:5173`
- Health-check API: `http://localhost:8080/api/healthz` — должен вернуть `{"status":"ok"}`
- Список команд: `http://localhost:8080/api/teams`

---

## Полезные команды

```bash
# Установить все зависимости
pnpm install

# Применить схему БД (создать/обновить таблицы)
pnpm --filter @workspace/db run db:push

# Сгенерировать SQL-файл миграции (вместо db:push)
pnpm --filter @workspace/db run db:generate

# Применить миграции из файлов
pnpm --filter @workspace/db run db:migrate

# Открыть визуальный редактор базы данных (Drizzle Studio)
pnpm --filter @workspace/db run db:studio

# Запустить seed вручную
pnpm --filter @workspace/scripts run seed

# Перегенерировать API-клиент и Zod-схемы из openapi.yaml
pnpm --filter @workspace/api-spec run generate

# Проверить типы по всему монорепозиторию
pnpm typecheck
```

---

## Частые проблемы

### "DATABASE_URL must be set"

Убедитесь, что файл `.env` создан в корне проекта и содержит переменную `DATABASE_URL`.
При запуске через `pnpm ... run dev` файл `.env` подхватывается автоматически.

### "Connection refused" при подключении к PostgreSQL

- **macOS:** проверьте, что служба запущена: `brew services list | grep postgresql`
- **Windows:** проверьте в **Службах Windows** (services.msc), что служба `postgresql-x64-16` запущена

### Порт уже занят

Если порт 8080 или 5173 занят другим процессом, измените значение в `.env`:
```env
PORT=3001
```
Или завершите процесс, занимающий порт:
- macOS/Linux: `lsof -i :8080` → `kill -9 <PID>`
- Windows: `netstat -ano | findstr :8080` → `taskkill /PID <PID> /F`

### pnpm: команда не найдена

На Windows после установки pnpm может потребоваться перезапуск терминала или перезагрузка.
Если проблема сохраняется, добавьте папку npm-globals в PATH вручную.
