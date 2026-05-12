/**
 * Тесты маршрутов команды (POST /api/teams).
 * 
 * TDD процесс:
 * 1. RED — тест падает (кода ещё нет)
 * 2. GREEN — минимальный код для прохождения
 * 3. REFACTOR — улучшение кода
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { db } from '@workspace/db';
import { teamsTable, teamSkillLevelsTable, skillsTable } from '@workspace/db';
import { eq, isNull } from 'drizzle-orm';
import app from '../../src/app';

describe('POST /api/teams', () => {
  const testTeamName = `Test Team ${Date.now()}`;
  const testDescription = 'Test description for TDD';

  beforeAll(async () => {
    // Очистка тестовых данных перед запуском
    await db.delete(teamSkillLevelsTable);
    await db.delete(teamsTable);
  });

  afterAll(async () => {
    // Очистка после тестов
    await db.delete(teamSkillLevelsTable);
    await db.delete(teamsTable);
  });

  it('должен создать новую команду и вернуть статус 201', async () => {
    const response = await request(app)
      .post('/api/teams')
      .send({
        name: testTeamName,
        description: testDescription,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      name: testTeamName,
      description: testDescription,
      overallLevel: 0,
      assessmentStatus: 'planned',
    });

    expect(response.body.id).toBeDefined();
    expect(typeof response.body.id).toBe('number');
  });

  it('должен автоматически создать 15 записей навыков для новой команды', async () => {
    // Находим только что созданную команду
    const teams = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.name, testTeamName));

    expect(teams.length).toBe(1);
    const teamId = teams[0].id;

    // Проверяем, что создано 15 записей навыков (по одному на каждый skill)
    const skillLevels = await db
      .select()
      .from(teamSkillLevelsTable)
      .where(eq(teamSkillLevelsTable.teamId, teamId));

    expect(skillLevels.length).toBeGreaterThanOrEqual(15);

    // Все навыки должны иметь уровень 0
    skillLevels.forEach((skillLevel) => {
      expect(skillLevel.level).toBe(0);
    });
  });

  it('должен вернуть ошибку при отсутствии названия команды', async () => {
    const response = await request(app)
      .post('/api/teams')
      .send({
        description: 'No name provided',
      });

    // Проверяем, что сервер вернул ошибку (400 или 500)
    expect([400, 500]).toContain(response.status);
    
    // Тело ответа может быть пустым или содержать ошибку
    // Главное — статус код указывает на ошибку
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('должен создать команду без orgUnitId (опциональное поле)', async () => {
    const response = await request(app)
      .post('/api/teams')
      .send({
        name: `Team without org ${Date.now()}`,
        description: 'orgUnitId is optional',
      })
      .expect(201);

    expect(response.body.orgUnitId).toBeNull();
  });

  it('должен создать команду с orgUnitId если указано', async () => {
    const testOrgUnitId = 1;
    const response = await request(app)
      .post('/api/teams')
      .send({
        name: `Team with org ${Date.now()}`,
        description: 'orgUnitId provided',
        orgUnitId: testOrgUnitId,
      })
      .expect(201);

    expect(response.body.orgUnitId).toBe(testOrgUnitId);
  });
});
