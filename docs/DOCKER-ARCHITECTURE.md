# Docker Architecture — Hybrid Production Setup

## Обзор архитектуры

Гибридный подход: контейнеры для stateless-компонентов + managed сервисы для stateful.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION ENVIRONMENT                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Docker Host (VM / Server)                    │   │
│  │                                                                     │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │   │
│  │  │   Traefik    │    │   Frontend   │    │  API Server  │          │   │
│  │  │   (Proxy)    │───▶│   (Nginx)    │───▶│   (Node.js)  │          │   │
│  │  │   :80, :443  │    │   :80        │    │   :8080      │          │   │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘          │   │
│  │                                                  │                  │   │
│  │  ┌──────────────┐                                │                  │   │
│  │  │    Redis     │◀───────────────────────────────┤                  │   │
│  │  │   (Cache)    │    Сессии + Кэш                │                  │   │
│  │  │   :6379      │                                │                  │   │
│  │  └──────────────┘                                │                  │   │
│  │                                                  │                  │   │
│  └──────────────────────────────────────────────────┼──────────────────┘   │
│                                                     │                       │
│                                                     ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Managed Services (Cloud)                         │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────┐    ┌──────────────────────┐   │   │
│  │  │   PostgreSQL (RDS / Cloud SQL)  │    │   S3 / Blob Storage  │   │   │
│  │  │   :5432 (внутри VPC)            │    │   для артефактов     │   │   │
│  │  │   • Auto backup                 │    │                      │   │   │
│  │  │   • Read replicas               │    │                      │   │   │
│  │  │   • Multi-AZ failover           │    │                      │   │   │
│  │  └─────────────────────────────────┘    └──────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Контейнеры (Docker Host)

### 1. Traefik (Reverse Proxy)

| Параметр | Значение |
|----------|----------|
| **Image** | `traefik:v2.10` |
| **Ports** | `80:80`, `443:443` |
| **Zone ответственности** | Маршрутизация запросов, SSL termination, rate limiting |
| **Stateless** | ✅ Да |
| **Масштабирование** | 1 реплика (stateless, но единая точка входа) |

