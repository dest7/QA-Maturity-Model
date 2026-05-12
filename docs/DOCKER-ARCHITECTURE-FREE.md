# Docker Architecture — Fully Free Self-Hosted (Russia-Friendly)

## Обзор архитектуры

**Полностью бесплатное решение** — все сервисы в Docker-контейнерах на одном хосте. Никаких managed-сервисов и платных подписок.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCKER HOST (VM / Сервер в РФ)                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Public Internet (вход)                         │   │
│  │                    HTTP :80 / HTTPS :443                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Traefik (Reverse Proxy)                      │   │
│  │                        • SSL (Let's Encrypt)                        │   │
│  │                        • Маршрутизация                              │   │
│  │                        • Rate Limiting                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                              │                    │
│         │ /api/*                                       │ /*                 │
│         ▼                                              ▼                    │
│  ┌──────────────────┐                          ┌──────────────────┐        │
│  │   API Server     │                          │    Frontend      │        │
│  │   (Node.js)      │                          │    (Nginx)       │        │
│  │   :8080          │                          │    :80           │        │
│  │   × 2 реплики    │                          │                  │        │
│  └────────┬─────────┘                          └──────────────────┘        │
│           │                                                                 │
│           │                                                                 │
│  ┌────────▼─────────┐                          ┌──────────────────┐        │
│  │     Redis        │                          │     MinIO        │        │
│  │   (Sessions)     │                          │   (S3-compatible)│        │
│  │   :6379          │                          │   :9000 (API)    │        │
│  │                  │                          │   :9001 (Console)│        │
│  └──────────────────┘                          └──────────────────┘        │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL 16 (Database)                       │   │
│  │                      :5432 (внутри сети)                            │   │
│  │                      • Volume: pgdata                               │   │
│  │                      • Бэкапы: pg_dump → хост                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Volumes (данные на хосте)                   │   │
│  │  pgdata  │  redis-data  │  minio-data  │  traefik-certs            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Контейнеры (7 штук)

### Сводная таблица

| Контейнер | Образ | Порт | RAM (min) | CPU (min) | Zone ответственности |
|-----------|-------|------|-----------|-----------|---------------------|
| **Traefik** | `traefik:v2.10` | 80, 443 | 64 MB | 0.1 | Reverse proxy, SSL |
| **Frontend** | `nginx:alpine` | 80 (внутр.) | 32 MB | 0.1 | Статика React |
| **API Server** | кастомный (Node.js 20) | 8080 (внутр.) | 256 MB × 2 | 0.3 × 2 | Бизнес-логика |
| **Redis** | `redis:7-alpine` | 6379 (внутр.) | 128 MB | 0.1 | Сессии, кэш |
| **MinIO** | `minio/minio` | 9000, 9001 (внутр.) | 512 MB | 0.3 | Файлы (S3-compatible) |
| **PostgreSQL** | `postgres:16-alpine` | 5432 (внутр.) | 512 MB | 0.5 | База данных |
| **Итого** | | | **~1.5 GB** | **~1.4 CPU** | |

---

## 1. Traefik (Reverse Proxy + SSL)

| Параметр | Значение |
|----------|----------|
| **Образ** | `traefik:v2.10` |
| **Порты** | `80:80`, `443:443` (наружу) |
| **RAM** | 64 MB |
| **Zone** | Входная точка, SSL termination, маршрутизация |

**Конфигурация:**
```yaml
traefik:
  image: traefik:v2.10
  command:
    - "--providers.docker=true"
    - "--providers.docker.exposedbydefault=false"
    - "--entrypoints.web.address=:80"
    - "--entrypoints.websecure.address=:443"
    - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
    - "--certificatesresolvers.letsencrypt.acme.email=your@email.com"
    - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - traefik-certs:/letsencrypt
  networks:
    - qa-network
  restart: unless-stopped
```

**SSL через Let's Encrypt:**
- ✅ Бесплатно
- ✅ Автоматическое обновление (90 дней)
- ✅ Работает в РФ без ограничений

---

## 2. Frontend (Nginx + React)

| Параметр | Значение |
|----------|----------|
| **Образ** | `nginx:alpine` (кастомная сборка) |
| **Порт** | `80` (внутри сети) |
| **RAM** | 32 MB |
| **Zone** | Раздача статики (React bundle) |

**Dockerfile:**
```dockerfile
# Dockerfile.web.prod
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/qa-maturity/package.json ./artifacts/qa-maturity/
RUN pnpm install --frozen-lockfile
COPY artifacts/qa-maturity/ ./artifacts/qa-maturity/
RUN pnpm --filter @workspace/qa-maturity run build

FROM nginx:alpine
COPY --from=builder /app/artifacts/qa-maturity/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 3. API Server (Node.js + Express)

| Параметр | Значение |
|----------|----------|
| **Образ** | кастомный (Node.js 20 Alpine) |
| **Порт** | `8080` (внутри сети) |
| **RAM** | 256 MB × 2 реплики |
| **Zone** | API endpoints, бизнес-логика, аутентификация |

**Dockerfile:**
```dockerfile
# Dockerfile.api.prod
FROM node:20-alpine
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/
RUN pnpm install --frozen-lockfile --prod
COPY lib/db/ ./lib/db/
COPY artifacts/api-server/ ./artifacts/api-server/
RUN pnpm --filter @workspace/db run build
RUN pnpm --filter @workspace/api-server run build
EXPOSE 8080
CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
```

**Масштабирование:**
```yaml
api-server:
  deploy:
    replicas: 2  # Можно увеличить до 4-5
```

---

## 4. Redis (Sessions + Cache)

| Параметр | Значение |
|----------|----------|
| **Образ** | `redis:7-alpine` |
| **Порт** | `6379` (внутри сети) |
| **RAM** | 128 MB (настраивается) |
| **Zone** | Сессии пользователей, кэш частых запросов |

**Конфигурация:**
```yaml
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --appendonly yes
    --maxmemory 128mb
    --maxmemory-policy allkeys-lru
  volumes:
    - redis-data:/data
  networks:
    - qa-network
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**Почему Alpine:**
- ✅ Размер ~30 MB (vs ~100 MB у Debian)
- ✅ Меньше поверхность атаки
- ✅ Быстрее старт

---

## 5. MinIO (S3-compatible Object Storage)

| Параметр | Значение |
|----------|----------|
| **Образ** | `minio/minio:latest` |
| **Порты** | `9000` (API), `9001` (Console) — внутри сети |
| **RAM** | 512 MB |
| **Zone** | Хранение артефактов (файлы, скриншоты, отчёты) |

**Почему MinIO:**
- ✅ **S3-compatible API** — код не меняется
- ✅ **Бесплатно** (AGPL v3, open source)
- ✅ **Работает в РФ** — нет санкций
- ✅ **Self-hosted** — полный контроль
- ✅ **Web Console** — удобно смотреть файлы

**Конфигурация:**
```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  volumes:
    - minio-data:/data
  environment:
    MINIO_ROOT_USER: qa-admin
    MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}  # от 8 символов
  networks:
    - qa-network
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3
```

**Подключение из кода (AWS SDK):**
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'us-east-1',  // не важно для MinIO
  endpoint: 'http://minio:9000',  // внутри Docker сети
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER,
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD
  },
  forcePathStyle: true  // обязательно для MinIO!
});
```

**Web Console:**
- URL: `http://localhost:9001` (или через Traefik `https://minio.qa-maturity.example.com`)
- Логин: `qa-admin`
- Пароль: из `MINIO_PASSWORD`

---

## 6. PostgreSQL 16 (Database)

| Параметр | Значение |
|----------|----------|
| **Образ** | `postgres:16-alpine` |
| **Порт** | `5432` (внутри сети) |
| **RAM** | 512 MB (минимум) |
| **Zone** | Все данные: пользователи, команды, навыки, уровни |

**Конфигурация:**
```yaml
postgres:
  image: postgres:16-alpine
  volumes:
    - pgdata:/var/lib/postgresql/data
    - ./backups:/backups  # для pg_dump
  environment:
    POSTGRES_DB: qa_maturity
    POSTGRES_USER: qa_user
    POSTGRES_PASSWORD: ${DB_PASSWORD}
  networks:
    - qa-network
  restart: unless-stopped
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U qa_user -d qa_maturity"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**Таблицы (5 штук):**
1. `skills` — справочник QA-навыков (15 записей)
2. `teams` — команды
3. `team_skill_levels` — уровни навыков команд
4. `team_skill_artifacts` — артефакты (ссылки на MinIO)
5. `users` — пользователи с ролями

---

## Полный docker-compose.prod.yml

```yaml
version: '3.8'

services:
  # ─────────────────────────────────────────────────────────────────────────
  # Traefik — Reverse Proxy + SSL
  # ─────────────────────────────────────────────────────────────────────────
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${TRAEFIK_ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt
    networks:
      - qa-network
    restart: unless-stopped

  # ─────────────────────────────────────────────────────────────────────────
  # Frontend — React (Nginx)
  # ─────────────────────────────────────────────────────────────────────────
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.web.prod
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
    networks:
      - qa-network
    depends_on:
      - api-server
    restart: unless-stopped

  # ─────────────────────────────────────────────────────────────────────────
  # API Server — Node.js (горизонтальное масштабирование)
  # ─────────────────────────────────────────────────────────────────────────
  api-server:
    build:
      context: .
      dockerfile: Dockerfile.api.prod
    environment:
      DATABASE_URL: postgresql://qa_user:${DB_PASSWORD}@postgres:5432/qa_maturity?schema=public
      REDIS_URL: redis://redis:6379
      SESSION_SECRET: ${SESSION_SECRET}
      NODE_ENV: production
      MINIO_ENDPOINT: http://minio:9000
      MINIO_BUCKET: qa-maturity-artifacts
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
    labels:
      - "traefik.enable=true"
      - "traefik.http.services.api-server.loadbalancer.server.port=8080"
      - "traefik.http.routers.api.rule=Host(`${DOMAIN}`) && PathPrefix(`/api/`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
    networks:
      - qa-network
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  # ─────────────────────────────────────────────────────────────────────────
  # Redis — Sessions + Cache
  # ─────────────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    networks:
      - qa-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─────────────────────────────────────────────────────────────────────────
  # MinIO — Object Storage (S3-compatible)
  # ─────────────────────────────────────────────────────────────────────────
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data
    environment:
      MINIO_ROOT_USER: qa-admin
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    networks:
      - qa-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # ─────────────────────────────────────────────────────────────────────────
  # PostgreSQL — Database
  # ─────────────────────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backups:/backups
    environment:
      POSTGRES_DB: qa_maturity
      POSTGRES_USER: qa_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    networks:
      - qa-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U qa_user -d qa_maturity"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─────────────────────────────────────────────────────────────────────────
  # Миграции (одноразовый запуск)
  # ─────────────────────────────────────────────────────────────────────────
  migrations:
    build:
      context: .
      dockerfile: Dockerfile.api.prod
    environment:
      DATABASE_URL: postgresql://qa_user:${DB_PASSWORD}@postgres:5432/qa_maturity?schema=public
    command: pnpm --filter @workspace/db run db:push
    networks:
      - qa-network
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

volumes:
  traefik-certs:
  redis-data:
  minio-data:
  pgdata:

networks:
  qa-network:
    driver: bridge
```

---

## Переменные окружения (.env)

```bash
# ─────────────────────────────────────────────────────────────────────────
# Domain & SSL
# ─────────────────────────────────────────────────────────────────────────
DOMAIN=qa-maturity.example.com
TRAEFIK_ACME_EMAIL=admin@example.com

# ─────────────────────────────────────────────────────────────────────────
# Database (PostgreSQL)
# ─────────────────────────────────────────────────────────────────────────
DB_PASSWORD=generate-secure-password-here

# ─────────────────────────────────────────────────────────────────────────
# Security (Sessions)
# ─────────────────────────────────────────────────────────────────────────
SESSION_SECRET=generate-random-32-characters-here

# ─────────────────────────────────────────────────────────────────────────
# MinIO (Object Storage)
# ─────────────────────────────────────────────────────────────────────────
MINIO_ROOT_USER=qa-admin
MINIO_PASSWORD=generate-secure-minio-password

# ─────────────────────────────────────────────────────────────────────────
# Генерация секретов (Linux/Mac)
# ─────────────────────────────────────────────────────────────────────────
# DB_PASSWORD=$(openssl rand -base64 24)
# SESSION_SECRET=$(openssl rand -base64 32)
# MINIO_PASSWORD=$(openssl rand -base64 24)
```

---

## Бэкапы (бесплатно, на хост)

### PostgreSQL бэкап

**Скрипт `/usr/local/bin/backup-postgres.sh`:**
```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d-%H%M%S)
CONTAINER="qa-maturity-postgres-1"
DB_NAME="qa_maturity"
DB_USER="qa_user"

# Создать директорию
mkdir -p "$BACKUP_DIR"

# Сделать бэкап
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | \
  gzip > "$BACKUP_DIR/${DB_NAME}-${DATE}.sql.gz"

# Удалить бэкапы старше 7 дней
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${DB_NAME}-${DATE}.sql.gz"
```

**Cron (ежедневно в 3:00):**
```bash
# crontab -e
0 3 * * * /usr/local/bin/backup-postgres.sh >> /var/log/backup-postgres.log 2>&1
```

### MinIO бэкап

**Скрипт `/usr/local/bin/backup-minio.sh`:**
```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/minio"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Копирование данных MinIO (том Docker)
docker run --rm \
  -v qa-maturity_minio-data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/minio-${DATE}.tar.gz" /data

# Удалить бэкапы старше 14 дней
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +14 -delete

echo "MinIO backup completed: minio-${DATE}.tar.gz"
```

---

## Мониторинг (бесплатно)

### Docker встроенный

```bash
# Статус контейнеров
docker-compose -f docker-compose.prod.yml ps

# Использование ресурсов
docker stats

# Логи
docker-compose -f docker-compose.prod.yml logs -f api-server
```

### Health checks

| Контейнер | Health Check | URL / Команда |
|-----------|--------------|---------------|
| Traefik | ✅ Встроенный | `GET /ping` |
| Frontend | ✅ Nginx | `GET /` |
| API Server | ✅ Встроенный | `GET /api/health` |
| Redis | ✅ Встроенный | `redis-cli ping` |
| MinIO | ✅ Встроенный | `GET /minio/health/live` |
| PostgreSQL | ✅ Встроенный | `pg_isready` |

---

## Требования к серверу

### Минимальные (до 100 пользователей)

| Ресурс | Значение |
|--------|----------|
| **CPU** | 2 vCPU |
| **RAM** | 2 GB |
| **Disk** | 20 GB SSD |
| **ОС** | Ubuntu 22.04 / Debian 12 |

### Рекомендуемые (до 500 пользователей)

| Ресурс | Значение |
|--------|----------|
| **CPU** | 4 vCPU |
| **RAM** | 4 GB |
| **Disk** | 50 GB SSD |
| **ОС** | Ubuntu 22.04 LTS |

### Для 1000+ пользователей

| Ресурс | Значение |
|--------|----------|
| **CPU** | 8 vCPU |
| **RAM** | 8 GB |
| **Disk** | 100 GB NVMe |
| **ОС** | Ubuntu 22.04 LTS |

---

## Развёртывание (Step-by-Step)

### 1. Подготовка сервера (Ubuntu 22.04)

```bash
# Обновление
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo apt install -y docker-compose-plugin

# Проверка
docker --version
docker compose version
```

### 2. Клонирование репозитория

```bash
git clone https://github.com/dest7/QA-Maturity-Model.git
cd QA-Maturity-Model
```

### 3. Настройка переменных

```bash
cp .env.example .env
nano .env  # заполнить переменные
```

### 4. Применение миграций

```bash
docker compose -f docker-compose.prod.yml up migrations --abort-on-container-exit
```

### 5. Запуск сервисов

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 6. Проверка

```bash
# Статус
docker compose -f docker-compose.prod.yml ps

# Логи
docker compose -f docker-compose.prod.yml logs -f

# Health check
curl -k https://localhost/api/health
```

---

## Стоимость (полностью бесплатно!)

| Компонент | Стоимость |
|-----------|-----------|
| **Docker Host (свой сервер)** | ₽0 (или ~₽500/мес за VPS) |
| **Traefik** | ✅ Бесплатно (open source) |
| **Nginx** | ✅ Бесплатно (open source) |
| **Node.js** | ✅ Бесплатно (open source) |
| **Redis** | ✅ Бесплатно (open source) |
| **MinIO** | ✅ Бесплатно (AGPL v3) |
| **PostgreSQL** | ✅ Бесплатно (open source) |
| **Let's Encrypt SSL** | ✅ Бесплатно |
| **Итого** | **₽0** (без учёта VPS) |

**VPS в РФ (если нужен хостинг):**
- Timeweb Cloud: от ₽200/мес (2 vCPU, 2GB RAM)
- Selectel: от ₽350/мес (2 vCPU, 2GB RAM)
- Yandex Cloud Compute: от ₽450/мес (2 vCPU, 2GB RAM)

---

## Безопасность

### 1. Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Traefik)
sudo ufw allow 443/tcp   # HTTPS (Traefik)
sudo ufw enable
```

### 2. Docker network isolation

- ✅ Все контейнеры в `qa-network`
- ✅ Только Traefik имеет публичные порты
- ✅ PostgreSQL, Redis, MinIO — только внутри сети

### 3. Secrets

- ✅ Пароли в `.env` (не в git!)
- ✅ `.env` в `.gitignore`
- ✅ SSL сертификаты в volume

### 4. Бэкапы

- ✅ Ежедневные бэкапы PostgreSQL
- ✅ Хранение на хосте (можно копировать на внешний носитель)
- ✅ Ротация (7 дней для БД, 14 дней для MinIO)

---

## Миграция с dev на production

### 1. Экспорт из dev

```bash
docker exec qa-maturity-model-postgres-1 pg_dump -U qa_user qa_maturity > dev-backup.sql
```

### 2. Импорт в production

```bash
docker exec -i qa-maturity-postgres-1 psql -U qa_user -d qa_maturity < dev-backup.sql
```

### 3. Копирование артефактов

```bash
# Из dev MinIO
mc cp -r dev-minio/qa-maturity-artifacts/ prod-minio/qa-maturity-artifacts/
```

---

## Troubleshooting

### Контейнер не стартует

```bash
# Проверить логи
docker compose -f docker-compose.prod.yml logs <container-name>

# Проверить ресурсы
docker stats

# Пересоздать контейнер
docker compose -f docker-compose.prod.yml up -d --force-recreate <container-name>
```

### PostgreSQL не принимает соединения

```bash
# Проверить health
docker compose -f docker-compose.prod.yml ps postgres

# Проверить логи
docker compose -f docker-compose.prod.yml logs postgres

# Проверить подключение
docker exec -it qa-maturity-postgres-1 psql -U qa_user -d qa_maturity -c "SELECT 1"
```

### MinIO не доступен

```bash
# Проверить Console
curl http://localhost:9001

# Проверить API
curl http://localhost:9000/minio/health/live
```

### SSL не работает

```bash
# Проверить сертификаты Traefik
docker exec qa-maturity-traefik-1 ls -la /letsencrypt/

# Пересоздать сертификаты
docker compose -f docker-compose.prod.yml restart traefik
```

---

## См. также

- [Dockerfile.web.prod](../Dockerfile.web.prod)
- [Dockerfile.api.prod](../Dockerfile.api.prod)
- [docker-compose.prod.yml](../docker-compose.prod.yml)
- [.env.example](../.env.example)
- [BACKUP.md](./BACKUP.md) — детальное руководство по бэкапам
