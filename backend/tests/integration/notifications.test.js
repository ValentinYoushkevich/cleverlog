import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { NotificationService } from '../../src/services/notification.service.js';
import { loginAs } from '../helpers/auth.js';

vi.mock('../../src/utils/mailer.js', () => ({
  mailer: {
    sendMail: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Notification module', () => {
  beforeEach(async () => {
    await db('notification_settings').del();
  });

  describe('GET /api/notifications/settings', () => {
    it('1. Возвращает глобальные настройки уведомлений (дефолт true)', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'notif-global-get@test.local' });

      const res = await agent.get('/api/notifications/settings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('global_enabled');
      expect(res.body.global_enabled).toBe(true);
    });

    it('2. Возвращает актуальное значение после обновления', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'notif-global-update@test.local' });

      let res = await agent
        .patch('/api/notifications/settings')
        .send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.global_enabled).toBe(false);

      res = await agent.get('/api/notifications/settings');
      expect(res.status).toBe(200);
      expect(res.body.global_enabled).toBe(false);
    });

    it('3. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'notif-global-user@test.local' });
      const res = await agent.get('/api/notifications/settings');
      expect(res.status).toBe(403);
    });

    it('4. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/notifications/settings');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/notifications/settings', () => {
    it('5. Успешное отключение глобальных уведомлений', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'notif-global-disable@test.local' });

      const res = await agent
        .patch('/api/notifications/settings')
        .send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.global_enabled).toBe(false);
    });

    it('6. Успешное включение глобальных уведомлений', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'notif-global-enable@test.local' });

      await agent
        .patch('/api/notifications/settings')
        .send({ enabled: false });

      const res = await agent
        .patch('/api/notifications/settings')
        .send({ enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.global_enabled).toBe(true);
    });

    it('7. Повторный PATCH работает как upsert', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'notif-global-upsert@test.local' });

      let res = await agent
        .patch('/api/notifications/settings')
        .send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.global_enabled).toBe(false);

      res = await agent
        .patch('/api/notifications/settings')
        .send({ enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.global_enabled).toBe(true);
    });

    it('8. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'notif-global-patch-user@test.local' });

      const res = await agent
        .patch('/api/notifications/settings')
        .send({ enabled: false });
      expect(res.status).toBe(403);
    });

    it('9. Без токена возвращает 401', async () => {
      const res = await request(app)
        .patch('/api/notifications/settings')
        .send({ enabled: false });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/notifications/users/:userId', () => {
    it('10. Успешное отключение уведомлений для конкретного пользователя', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'notif-user-disable@test.local' });

      const res = await agent
        .patch(`/api/notifications/users/${user.id}`)
        .send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });

    it('11. Успешное включение уведомлений для пользователя', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'notif-user-enable@test.local' });

      await agent
        .patch(`/api/notifications/users/${user.id}`)
        .send({ enabled: false });

      const res = await agent
        .patch(`/api/notifications/users/${user.id}`)
        .send({ enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });

    it('12. Повторный PATCH работает как upsert', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'notif-user-upsert@test.local' });

      let res = await agent
        .patch(`/api/notifications/users/${user.id}`)
        .send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);

      res = await agent
        .patch(`/api/notifications/users/${user.id}`)
        .send({ enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });

    it('13. Обычный пользователь получает 403', async () => {
      const { user } = await loginAs({ role: 'admin', email: 'notif-user-admin@test.local' });
      const { agent: userAgent } = await loginAs({ email: 'notif-user-simple@test.local' });

      const res = await userAgent
        .patch(`/api/notifications/users/${user.id}`)
        .send({ enabled: false });
      expect(res.status).toBe(403);
    });

    it('14. Без токена возвращает 401', async () => {
      const { user } = await loginAs({ role: 'admin', email: 'notif-user-no-token-admin@test.local' });
      const res = await request(app)
        .patch(`/api/notifications/users/${user.id}`)
        .send({ enabled: false });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/notifications/trigger', () => {
    it('15. Успешный вызов trigger возвращает 200 (в development)', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const { agent } = await loginAs({ role: 'admin', email: 'notif-trigger-admin@test.local' });
      const spy = vi.spyOn(NotificationService, 'sendMonthlyReminders').mockResolvedValue(undefined);

      const res = await agent.post('/api/notifications/trigger');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Рассылка запущена вручную');
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
      process.env.NODE_ENV = oldEnv;
    });

    it('16. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'notif-trigger-user@test.local' });
      const res = await agent.post('/api/notifications/trigger');
      expect(res.status).toBe(403);
    });

    it('17. Без токена возвращает 401', async () => {
      const res = await request(app).post('/api/notifications/trigger');
      expect(res.status).toBe(401);
    });
  });
});
