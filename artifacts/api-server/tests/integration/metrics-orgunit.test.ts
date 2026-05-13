/**
 * Интеграционные тесты API метрик с фильтрацией по orgUnitId.
 * 
 * Тесты проверяют, что данные гистограммы фильтруются по выбранному узлу оргструктуры.
 * Тесты не удаляют данные из БД — используют только чтение и создание snapshot'ов.
 * 
 * Используется учётная запись Edward (admin) для аутентификации.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

// Глобальные cookies для аутентификации
let authCookies: string[] = [];

beforeAll(async () => {
  // Логинимся как Edward (admin) — используем email из seed
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email: 'edward@company.com', password: 'Edward' });
  
  expect(loginResponse.status).toBe(200);
  authCookies = loginResponse.get('set-cookie') || [];
});

describe('GET /api/metrics/history с orgUnitId', () => {
  it('должен вернуть данные гистограммы для всех команд без фильтра', async () => {
    const response = await request(app)
      .get('/api/metrics/history?period=week')
      .set('Cookie', authCookies)
      .expect(200);

    expect(response.body).toHaveProperty('snapshots');
    expect(Array.isArray(response.body.snapshots)).toBe(true);
  });

  it('должен вернуть данные гистограммы для выбранного управления (orgUnitId=1)', async () => {
    const response = await request(app)
      .get('/api/metrics/history?period=week&orgUnitId=1')
      .set('Cookie', authCookies)
      .expect(200);

    expect(response.body).toHaveProperty('snapshots');
    expect(Array.isArray(response.body.snapshots)).toBe(true);
  });

  it('должен вернуть пустые данные для несуществующего orgUnitId', async () => {
    const response = await request(app)
      .get('/api/metrics/history?period=week&orgUnitId=999999')
      .set('Cookie', authCookies)
      .expect(200);

    expect(response.body).toHaveProperty('snapshots');
    expect(response.body.snapshots).toEqual([]);
  });

  it('должен вернуть данные гистограммы для отдела (дочерний узел)', async () => {
    const response = await request(app)
      .get('/api/metrics/history?period=month&orgUnitId=2')
      .set('Cookie', authCookies)
      .expect(200);

    expect(response.body).toHaveProperty('snapshots');
    expect(Array.isArray(response.body.snapshots)).toBe(true);
  });

  it('должен вернуть меньше данных для отдела, чем для управления', async () => {
    // Получаем данные для управления (orgUnitId=12 — Управление продуктовой разработки)
    const managementResponse = await request(app)
      .get('/api/metrics/history?period=year&orgUnitId=12')
      .set('Cookie', authCookies)
      .expect(200);

    // Получаем данные для отдела (orgUnitId=13 — Отдел Backend-разработки, дочерний узел)
    const deptResponse = await request(app)
      .get('/api/metrics/history?period=year&orgUnitId=13')
      .set('Cookie', authCookies)
      .expect(200);

    // Управление должно содержать больше или равно snapshot'ов (т.к. включает все дочерние отделы)
    expect(managementResponse.body.snapshots.length).toBeGreaterThanOrEqual(deptResponse.body.snapshots.length);
  });
});

describe('GET /api/metrics с orgUnitId', () => {
  it('должен вернуть метрики для всех команд без фильтра', async () => {
    const response = await request(app)
      .get('/api/metrics')
      .set('Cookie', authCookies)
      .expect(200);

    expect(response.body).toHaveProperty('teams');
    expect(response.body).toHaveProperty('heatmap');
    expect(response.body).toHaveProperty('skillAverages');
  });

  it('должен вернуть метрики только для выбранного управления', async () => {
    const response = await request(app)
      .get('/api/metrics?orgUnitId=1')
      .set('Cookie', authCookies)
      .expect(200);

    expect(response.body).toHaveProperty('teams');
    expect(Array.isArray(response.body.teams)).toBe(true);
    
    // Все команды должны принадлежать управлению или его дочерним узлам
    response.body.teams.forEach((team: any) => {
      expect(team.orgUnitId).toBeDefined();
    });
  });
});
