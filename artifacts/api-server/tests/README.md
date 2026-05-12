# Тесты API Server

## Структура

```
tests/
├── unit/              # Unit-тесты (изолированные)
│   └── .gitkeep
├── integration/       # Интеграционные тесты (с БД)
│   └── teams.test.ts  # Тесты маршрутов команд
└── e2e/               # E2E тесты (полные сценарии)
    └── .gitkeep
```

## Типы тестов

### Unit-тесты (`tests/unit/` или `src/**/*.test.ts`)

**Что тестировать:**
- Отдельные функции без внешних зависимостей
- Утилиты, хелперы, валидаторы
- Моки внешних сервисов (БД, API)

**Пример:**
```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { calculateOverallLevel } from './utils';

describe('calculateOverallLevel', () => {
  it('должен вернуть 0 для пустого массива', () => {
    expect(calculateOverallLevel([])).toBe(0);
  });
});
```

---

### Integration-тесты (`tests/integration/`)

**Что тестировать:**
- Маршруты API с реальной БД
- Взаимодействие нескольких компонентов
- CRUD операции

**Пример:**
```typescript
// tests/integration/teams.test.ts
import { db } from '@workspace/db';

describe('POST /api/teams', () => {
  beforeAll(async () => {
    // Очистка БД перед тестами
    await db.delete(teamsTable);
  });

  it('должен создать команду', async () => {
    const response = await request(app)
      .post('/api/teams')
      .send({ name: 'Test', description: 'Desc' });
    
    expect(response.status).toBe(201);
  });
});
```

---

### E2E тесты (`tests/e2e/`)

**Что тестировать:**
- Полные пользовательские сценарии
- Цепочки действий (login → create team → add skill)
- Работа с фронтендом (если подключен Playwright)

**Пример:**
```typescript
// tests/e2e/team-flow.test.ts
describe('Team Management Flow', () => {
  it('должен пройти полный цикл: создание → редактирование → архив', async () => {
    // 1. Логин
    // 2. Создание команды
    // 3. Добавление навыка
    // 4. Архивирование
  });
});
```

---

## Запуск тестов

```bash
# Все тесты
pnpm test

# В режиме watch (автоматически при изменениях)
pnpm test:watch

# Только unit-тесты
pnpm vitest run src/**/*.test.ts

# Только integration-тесты
pnpm vitest run tests/integration/**/*.test.ts

# Конкретный тест по имени
pnpm vitest run -t "должен создать новую команду"
```

## Покрытие кода

```bash
# Запуск с отчётом о покрытии
pnpm vitest run --coverage
```

## Best Practices

### 1. Очистка БД

```typescript
beforeAll(async () => {
  await db.delete(teamSkillLevelsTable);
  await db.delete(teamsTable);
});

afterAll(async () => {
  await db.delete(teamSkillLevelsTable);
  await db.delete(teamsTable);
});
```

### 2. Уникальные имена

```typescript
const testTeamName = `Test Team ${Date.now()}`;
```

### 3. Тестовые данные

```typescript
const testUser = {
  name: 'Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'password123',
};
```

### 4. Ожидание ошибок

```typescript
// Плохо
try {
  await someFunction();
} catch (e) {
  expect(e).toBeDefined();
}

// Хорошо
await expect(someFunction()).rejects.toThrow('Expected error');
```

## Конфигурация

См. `vitest.config.ts`:
- Переменные окружения (DATABASE_URL, SESSION_SECRET)
- Таймауты (10 секунд)
- Пути к тестам (`src/**/*.test.ts`, `tests/**/*.test.ts`)
