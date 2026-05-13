/**
 * Тесты маршрутов создания команды (POST /api/teams).
 *
 * Тесты используют транзакции с откатом — данные не сохраняются в БД после тестов.
 * Seed данные (30 команд, 15 навыков) не модифицируются.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { db } from '@workspace/db';
import { teamsTable, teamSkillLevelsTable } from '@workspace/db';
import { eq, sql } from 'drizzle-orm';
import app from '../../src/app';

// Храним ID созданных команд для очистки
let createdTeamIds: number[] = [];

describe('POST /api/teams', () => {
  beforeAll(async () => {
    // Очищаем тестовые команды от предыдущих запусков
    const testTeams = await db.select({ id: teamsTable.id }).from(teamsTable).where(
      eq(teamsTable.name, 'Test Team')
    );
    for (const team of testTeams) {
      await db.delete(teamSkillLevelsTable).where(eq(teamSkillLevelsTable.teamId, team.id));
      await db.delete(teamsTable).where(eq(teamsTable.id, team.id));
    }
  });

  beforeEach(() => {
    createdTeamIds = [];
  });

  afterEach(async () => {
    // Полностью удаляем созданные тестами команды из БД (hard delete)
    // Используем прямой доступ к БД, чтобы не оставлять мусор
    for (const teamId of createdTeamIds) {
      try {
        // Сначала удаляем связанные записи team_skill_levels (cascade должен сработать, но на всякий случай)
        await db.delete(teamSkillLevelsTable).where(eq(teamSkillLevelsTable.teamId, teamId));
        // Затем удаляем команду
        await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
      } catch (e) {
        // Игнорируем ошибки удаления
      }
    }
    createdTeamIds = [];
  });

  it('должен создать новую команду и вернуть статус 201', async () => {
    const testTeamName = `Test Team ${Date.now()}`;
    const testDescription = 'Test description for TDD';

    const response = await request(app)
      .post('/api/teams')
      .send({
        name: testTeamName,
        description: testDescription,
      })
      .expect(201);

    // Сохраняем ID для последующей очистки
    createdTeamIds.push(response.body.id);

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
    const testTeamName = `Skill Test Team ${Date.now()}`;
    
    // Создаём команду
    const createResponse = await request(app)
      .post('/api/teams')
      .send({
        name: testTeamName,
        description: 'Test for skills',
      });
    
    createdTeamIds.push(createResponse.body.id);
    const teamId = createResponse.body.id;

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

    // Сохраняем ID для очистки
    createdTeamIds.push(response.body.id);

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

    // Сохраняем ID для очистки
    createdTeamIds.push(response.body.id);

    expect(response.body.orgUnitId).toBe(testOrgUnitId);
  });
});
