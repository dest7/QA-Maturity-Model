# QA Maturity Model Dashboard

Интерактивный дашборд для оценки и отслеживания зрелости QA-процессов команды.

## Что делает приложение

- Оценивает 15 ключевых QA-навыков по 4 уровням зрелости (0 — Initial, 1 — Developing, 2 — Defined, 3 — Optimized)
- Автоматически рассчитывает общий уровень зрелости команды: уровень N присваивается, когда не менее 85% навыков достигли уровня N
- Визуализирует профиль зрелости на радарной диаграмме
- Поддерживает несколько команд с независимыми профилями
- Позволяет создавать, редактировать, архивировать и восстанавливать команды

---

## Как устроен проект (монорепозиторий)

Проект использует подход **монорепозитория** — это когда несколько отдельных приложений и библиотек живут в одной папке и управляются вместе.

```
qa-maturity-model/
├── artifacts/
│   ├── api-server/      — Express API-сервер (Node.js + TypeScript)
│   └── qa-maturity/     — React-приложение (Vite + TypeScript + Tailwind)
├── lib/
│   ├── db/              — схема БД и подключение (Drizzle ORM + PostgreSQL)
│   ├── api-spec/        — OpenAPI-спецификация и кодогенерация
│   ├── api-client-react/— сгенерированные React Query хуки для API
│   └── api-zod/         — сгенерированные Zod-схемы для валидации
├── scripts/             — вспомогательные скрипты (ручной seed)
└── pnpm-workspace.yaml  — описание структуры монорепозитория
```

### Что такое `pnpm-workspace.yaml`

Этот файл говорит pnpm, **какие папки являются пакетами** внутри монорепозитория. Без него pnpm видел бы только корневой `package.json`. Благодаря этому файлу команды типа `pnpm install` устанавливают зависимости сразу для всех пакетов (api-server, qa-maturity, db и т.д.) одной командой.

Также в этом файле задан раздел `catalog:` — список версий зависимостей, которые **используются одинаково во всех пакетах** (React, TypeScript, Vite и др.). Это гарантирует, что везде установлена одна и та же версия библиотеки.

### Что такое `@workspace` и `--filter`

Каждый пакет в монорепозитории имеет имя, прописанное в его `package.json`. Например:
- `lib/db/package.json` → `"name": "@workspace/db"`
- `artifacts/api-server/package.json` → `"name": "@workspace/api-server"`
- `artifacts/qa-maturity/package.json` → `"name": "@workspace/qa-maturity"`

`@workspace` — это просто **префикс-пространство имён** (namespace), принятый в этом проекте. Он не имеет технического смысла сам по себе — это просто соглашение об именовании.

Флаг `--filter` указывает pnpm, **в каком именно пакете** нужно выполнить команду. Без него команда выполнялась бы во всех пакетах сразу (или в корне), что вызвало бы ошибку, потому что скрипт `db:push` есть только в пакете `@workspace/db`.

Пример: команда
```bash
pnpm --filter @workspace/db run db:push
```
означает: «зайди в пакет с именем `@workspace/db` (то есть в папку `lib/db/`) и запусти там скрипт `db:push`».

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

Эта команда устанавливает зависимости **для всех пакетов** монорепозитория сразу (api-server, qa-maturity, db, scripts и т.д.). Запускается один раз из корня проекта.

#### 8. Создание таблиц в базе данных

```bash
pnpm --filter @workspace/db run db:push
```

Расшифровка команды:
- `pnpm` — менеджер пакетов
- `--filter @workspace/db` — выполнить только в пакете `lib/db/` (его имя в package.json — `@workspace/db`)
- `run db:push` — запустить скрипт `db:push`, который вызывает `drizzle-kit push`

Эта команда сравнивает вашу TypeScript-схему (`lib/db/src/schema/`) с реальной базой данных и создаёт недостающие таблицы:
- `skills` — справочник QA-навыков (15 записей)
- `teams` — команды
- `team_skill_levels` — уровни навыков каждой команды

> **Примечание:** `db:push` применяет схему напрямую, без создания файлов миграций — это удобно для разработки. Для production-окружений с историей изменений используют `db:generate` + `db:migrate`.

#### 9. Заполнение базы тестовыми данными

Начальные данные (15 навыков и 5 тестовых команд) загружаются **автоматически при первом запуске** API-сервера, если база пустая. Дополнительных действий не требуется.

Если нужно запустить seed вручную (например, для сброса данных в пустую базу):

```bash
pnpm --filter @workspace/scripts run seed
```

#### 10. Запуск приложения

Нужно запустить два сервиса в **двух отдельных терминалах**:

**Терминал 1 — API-сервер:**
```bash
pnpm --filter @workspace/api-server run dev
```
Сервер запустится на `http://localhost:8080`.
При первом запуске в логах появится: `Empty database detected — seeding initial data...` — это нормально, данные загружаются автоматически.

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

## Справочник команд

```bash
# Установить все зависимости (выполняется из корня проекта)
pnpm install

# Применить схему БД к базе данных (создать/обновить таблицы без файлов миграций)
pnpm --filter @workspace/db run db:push

# Сгенерировать SQL-файл миграции на основе изменений в схеме
pnpm --filter @workspace/db run db:generate

# Применить сгенерированные миграции к базе данных
pnpm --filter @workspace/db run db:migrate

# Открыть визуальный редактор базы данных (Drizzle Studio) в браузере
pnpm --filter @workspace/db run db:studio

# Запустить seed (заполнение тестовыми данными) вручную
pnpm --filter @workspace/scripts run seed

# Перегенерировать API-клиент и Zod-схемы из openapi.yaml
pnpm --filter @workspace/api-spec run generate

# Проверить TypeScript-типы по всему монорепозиторию
pnpm typecheck
```

---

## Частые проблемы

### ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT

**Причина:** скрипт с таким именем отсутствует в `package.json` указанного пакета.

**Решение:** убедитесь, что команда написана точно так, как в этом README. Для проверки доступных скриптов в конкретном пакете выполните:
```bash
# Список скриптов пакета db
cat lib/db/package.json
```

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
