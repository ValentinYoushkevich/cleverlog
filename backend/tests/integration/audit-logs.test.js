import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { loginAs } from '../helpers/auth.js';

describe('AuditLog module', () => {
  describe('GET /api/audit-logs', () => {
    it('1. Успешно возвращает список записей с пагинацией', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-list@test.local' });

      await db('audit_logs').insert({
        actor_id: user.id,
        actor_role: user.role,
        event_type: 'LOGIN',
        event_label: 'Логин',
        entity_type: 'user',
        entity_id: user.id,
        before: null,
        after: JSON.stringify({ email: user.email }),
        ip: '127.0.0.1',
        result: 'success',
      });

      const res = await agent.get('/api/audit-logs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('total_pages');
    });

    it('2. Каждая запись содержит event и entity в правильном формате', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-structure@test.local' });

      await db('audit_logs').insert({
        actor_id: user.id,
        actor_role: user.role,
        event_type: 'LOGIN',
        event_label: 'Логин',
        entity_type: 'user',
        entity_id: user.id,
        before: null,
        after: JSON.stringify({ email: user.email }),
        ip: '127.0.0.1',
        result: 'success',
      });

      const res = await agent.get('/api/audit-logs');
      expect(res.status).toBe(200);
      const first = res.body.data[0];
      expect(first).toHaveProperty('event');
      expect(first.event).toHaveProperty('type');
      expect(first.event).toHaveProperty('name');
      expect(first).toHaveProperty('entity');
      expect(first.entity).toHaveProperty('type');
      expect(first.entity).toHaveProperty('name');
    });

    it('3. Фильтр по actor_id', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-filter-actor@test.local' });
      const { user: otherUser } = await loginAs({ role: 'admin', email: 'audit-filter-actor2@test.local' });

      await db('audit_logs').insert([
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: JSON.stringify({ email: user.email }),
          ip: '127.0.0.1',
          result: 'success',
        },
        {
          actor_id: otherUser.id,
          actor_role: otherUser.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: otherUser.id,
          before: null,
          after: JSON.stringify({ email: otherUser.email }),
          ip: '127.0.0.1',
          result: 'success',
        },
      ]);

      const res = await agent.get(`/api/audit-logs?actor_id=${user.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((row) => row.actor_id === user.id)).toBe(true);
    });

    it('4. Фильтр по event_type', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-filter-event@test.local' });

      await db('audit_logs').insert([
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: JSON.stringify({ email: user.email }),
          ip: '127.0.0.1',
          result: 'success',
        },
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGOUT',
          event_label: 'Выход',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: null,
          ip: '127.0.0.1',
          result: 'success',
        },
      ]);

      const res = await agent.get('/api/audit-logs?event_type=LOGIN');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((row) => row.event_type === 'LOGIN')).toBe(true);
    });

    it('5. Фильтр по entity_type', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-filter-entity@test.local' });

      await db('audit_logs').insert({
        actor_id: user.id,
        actor_role: user.role,
        event_type: 'LOGIN',
        event_label: 'Логин',
        entity_type: 'user',
        entity_id: user.id,
        before: null,
        after: JSON.stringify({ email: user.email }),
        ip: '127.0.0.1',
        result: 'success',
      });

      const res = await agent.get('/api/audit-logs?entity_type=user');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((row) => row.entity_type === 'user')).toBe(true);
    });

    it('6. Фильтр по периоду', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-filter-period@test.local' });

      await db('audit_logs').insert([
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: JSON.stringify({ email: user.email }),
          ip: '127.0.0.1',
          result: 'success',
          timestamp: '2025-01-05T10:00:00.000Z',
        },
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGOUT',
          event_label: 'Выход',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: null,
          ip: '127.0.0.1',
          result: 'success',
          timestamp: '2025-02-05T10:00:00.000Z',
        },
      ]);

      const res = await agent.get('/api/audit-logs?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(res.body.data.every((row) => row.timestamp.startsWith('2025-01'))).toBe(true);
    });

    it('7. Фильтр по result', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-filter-result@test.local' });

      await db('audit_logs').insert([
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: JSON.stringify({ email: user.email }),
          ip: '127.0.0.1',
          result: 'success',
        },
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGIN_FAILED',
          event_label: 'Ошибка логина',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: null,
          ip: '127.0.0.1',
          result: 'failure',
        },
      ]);

      const res = await agent.get('/api/audit-logs?result=failure');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((row) => row.result === 'failure')).toBe(true);
    });

    it('8. Поиск по entity_type через search', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-search@test.local' });

      await db('audit_logs').insert({
        actor_id: user.id,
        actor_role: user.role,
        event_type: 'LOGIN',
        event_label: 'Логин',
        entity_type: 'user',
        entity_id: user.id,
        before: null,
        after: JSON.stringify({ email: user.email }),
        ip: '127.0.0.1',
        result: 'success',
      });

      const res = await agent.get('/api/audit-logs?search=пользов');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('9. Пагинация работает корректно', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-pagination@test.local' });

      const rows = [];
      for (let i = 0; i < 10; i += 1) {
        rows.push({
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: JSON.stringify({ email: user.email }),
          ip: '127.0.0.1',
          result: 'success',
        });
      }
      await db('audit_logs').insert(rows);

      const res = await agent.get('/api/audit-logs?page=2&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.pagination.page).toBe(2);
    });

    it('10. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'audit-user@test.local' });
      const res = await agent.get('/api/audit-logs');
      expect(res.status).toBe(403);
    });

    it('11. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/audit-logs');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/audit-logs/filter-options', () => {
    it('12. Возвращает список доступных event_types и entity_types', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-filter-options@test.local' });

      await db('audit_logs').insert([
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: JSON.stringify({ email: user.email }),
          ip: '127.0.0.1',
          result: 'success',
        },
      ]);

      const res = await agent.get('/api/audit-logs/filter-options');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.event_types)).toBe(true);
      expect(Array.isArray(res.body.entity_types)).toBe(true);
      expect(res.body.event_types.length).toBeGreaterThanOrEqual(1);
      expect(res.body.entity_types.length).toBeGreaterThanOrEqual(1);
    });

    it('13. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'audit-filter-options-user@test.local' });
      const res = await agent.get('/api/audit-logs/filter-options');
      expect(res.status).toBe(403);
    });

    it('14. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/audit-logs/filter-options');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/audit-logs/export', () => {
    it('15. Успешно возвращает Excel-файл', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-export@test.local' });

      await db('audit_logs').insert({
        actor_id: user.id,
        actor_role: user.role,
        event_type: 'LOGIN',
        event_label: 'Логин',
        entity_type: 'user',
        entity_id: user.id,
        before: null,
        after: JSON.stringify({ email: user.email }),
        ip: '127.0.0.1',
        result: 'success',
      });

      const res = await agent.get('/api/audit-logs/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    it('16. Экспорт с фильтром actor_id применяет его корректно', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'audit-export-filter@test.local' });
      const { user: otherUser } = await loginAs({ role: 'admin', email: 'audit-export-filter2@test.local' });

      await db('audit_logs').insert([
        {
          actor_id: user.id,
          actor_role: user.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: user.id,
          before: null,
          after: JSON.stringify({ email: user.email }),
          ip: '127.0.0.1',
          result: 'success',
        },
        {
          actor_id: otherUser.id,
          actor_role: otherUser.role,
          event_type: 'LOGIN',
          event_label: 'Логин',
          entity_type: 'user',
          entity_id: otherUser.id,
          before: null,
          after: JSON.stringify({ email: otherUser.email }),
          ip: '127.0.0.1',
          result: 'success',
        },
      ]);

      const res = await agent.get(`/api/audit-logs/export?actor_id=${user.id}`);
      expect(res.status).toBe(200);
    });

    it('17. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'audit-export-user@test.local' });
      const res = await agent.get('/api/audit-logs/export');
      expect(res.status).toBe(403);
    });

    it('18. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/audit-logs/export');
      expect(res.status).toBe(401);
    });
  });
});