**Конфигурация:**
```yaml
traefik:
  image: traefik:v2.10
  command:
    - "--providers.docker=true"
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

---

### 2. Frontend (Nginx)

| Параметр | Значение |
|----------|----------|
| **Image** | `nginx:alpine` (кастомный build) |
| **Ports** | `80` (внутри сети) |
| **Zone ответственности** | Статика React-приложения, gzip/brotli сжатие, кэш-заголовки |
| **Stateless** | ✅ Да |
| **Масштабирование** | 1-2 реплики (лёгкий, можно больше) |

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

**nginx.conf:**
```nginx
server {
    listen 80;
    server_name qa-maturity.example.com;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    # Кэш для статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api/ {
        proxy_pass http://api-server:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

### 3. API Server (Node.js + Express)

| Параметр | Значение |
|----------|----------|
| **Image** | Кастомный build (Node.js 20) |
| **Ports** | `8080` (внутри сети) |
| **Zone ответственности** | Бизнес-логика, API endpoints, аутентификация, валидация |
| **Stateless** | ✅ Да (сессии в Redis) |
| **Масштабирование** | 2-5 реплик (горизонтальное) |

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

**Переменные окружения:**
```bash
DATABASE_URL=postgresql://qa_user:***@rds.amazonaws.com:5432/qa_maturity
REDIS_URL=redis://redis:6379
SESSION_SECRET=<random-32-chars>
NODE_ENV=production
```

---

### 4. Redis (Cache + Sessions)

| Параметр | Значение |
|----------|----------|
| **Image** | `redis:7-alpine` |
| **Ports** | `6379` (внутри сети, не наружу!) |
| **Zone ответственности** | Сессии пользователей, кэш частых запросов (навыки, метрики) |
| **Stateless** | ⚠️ Частично (данные в памяти, но есть persistence) |
| **Масштабирование** | 1 реплика (для HA — Redis Sentinel) |

**Конфигурация:**
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
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

**Почему не managed Redis:**
- Легковесный (256MB RAM достаточно)
- Простая настройка
- Можно мигрировать на ElastiCache/Memorystore позже

---

## Managed сервисы (Cloud)

### PostgreSQL (RDS / Cloud SQL)

| Параметр | Значение |
|----------|----------|
| **Provider** | AWS RDS / Google Cloud SQL / Azure Database |
| **Version** | PostgreSQL 16 |
| **Zone ответственности** | Хранение всех данных (команды, навыки, пользователи, артефакты) |
| **Backup** | Автоматический daily + point-in-time recovery |
| **HA** | Multi-AZ deployment с auto-failover |
| **Scaling** | Vertical (больше CPU/RAM) + Read Replicas |

**Рекомендуемая конфигурация (start):**
- Instance: db.t3.medium (2 vCPU, 4GB RAM)
- Storage: 20GB GP3, auto-scaling до 100GB
- Multi-AZ: ✅ для production
- Backup retention: 7 дней

**Connection string:**
```bash
DATABASE_URL=postgresql://qa_user:${DB_PASSWORD}@qa-maturity-db.xxx.us-east-1.rds.amazonaws.com:5432/qa_maturity?sslmode=require
```

---

### S3 / Blob Storage (Артефакты)

| Параметр | Значение |
|----------|----------|
| **Provider** | AWS S3 / Google Cloud Storage / Azure Blob |
| **Zone ответственности** | Хранение ссылок на артефакты команд (документы, скриншоты, отчёты) |
| **Backup** | Versioning + Cross-Region Replication (опционально) |

**Интеграция в API:**
```typescript
// Вместо хранения файлов в БД — только метаданные
// Файлы загружаются напрямую в S3 через presigned URLs
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: 'us-east-1' });

// Генерация presigned URL для загрузки
const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
  Bucket: 'qa-maturity-artifacts',
  Key: `teams/${teamId}/${fileId}`,
  ContentType: file.mimeType,
}), { expiresIn: 3600 });
```

---

## docker-compose.prod.yml (полный файл)

```yaml
version: '3.8'

services:
  # ─────────────────────────────────────────────────────────────────────────
  # Reverse Proxy (SSL termination, routing)
  # ─────────────────────────────────────────────────────────────────────────
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
    labels:
      - "traefik.enable=true"

  # ─────────────────────────────────────────────────────────────────────────
  # Frontend (React + Nginx)
  # ─────────────────────────────────────────────────────────────────────────
  frontend:
    build:
      context: ..
      dockerfile: Dockerfile.web.prod
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`qa-maturity.example.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
    networks:
      - qa-network
    depends_on:
      - api-server
    restart: unless-stopped

  # ─────────────────────────────────────────────────────────────────────────
  # API Server (Node.js + Express) — горизонтальное масштабирование
  # ─────────────────────────────────────────────────────────────────────────
  api-server:
    build:
      context: ..
      dockerfile: Dockerfile.api.prod
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
      SESSION_SECRET: ${SESSION_SECRET}
      NODE_ENV: production
      S3_BUCKET: ${S3_BUCKET}
      AWS_REGION: ${AWS_REGION}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    labels:
      - "traefik.enable=true"
      - "traefik.http.services.api-server.loadbalancer.server.port=8080"
      - "traefik.http.routers.api.rule=Host(`qa-maturity.example.com`) && PathPrefix(`/api/`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
    networks:
      - qa-network
    depends_on:
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3  # ← Горизонтальное масштабирование!
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ─────────────────────────────────────────────────────────────────────────
  # Redis (Sessions + Cache)
  # ─────────────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
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
  # Миграции БД (запускаются один раз при деплое)
  # ─────────────────────────────────────────────────────────────────────────
  migrations:
    build:
      context: ..
      dockerfile: Dockerfile.api.prod
    environment:
      DATABASE_URL: ${DATABASE_URL}
    command: pnpm --filter @workspace/db run db:push
    networks:
      - qa-network
    depends_on:
      - redis  # Ждём готовности сети
    restart: "no"  # Одноразовый запуск

# ─────────────────────────────────────────────────────────────────────────
# Volumes (данные сохраняются между перезапусками)
# ─────────────────────────────────────────────────────────────────────────
volumes:
  traefik-certs:
  redis-data:

# ─────────────────────────────────────────────────────────────────────────
# Networks (изоляция трафика)
# ─────────────────────────────────────────────────────────────────────────
networks:
  qa-network:
    driver: bridge
```

---

## Переменные окружения (.env.example)

```bash
# ─────────────────────────────────────────────────────────────────────────
# Database (Managed PostgreSQL)
# ─────────────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://qa_user:YOUR_PASSWORD@qa-maturity-db.xxx.rds.amazonaws.com:5432/qa_maturity?sslmode=require

# ─────────────────────────────────────────────────────────────────────────
# Security
# ─────────────────────────────────────────────────────────────────────────
SESSION_SECRET=generate-random-32-characters-here

# ─────────────────────────────────────────────────────────────────────────
# S3 Storage (Artifacts)
# ─────────────────────────────────────────────────────────────────────────
S3_BUCKET=qa-maturity-artifacts
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY

# ─────────────────────────────────────────────────────────────────────────
# Traefik (SSL)
# ─────────────────────────────────────────────────────────────────────────
TRAEFIK_ACME_EMAIL=admin@example.com
```

---

## Сетевая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         qa-network (bridge)                     │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Traefik   │    │  Frontend   │    │ API Server  │         │
│  │   :80, :443 │    │    :80      │    │    :8080    │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                 │
│                            │                                    │
│                    ┌───────▼────────┐                           │
│                    │     Redis      │                           │
│                    │     :6379      │                           │
│                    └────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ (внешние подключения)
                            ▼
              ┌─────────────────────────┐
              │   Managed PostgreSQL    │
              │   (RDS, внутри VPC)     │
              └─────────────────────────┘
```

**Правила безопасности:**
1. Redis **не доступен** извне (только внутри `qa-network`)
2. API Server **не доступен** напрямую (только через Traefik)
3. PostgreSQL **не в Docker** — managed сервис с IAM/VPC firewall
4. Traefik — единственная точка входа (порты 80/443)

---

## Масштабирование

### Вертикальное (больше ресурсов на контейнер)

```yaml
api-server:
  deploy:
    resources:
      limits:
        cpus: '2'      # ← Больше CPU
        memory: 2G     # ← Больше RAM
```

### Горизонтальное (больше реплик)

```yaml
api-server:
  deploy:
    replicas: 5  # ← 5 экземпляров API
```

### Когда масштабировать:

| Метрика | Порог | Действие |
|---------|-------|----------|
| CPU API | >70% | Увеличить реплики (3→5) |
| RAM API | >80% | Увеличить лимит памяти |
| Redis RAM | >200MB | Увеличить `--maxmemory` |
| PostgreSQL CPU | >60% | Vertical scaling (RDS) |
| Response time | >500ms | Добавить кэш в Redis |

---

## Monitoring & Logging

### Health checks

```yaml
api-server:
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s

redis:
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

### Логи

```bash
# Все логи
docker-compose -f docker-compose.prod.yml logs -f

# Только API
docker-compose -f docker-compose.prod.yml logs -f api-server

# Экспорт в файл
docker-compose -f docker-compose.prod.yml logs api-server > api-logs.txt
```

### Рекомендованные инструменты:

| Инструмент | Назначение |
|------------|------------|
| **Prometheus + Grafana** | Метрики контейнеров (CPU, RAM, requests) |
| **Loki** | Агрегация логов |
| **pgAdmin** | Мониторинг PostgreSQL |
| **Redis Insight** | Мониторинг Redis |

---

## Deployment Checklist

### Pre-deploy

- [ ] `.env` файл создан с реальными значениями
- [ ] PostgreSQL RDS создан, security group настроен
- [ ] S3 bucket создан, IAM user с правами создан
- [ ] Домен настроен (DNS A-record на сервер)
- [ ] SSL сертификат (Traefik автоматически через Let's Encrypt)

### Deploy

```bash
# 1. Применить миграции
docker-compose -f docker-compose.prod.yml up migrations --abort-on-container-exit

# 2. Запустить сервисы
docker-compose -f docker-compose.prod.yml up -d

# 3. Проверить статус
docker-compose -f docker-compose.prod.yml ps

# 4. Проверить логи
docker-compose -f docker-compose.prod.yml logs -f
```

### Post-deploy

- [ ] Health check: `https://qa-maturity.example.com/api/health`
- [ ] Login тест: войти под admin
- [ ] Проверить создание команды
- [ ] Проверить загрузку артефакта (S3)

---

## Backup & Recovery

### PostgreSQL (автоматически через RDS)

- Daily snapshots: ✅ автоматически
- Point-in-time recovery: ✅ до 7 дней
- Multi-AZ failover: ✅ автоматически

### Redis (данные в памяти)

```bash
# Ручной бэкап
docker exec qa-maturity-redis-1 redis-cli BGSAVE

# Копирование RDB файла
docker cp qa-maturity-redis-1:/data/dump.rdb ./backup-redis-$(date +%Y%m%d).rdb
```

### Traefik сертификаты

```bash
# Сертификаты Let's Encrypt сохраняются в volume
docker volume inspect qa-maturity_traefik-certs
```

---

## Стоимость (ориентировочно, AWS)

| Сервис | Конфигурация | Цена/месяц |
|--------|--------------|------------|
| **EC2 (Docker Host)** | t3.medium (2 vCPU, 4GB) | ~$30 |
| **RDS PostgreSQL** | db.t3.medium, 20GB | ~$50 |
| **S3 Storage** | 1GB + requests | ~$1 |
| **Traefik/Frontend/Redis** | Включено в EC2 | $0 |
| **Итого** | | **~$81/месяц** |

---

## Миграция с dev на production

### 1. Экспорт данных из dev БД

```bash
docker exec qa-maturity-model-postgres-1 pg_dump -U qa_user qa_maturity > dev-backup.sql
```

### 2. Импорт в production RDS

```bash
psql -h qa-maturity-db.xxx.rds.amazonaws.com -U qa_user -d qa_maturity < dev-backup.sql
```

### 3. Обновить .env и задеплоить

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## См. также

- [Dockerfile.web.prod](../Dockerfile.web.prod)
- [Dockerfile.api.prod](../Dockerfile.api.prod)
- [docker-compose.prod.yml](../docker-compose.prod.yml)
- [.env.example](../.env.example)
