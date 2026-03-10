import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import { loginAs } from '../helpers/auth.js';
import { createCalendarNorm, createCalendarOverride } from '../helpers/factories.js';

describe('Calendar module', () => {
  describe('GET /api/calendar/:year/:month', () => {
    it('1. Успешно возвращает данные месяца', async () => {
      const { agent } = await loginAs({ email: 'calendar-month@test.local' });

      const res = await agent.get('/api/calendar/2025/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('year', 2025);
      expect(res.body).toHaveProperty('month', 1);
      expect(Array.isArray(res.body.days)).toBe(true);
    });

    it('2. Возвращает дефолтную норму 168 если норма не задана', async () => {
      const { agent } = await loginAs({ email: 'calendar-default-norm@test.local' });

      const res = await agent.get('/api/calendar/2025/3');
      expect(res.status).toBe(200);
      expect(res.body.norm_hours).toBe(168);
    });

    it('3. Возвращает кастомную норму если она задана', async () => {
      const { agent } = await loginAs({ email: 'calendar-custom-norm@test.local' });
      await createCalendarNorm({ year: 2025, month: 3, norm_hours: 150 });

      const res = await agent.get('/api/calendar/2025/3');
      expect(res.status).toBe(200);
      expect(Number(res.body.norm_hours)).toBe(150);
    });

    it('4. Дни содержат корректные статусы с учётом overrides', async () => {
      const { agent } = await loginAs({ email: 'calendar-override@test.local' });
      await createCalendarOverride({ date: '2025-01-06', day_type: 'holiday' });

      const res = await agent.get('/api/calendar/2025/1');
      expect(res.status).toBe(200);
      const day = res.body.days.find((d) => d.date === '2025-01-06');
      expect(day).toBeTruthy();
      expect(day.day_type).toBe('holiday');
    });

    it('5. Некорректный месяц возвращает 400', async () => {
      const { agent } = await loginAs({ email: 'calendar-bad-month@test.local' });

      const res = await agent.get('/api/calendar/2025/13');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PERIOD');
    });

    it('6. Некорректный год возвращает 400', async () => {
      const { agent } = await loginAs({ email: 'calendar-bad-year@test.local' });

      const res = await agent.get('/api/calendar/abc/1');
      expect(res.status).toBe(400);
    });

    it('7. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/calendar/2025/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/calendar/norm/:year/:month', () => {
    it('8. Возвращает норму для месяца', async () => {
      const { agent } = await loginAs({ email: 'calendar-get-norm@test.local' });
      await createCalendarNorm({ year: 2025, month: 6, norm_hours: 160 });

      const res = await agent.get('/api/calendar/norm/2025/6');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ year: 2025, month: 6 });
      expect(Number(res.body.norm_hours)).toBe(160);
    });

    it('9. Возвращает дефолт 168 если норма не задана', async () => {
      const { agent } = await loginAs({ email: 'calendar-norm-default2@test.local' });

      const res = await agent.get('/api/calendar/norm/2025/9');
      expect(res.status).toBe(200);
      expect(res.body.norm_hours).toBe(168);
    });

    it('10. Некорректный месяц возвращает 400', async () => {
      const { agent } = await loginAs({ email: 'calendar-norm-bad-month@test.local' });

      const res = await agent.get('/api/calendar/norm/2025/0');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PERIOD');
    });

    it('11. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/calendar/norm/2025/6');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/calendar/days/:date', () => {
    it('12. Админ успешно меняет статус дня', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'calendar-day-admin@test.local' });

      const res = await agent
        .patch('/api/calendar/days/2025-01-06')
        .send({ day_type: 'holiday' });

      expect(res.status).toBe(200);
      expect(res.body.day_type).toBe('holiday');
    });

    it('13. Повторный PATCH обновляет существующий override (upsert)', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'calendar-day-upsert@test.local' });

      await agent
        .patch('/api/calendar/days/2025-01-07')
        .send({ day_type: 'holiday' });

      const res = await agent
        .patch('/api/calendar/days/2025-01-07')
        .send({ day_type: 'weekend' });

      expect(res.status).toBe(200);
      expect(res.body.day_type).toBe('weekend');
    });

    it('14. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'calendar-day-user@test.local' });

      const res = await agent
        .patch('/api/calendar/days/2025-01-06')
        .send({ day_type: 'holiday' });

      expect(res.status).toBe(403);
    });

    it('15. Без токена возвращает 401', async () => {
      const res = await request(app)
        .patch('/api/calendar/days/2025-01-06')
        .send({ day_type: 'holiday' });

      expect(res.status).toBe(401);
    });

    it('16. Невалидный day_type не проходит валидацию', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'calendar-day-invalid@test.local' });

      const res = await agent
        .patch('/api/calendar/days/2025-01-06')
        .send({ day_type: 'unknown_type' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('PUT /api/calendar/norm/:year/:month', () => {
    it('17. Админ успешно устанавливает норму', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'calendar-put-norm@test.local' });

      const res = await agent
        .put('/api/calendar/norm/2025/4')
        .send({ norm_hours: 160 });

      expect(res.status).toBe(200);
      expect(Number(res.body.norm_hours)).toBe(160);
    });

    it('18. Повторный PUT обновляет существующую норму (upsert)', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'calendar-put-upsert@test.local' });

      await agent
        .put('/api/calendar/norm/2025/4')
        .send({ norm_hours: 150 });

      const res = await agent
        .put('/api/calendar/norm/2025/4')
        .send({ norm_hours: 155 });

      expect(res.status).toBe(200);
      expect(Number(res.body.norm_hours)).toBe(155);
    });

    it('19. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'calendar-put-user@test.local' });

      const res = await agent
        .put('/api/calendar/norm/2025/4')
        .send({ norm_hours: 160 });

      expect(res.status).toBe(403);
    });

    it('20. Без токена возвращает 401', async () => {
      const res = await request(app)
        .put('/api/calendar/norm/2025/4')
        .send({ norm_hours: 160 });

      expect(res.status).toBe(401);
    });

    it('21. Некорректный месяц возвращает 400', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'calendar-put-bad-period@test.local' });

      const res = await agent
        .put('/api/calendar/norm/2025/13')
        .send({ norm_hours: 160 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PERIOD');
    });
  });
});
