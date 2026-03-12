import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { ROLES } from '../../src/constants/roles.js';
import { loginAs } from '../helpers/auth.js';
import {
  createAbsence,
  createCalendarNorm,
  createProject,
  createUserWithPassword,
  createWorkLog,
} from '../helpers/factories.js';

function dateStr(str) {
  return str;
}

describe('Absence module', () => {
  describe('GET /api/absences', () => {
    it('1. Пользователь видит только свои записи', async () => {
      const { agent, user } = await loginAs({ email: 'absence-self@test.local' });
      const other = await createUserWithPassword({ email: 'absence-other@test.local' });

      await createAbsence({ user_id: user.id, date: dateStr('2025-01-01') });
      await createAbsence({ user_id: user.id, date: dateStr('2025-01-02') });
      await createAbsence({ user_id: other.id, date: dateStr('2025-01-03') });

      const res = await agent.get('/api/absences');
      expect(res.status).toBe(200);
      expect(res.body.data.every((a) => a.user_id === user.id)).toBe(true);
    });

    it('2. Админ может получить записи конкретного пользователя через фильтр user_id', async () => {
      const target = await createUserWithPassword({ email: 'absence-filter@test.local' });
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'absence-admin@test.local' });

      await createAbsence({ user_id: target.id, date: dateStr('2025-02-01') });
      await createAbsence({ user_id: target.id, date: dateStr('2025-02-02') });

      const res = await agent.get(`/api/absences?user_id=${target.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.every((a) => a.user_id === target.id)).toBe(true);
    });

    it('3. Фильтрация по периоду date_from / date_to', async () => {
      const { agent, user } = await loginAs({ email: 'absence-period@test.local' });

      await createAbsence({ user_id: user.id, date: dateStr('2025-01-10') });
      await createAbsence({ user_id: user.id, date: dateStr('2025-01-20') });
      await createAbsence({ user_id: user.id, date: dateStr('2025-02-05') });

      const res = await agent.get('/api/absences?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(res.body.data.every((a) => a.date.startsWith('2025-01'))).toBe(true);
    });

    it('4. Фильтрация по типу', async () => {
      const { agent, user } = await loginAs({ email: 'absence-type@test.local' });

      await createAbsence({ user_id: user.id, type: 'vacation', date: dateStr('2025-01-10') });
      await createAbsence({ user_id: user.id, type: 'sick_leave', date: dateStr('2025-01-11') });

      const res = await agent.get('/api/absences?type=sick_leave');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].type).toBe('sick_leave');
    });

    it('5. Ответ содержит duration_hours', async () => {
      const { agent, user } = await loginAs({ email: 'absence-duration@test.local' });

      await createAbsence({ user_id: user.id, date: dateStr('2025-01-10'), duration_days: 1 });

      const res = await agent.get('/api/absences');
      expect(res.status).toBe(200);
      expect(res.body.data[0]).toHaveProperty('duration_hours');
      expect(res.body.data[0].duration_hours).toBeGreaterThan(0);
    });

    it('6. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/absences');
      expect(res.status).toBe(401);
    });

    it('7. Пагинация работает корректно', async () => {
      const { agent, user } = await loginAs({ email: 'absence-pagination@test.local' });

      for (let i = 0; i < 10; i += 1) {
         
        await createAbsence({
          user_id: user.id,
          date: dateStr(`2025-03-${String(i + 1).padStart(2, '0')}`),
        });
      }

      const res = await agent.get('/api/absences?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
      expect(res.body.pagination.total).toBe(10);
      expect(res.body.pagination.total_pages).toBe(2);
    });
  });

  describe('POST /api/absences', () => {
    it('8. Успешное создание на один рабочий день', async () => {
      const { agent } = await loginAs({ email: 'absence-create-one@test.local' });

      const res = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-06',
          date_to: '2025-01-06',
        });

      expect(res.status).toBe(201);
      expect(res.body.created.length).toBe(1);
      expect(res.body.skipped.weekends).toEqual([]);
    });

    it('9. Диапазон с выходными — выходные автоматически пропускаются', async () => {
      const { agent } = await loginAs({ email: 'absence-weekends@test.local' });

      const res = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-06',
          date_to: '2025-01-12',
        });

      expect(res.status).toBe(201);
      expect(res.body.created.length).toBe(5);
      expect(res.body.skipped.weekends.length).toBe(2);
    });

    it('10. Дни с существующим work_log пропускаются', async () => {
      const { agent, user } = await loginAs({ email: 'absence-worklog-skip@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-08',
      });

      const res = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-06',
          date_to: '2025-01-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.skipped.work_logs).toContain('2025-01-08');
      expect(res.body.created.some((c) => c.date === '2025-01-08')).toBe(false);
    });

    it('11. Дни с существующим absence пропускаются', async () => {
      const { agent, user } = await loginAs({ email: 'absence-absence-skip@test.local' });

      await createAbsence({ user_id: user.id, date: '2025-01-07' });

      const res = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-06',
          date_to: '2025-01-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.skipped.absences).toContain('2025-01-07');
    });

    it('12. Все дни заняты — возвращает ошибку', async () => {
      const { agent, user } = await loginAs({ email: 'absence-all-skipped@test.local' });
      const project = await createProject();

      const dates = ['2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09', '2025-01-10'];
      // заполняем ворклогами все рабочие дни
       
      for (const date of dates) { await createWorkLog({ user_id: user.id, project_id: project.id, date }); }

      const res = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-06',
          date_to: '2025-01-10',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ALL_DAYS_SKIPPED');
    });

    it('13. Диапазон полностью из выходных', async () => {
      const { agent } = await loginAs({ email: 'absence-weekend-only@test.local' });

      const res = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-11',
          date_to: '2025-01-12',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NO_WORKING_DAYS');
    });

    it('14. Закрытый месяц блокирует создание', async () => {
      const { agent, user } = await loginAs({ email: 'absence-closed-month@test.local' });
      await createCalendarNorm({ year: 2025, month: 1, norm_hours: 160 });
      await db('month_closures').insert({
        year: 2025,
        month: 1,
        closed_by: user.id,
      });

      const res = await agent
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-06',
          date_to: '2025-01-06',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('15. Без токена возвращает 401', async () => {
      const res = await request(app)
        .post('/api/absences')
        .send({
          type: 'vacation',
          date_from: '2025-01-06',
          date_to: '2025-01-06',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/absences/:id', () => {
    it('16. Успешное изменение типа', async () => {
      const { agent, user } = await loginAs({ email: 'absence-update-type@test.local' });
      const absence = await createAbsence({ user_id: user.id, type: 'vacation', date: '2025-01-06' });

      const res = await agent
        .patch(`/api/absences/${absence.id}`)
        .send({ type: 'sick_leave' });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('sick_leave');
    });

    it('17. Успешный перенос даты на другой рабочий день', async () => {
      const { agent, user } = await loginAs({ email: 'absence-move-date@test.local' });
      const absence = await createAbsence({ user_id: user.id, date: '2025-01-06' });

      const res = await agent
        .patch(`/api/absences/${absence.id}`)
        .send({ date: '2025-01-07' });

      expect(res.status).toBe(200);
      const updated = await db('absences').where({ id: absence.id }).first();
      expect(updated.date).not.toEqual(absence.date);
    });

    it('18. Перенос на выходной запрещён', async () => {
      const { agent, user } = await loginAs({ email: 'absence-weekend-move@test.local' });
      const absence = await createAbsence({ user_id: user.id, date: '2025-01-06' });

      const res = await agent
        .patch(`/api/absences/${absence.id}`)
        .send({ date: '2025-01-11' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WEEKEND_DATE');
    });

    it('19. Перенос на день с work_log запрещён', async () => {
      const { agent, user } = await loginAs({ email: 'absence-move-worklog@test.local' });
      const project = await createProject();
      const absence = await createAbsence({ user_id: user.id, date: '2025-01-06' });

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-07',
      });

      const res = await agent
        .patch(`/api/absences/${absence.id}`)
        .send({ date: '2025-01-07' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WORK_LOG_CONFLICT');
    });

    it('20. Перенос на день с другим absence запрещён', async () => {
      const { agent, user } = await loginAs({ email: 'absence-move-absence@test.local' });
      const first = await createAbsence({ user_id: user.id, date: '2025-01-06' });
      await createAbsence({ user_id: user.id, date: '2025-01-07' });

      const res = await agent
        .patch(`/api/absences/${first.id}`)
        .send({ date: '2025-01-07' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ABSENCE_CONFLICT');
    });

    it('21. Пользователь не может редактировать чужую запись', async () => {
      const owner = await createUserWithPassword({ email: 'absence-owner@test.local' });
      const absence = await createAbsence({ user_id: owner.id, date: '2025-01-06' });
      const { agent } = await loginAs({ email: 'absence-other-editor@test.local' });

      const res = await agent
        .patch(`/api/absences/${absence.id}`)
        .send({ type: 'sick_leave' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('22. Админ может редактировать чужую запись', async () => {
      const owner = await createUserWithPassword({ email: 'absence-owner2@test.local' });
      const absence = await createAbsence({ user_id: owner.id, date: '2025-01-06' });
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'absence-admin2@test.local' });

      const res = await agent
        .patch(`/api/absences/${absence.id}`)
        .send({ type: 'sick_leave' });

      expect(res.status).toBe(200);
    });

    it('23. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ email: 'absence-not-found@test.local' });

      const res = await agent
        .patch('/api/absences/00000000-0000-0000-0000-000000000000')
        .send({ type: 'sick_leave' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('24. Закрытый месяц блокирует редактирование', async () => {
      const { agent, user } = await loginAs({ email: 'absence-update-closed@test.local' });
      const absence = await createAbsence({ user_id: user.id, date: '2025-01-06' });
      await db('month_closures').insert({
        year: 2025,
        month: 1,
        closed_by: user.id,
      });

      const res = await agent
        .patch(`/api/absences/${absence.id}`)
        .send({ type: 'sick_leave' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('DELETE /api/absences/:id', () => {
    it('25. Успешное удаление своей записи', async () => {
      const { agent, user } = await loginAs({ email: 'absence-delete-own@test.local' });
      const absence = await createAbsence({ user_id: user.id, date: '2025-01-06' });

      const res = await agent.delete(`/api/absences/${absence.id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Запись удалена');

      const row = await db('absences').where({ id: absence.id }).first();
      expect(row).toBeUndefined();
    });

    it('26. Пользователь не может удалить чужую запись', async () => {
      const owner = await createUserWithPassword({ email: 'absence-del-owner@test.local' });
      const absence = await createAbsence({ user_id: owner.id, date: '2025-01-06' });
      const { agent } = await loginAs({ email: 'absence-del-other@test.local' });

      const res = await agent.delete(`/api/absences/${absence.id}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('27. Админ может удалить чужую запись', async () => {
      const owner = await createUserWithPassword({ email: 'absence-del-owner2@test.local' });
      const absence = await createAbsence({ user_id: owner.id, date: '2025-01-06' });
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'absence-del-admin@test.local' });

      const res = await agent.delete(`/api/absences/${absence.id}`);
      expect(res.status).toBe(200);
    });

    it('28. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ email: 'absence-del-notfound@test.local' });

      const res = await agent.delete('/api/absences/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('29. Закрытый месяц блокирует удаление', async () => {
      const { agent, user } = await loginAs({ email: 'absence-del-closed@test.local' });
      const absence = await createAbsence({ user_id: user.id, date: '2025-01-06' });
      await db('month_closures').insert({
        year: 2025,
        month: 1,
        closed_by: user.id,
      });

      const res = await agent.delete(`/api/absences/${absence.id}`);
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
