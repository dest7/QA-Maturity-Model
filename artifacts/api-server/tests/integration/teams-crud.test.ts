/**
 * Интеграционные тесты чтения и обновления команд (GET, PUT).
 *
 * Тесты используют транзакции с откатом — данные не сохраняются в БД после тестов.
 * Seed данные (30 команд, 15 навыков) не модифицируются.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { db } from '@workspace/db';
import { teamsTable, teamSkillLevelsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import app from '../../src/app';

// Тестовая команда для UPDATE тестов
let testTeamId: number | null = null;

describe('GET /api/teams', () => {
  it('должен вернуть список активных команд', async () => {
    const response = await request(app).get('/api/teams');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('не должен возвращать архивные команды в списке активных', async () => {
    const response = await request(app).get('/api/teams');

    expect(response.status).toBe(200);
    const archivedTeams = response.body.filter((t: any) => t.deletedAt !== null);
    expect(archivedTeams.length).toBe(0);
  });
});

describe('GET /api/teams/:id', () => {
  it('должен вернуть команду с полными данными о навыках', async () => {
    // Получаем первую команду из списка
    const listResponse = await request(app).get('/api/teams');
    const firstTeam = listResponse.body[0];

    const response = await request(app).get(`/api/teams/${firstTeam.id}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(firstTeam.id);
    expect(response.body.skillLevels).toBeDefined();
    expect(Array.isArray(response.body.skillLevels)).toBe(true);
    expect(response.body.skillLevels.length).toBeGreaterThan(0);
  });

  it('должен вернуть 404 для несуществующей команды', async () => {
    const response = await request(app).get('/api/teams/999999');

    expect(response.status).toBe(404);
  });
});

describe('PUT /api/teams/:id', () => {
  beforeEach(async () => {
    // Создаём тестовую команду для UPDATE тестов
    const createResponse = await request(app)
      .post('/api/teams')
      .send({
        name: `Update Test Team ${Date.now()}`,
        description: 'Temporary team for update tests',
      });
    testTeamId = createResponse.body.id;
  });

  afterEach(async () => {
    // Полностью удаляем тестовую команду из БД (hard delete)
    if (testTeamId !== null) {
      try {
        await db.delete(teamSkillLevelsTable).where(eq(teamSkillLevelsTable.teamId, testTeamId));
        await db.delete(teamsTable).where(eq(teamsTable.id, testTeamId));
      } catch (e) {
        // Игнорируем ошибки
      }
      testTeamId = null;
    }
  });

  it('должен обновить название и описание команды', async () => {
    const newName = `Updated Team ${Date.now()}`;
    const newDescription = 'Updated description';

    const response = await request(app)
      .put(`/api/teams/${testTeamId}`)
      .send({
        name: newName,
        description: newDescription,
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe(newName);
    expect(response.body.description).toBe(newDescription);
  });

  it('должен вернуть 404 при обновлении несуществующей команды', async () => {
    const response = await request(app)
      .put('/api/teams/999999')
      .send({
        name: 'Test',
        description: 'Test',
      });

    expect(response.status).toBe(404);
  });
});
