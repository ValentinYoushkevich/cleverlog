import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { ROLES } from '../../src/constants/roles.js';
import { loginAs } from '../helpers/auth.js';

const YEAR = 2025;
const MONTH = 1;

describe('MonthClosure module', () => {
  describe('GET /api/month-closures/status/:year/:month', () => {
    it('1. Возвращает closed: true для закрытого месяца', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'mc-status-closed@test.local' });

      await agent
        .post('/api/month-closures')
        .send({ year: YEAR, month: MONTH });

      const res = await agent.get(`/api/month-closures/status/${YEAR}/${MONTH}`);
      expect(res.status).toBe(200);
      expect(res.body.closed).toBe(true);
    });

    it('2. Возвращает closed: false для открытого месяца', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'mc-status-open@test.local' });

      const res = await agent.get('/api/month-closures/status/2025/3');
      expect(res.status).toBe(200);
      expect(res.body.closed).toBe(false);
    });

    it('3. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/month-closures/status/2025/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/month-closures', () => {
    it('4. Возвращает список всех закрытых месяцев', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'mc-list@test.local' });

      await agent.post('/api/month-closures').send({ year: 2025, month: 1 });
      await agent.post('/api/month-closures').send({ year: 2025, month: 2 });

      const res = await agent.get('/api/month-closures');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('5. Возвращает пустой массив если ни одного закрытия нет', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'mc-empty@test.local' });
      await db('month_closures').del();

      const res = await agent.get('/api/month-closures');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('6. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'mc-user@test.local' });
      const res = await agent.get('/api/month-closures');
      expect(res.status).toBe(403);
    });

    it('7. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/month-closures');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/month-closures', () => {
    it('8–9. Успешное закрытие месяца и повторное закрытие даёт ALREADY_CLOSED', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'mc-close@test.local' });

      const res1 = await agent
        .post('/api/month-closures')
        .send({ year: YEAR, month: MONTH });

      expect(res1.status).toBe(201);
      expect(res1.body.year).toBe(YEAR);
      expect(res1.body.month).toBe(MONTH);
      expect(res1.body.closed_by).toBeDefined();

      const statusRes = await agent.get(`/api/month-closures/status/${YEAR}/${MONTH}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.closed).toBe(true);

      const res2 = await agent
        .post('/api/month-closures')
        .send({ year: YEAR, month: MONTH });

      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe('ALREADY_CLOSED');
    });

    it('10–11. После закрытия месяца work_log и absence блокируются', async () => {
      const { agent, user } = await loginAs({ role: ROLES.ADMIN, email: 'mc-block@test.local' });

      await agent.post('/api/month-closures').send({ year: YEAR, month: MONTH });

      const workRes = await agent
        .post('/api/work-logs')
        .send({
          project_id: (await db('projects').first('id'))?.id || null,
          date: '2025-01-06',
          duration: '8h',
          comment: 'Test',
          task_number: 'TASK-1',
          user_id: user.id,
        });

      expect(workRes.status).toBeGreaterThanOrEqual(400);

      const absenceRes = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-06',
          date_to: '2025-01-06',
        });

      expect(absenceRes.status).toBeGreaterThanOrEqual(400);
    });

    it('12. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'mc-close-user@test.local' });
      const res = await agent.post('/api/month-closures').send({ year: YEAR, month: MONTH });
      expect(res.status).toBe(403);
    });

    it('13. Без токена возвращает 401', async () => {
      const res = await request(app)
        .post('/api/month-closures')
        .send({ year: YEAR, month: MONTH });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/month-closures/:year/:month', () => {
    it('14–16. Успешное открытие и снова разрешено создавать work_log', async () => {
      const { agent, user } = await loginAs({ role: ROLES.ADMIN, email: 'mc-open@test.local' });

      await agent.post('/api/month-closures').send({ year: YEAR, month: MONTH });

      const delRes = await agent.delete(`/api/month-closures/${YEAR}/${MONTH}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.message).toContain('открыт');

      const statusRes = await agent.get(`/api/month-closures/status/${YEAR}/${MONTH}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.closed).toBe(false);

      const projectId = (await db('projects').first('id'))?.id;
      if (!projectId) {
        await db('projects').insert({ name: 'MC Test', status: 'active' });
      }
      const finalProjectId = projectId || (await db('projects').first('id')).id;

      const workRes = await agent
        .post('/api/work-logs')
        .send({
          project_id: finalProjectId,
          date: '2025-01-06',
          duration: '8h',
          comment: 'Test',
          task_number: 'TASK-1',
          user_id: user.id,
        });

      expect(workRes.status).toBe(201);
    });

    it('15. Попытка открыть не закрытый месяц возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'mc-open-notclosed@test.local' });
      await db('month_closures').del();

      const res = await agent.delete('/api/month-closures/2025/3');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_CLOSED');
    });

    it('17. Обычный пользователь получает 403', async () => {
      const admin = await loginAs({ role: ROLES.ADMIN, email: 'mc-open-admin2@test.local' });
      await admin.agent.post('/api/month-closures').send({ year: YEAR, month: MONTH });

      const { agent } = await loginAs({ email: 'mc-open-user@test.local' });
      const res = await agent.delete(`/api/month-closures/${YEAR}/${MONTH}`);
      expect(res.status).toBe(403);
    });

    it('18. Без токена возвращает 401', async () => {
      const res = await request(app).delete(`/api/month-closures/${YEAR}/${MONTH}`);
      expect(res.status).toBe(401);
    });
  });
});
