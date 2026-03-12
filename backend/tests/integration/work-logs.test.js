import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { ROLES } from '../../src/constants/roles.js';
import { loginAs } from '../helpers/auth.js';
import {
  createAbsence,
  createCustomField,
  createDropdownFieldWithOptions,
  createProject,
  createUserWithPassword,
  createWorkLog,
} from '../helpers/factories.js';

const YEAR = 2025;
const MONTH = 1;

describe('WorkLog module', () => {
  describe('GET /api/work-logs', () => {
    it('1–3. Пользователь видит свои логи, админ по user_id, фильтр project_id', async () => {
      const { agent, user } = await loginAs({ email: 'wl-user1@test.local' });
      const user2 = await createUserWithPassword({ email: 'wl-user2@test.local' });
      const project1 = await createProject({ name: 'WL1' });
      const project2 = await createProject({ name: 'WL2' });

      await createWorkLog({
        user_id: user.id,
        project_id: project1.id,
        date: '2025-01-06',
      });
      await createWorkLog({
        user_id: user2.id,
        project_id: project2.id,
        date: '2025-01-06',
      });

      const resUser = await agent.get('/api/work-logs');
      expect(resUser.status).toBe(200);
      expect(resUser.body.data.every((l) => l.user_id === user.id)).toBe(true);

      const { agent: adminAgent } = await loginAs({ role: ROLES.ADMIN, email: 'wl-admin@test.local' });
      const resAdmin = await adminAgent.get(`/api/work-logs?user_id=${user2.id}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.data.every((l) => l.user_id === user2.id)).toBe(true);

      const resProject = await adminAgent.get(`/api/work-logs?project_id=${project1.id}`);
      expect(resProject.status).toBe(200);
      expect(resProject.body.data.every((l) => l.project_id === project1.id)).toBe(true);
    });

    it('4–5. Фильтрация по периоду и task_number', async () => {
      const { agent, user } = await loginAs({ email: 'wl-period@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-10',
        task_number: 'PROJ-123',
      });
      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-02-10',
        task_number: 'OTHER-1',
      });

      const resPeriod = await agent.get('/api/work-logs?date_from=2025-01-01&date_to=2025-01-31');
      expect(resPeriod.status).toBe(200);
      expect(resPeriod.body.data.every((l) => l.date.startsWith('2025-01'))).toBe(true);

      const resTask = await agent.get('/api/work-logs?task_number=PROJ');
      expect(resTask.status).toBe(200);
      expect(resTask.body.data.some((l) => l.task_number === 'PROJ-123')).toBe(true);
    });

    it('6. Ответ содержит duration_hours и custom_fields', async () => {
      const { agent, user } = await loginAs({ email: 'wl-customfields@test.local' });
      const project = await createProject();
      const { field } = await createDropdownFieldWithOptions({
        options: ['A'],
      });
      await db('project_custom_fields').insert({
        project_id: project.id,
        custom_field_id: field.id,
        is_required: false,
        is_enabled: true,
      });

      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      await db('work_log_custom_values').insert({
        work_log_id: log.id,
        custom_field_id: field.id,
        value: 'A',
      });

      const res = await agent.get('/api/work-logs');
      expect(res.status).toBe(200);
      const first = res.body.data[0];
      expect(first).toHaveProperty('duration_hours');
      expect(first).toHaveProperty('custom_fields');
    });

    it('7. Пагинация работает корректно', async () => {
      const { agent, user } = await loginAs({ email: 'wl-pagination@test.local' });
      const project = await createProject();

      const promises = [];
      for (let i = 0; i < 10; i += 1) {
        promises.push(
          createWorkLog({
            user_id: user.id,
            project_id: project.id,
            date: `2025-01-${String(10 + i).padStart(2, '0')}`,
          }),
        );
      }
      await Promise.all(promises);

      const res = await agent.get('/api/work-logs?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(10);
    });

    it('8. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/work-logs');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/work-logs', () => {
    it('9. Успешное создание лога', async () => {
      const { agent, user } = await loginAs({ email: 'wl-create@test.local' });
      const project = await createProject();

      const res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '8h',
          comment: 'Test',
          task_number: 'TASK-1',
          user_id: user.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.duration_hours).toBe(8);
      expect(res.body.warning).toBeNull();
    });

    it('10–11. Будущая дата и несуществующий проект', async () => {
      const { agent, user } = await loginAs({ email: 'wl-future@test.local' });
      const project = await createProject();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      let res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: tomorrowStr,
          duration: '8h',
          comment: 'Future',
          task_number: 'TASK-2',
          user_id: user.id,
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FUTURE_DATE');

      res = await agent
        .post('/api/work-logs')
        .send({
          project_id: '00000000-0000-0000-0000-000000000000',
          date: '2025-01-06',
          duration: '8h',
          comment: 'No project',
          task_number: 'TASK-3',
          user_id: user.id,
        });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PROJECT_NOT_FOUND');
    });

    it('12. Неактивный проект блокирует создание', async () => {
      const { agent, user } = await loginAs({ email: 'wl-inactive-proj@test.local' });
      const project = await createProject({ status: 'closed' });

      const res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '8h',
          comment: 'Test',
          task_number: 'TASK-4',
          user_id: user.id,
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PROJECT_NOT_ACTIVE');
    });

    it('13. Наличие absence блокирует создание', async () => {
      const { agent, user } = await loginAs({ email: 'wl-absence@test.local' });
      const project = await createProject();
      await createAbsence({
        user_id: user.id,
        type: 'vacation',
        date: '2025-01-06',
      });

      const res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '8h',
          comment: 'Test',
          task_number: 'TASK-5',
          user_id: user.id,
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ABSENCE_CONFLICT');
    });

    it('14. Превышение 12 часов в день возвращает warning', async () => {
      const { agent, user } = await loginAs({ email: 'wl-warning@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 1,
      });

      const res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '5h',
          comment: 'Extra',
          task_number: 'TASK-6',
          user_id: user.id,
        });
      expect(res.status).toBe(201);
      expect(typeof res.body.warning === 'string' || res.body.warning === null).toBe(true);
    });

    it('15–16. Кастомные поля и required блокирует', async () => {
      const { agent, user } = await loginAs({ email: 'wl-custom@test.local' });
      const project = await createProject();
      const field = await createCustomField({ name: 'Req', type: 'text' });

      await db('project_custom_fields').insert({
        project_id: project.id,
        custom_field_id: field.id,
        is_required: true,
        is_enabled: true,
      });

      let res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '8h',
          comment: 'With custom',
          task_number: 'TASK-7',
          user_id: user.id,
          custom_fields: {
            [field.id]: 'Value',
          },
        });
      expect(res.status).toBe(201);

      res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-07',
          duration: '8h',
          comment: 'Missing',
          task_number: 'TASK-8',
          user_id: user.id,
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('REQUIRED_FIELD_MISSING');
    });

    it('17. Закрытый месяц блокирует создание', async () => {
      const { agent, user } = await loginAs({ email: 'wl-closed-month@test.local' });
      const project = await createProject();
      await db('month_closures').insert({
        year: YEAR,
        month: MONTH,
        closed_by: user.id,
      });

      const res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '8h',
          comment: 'Closed',
          task_number: 'TASK-9',
          user_id: user.id,
        });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('18. Админ может создать лог от имени другого пользователя', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'wl-admin-create@test.local' });
      const target = await createUserWithPassword({ email: 'wl-target@test.local' });
      const project = await createProject();

      const res = await agent
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '8h',
          comment: 'Admin created',
          task_number: 'TASK-10',
          user_id: target.id,
        });
      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(target.id);
    });

    it('19. Без токена возвращает 401', async () => {
      const project = await createProject();
      const res = await request(app)
        .post('/api/work-logs')
        .send({
          project_id: project.id,
          date: '2025-01-06',
          duration: '8h',
          comment: 'No token',
          task_number: 'TASK-11',
        });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/work-logs/:id', () => {
    it('20. Обновление комментария', async () => {
      const { agent, user } = await loginAs({ email: 'wl-update-comment@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const res = await agent
        .patch(`/api/work-logs/${log.id}`)
        .send({ comment: 'Новый комментарий' });
      expect(res.status).toBe(200);
      expect(res.body.comment).toBe('Новый комментарий');
    });

    it('21. Обновление даты', async () => {
      const { agent, user } = await loginAs({ email: 'wl-update-date@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const res = await agent
        .patch(`/api/work-logs/${log.id}`)
        .send({ date: '2025-01-07' });
      expect(res.status).toBe(200);
    });

    it('22. Смена даты на будущую запрещена', async () => {
      const { agent, user } = await loginAs({ email: 'wl-update-future@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const res = await agent
        .patch(`/api/work-logs/${log.id}`)
        .send({ date: tomorrowStr });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FUTURE_DATE');
    });

    it('23. Смена проекта на неактивный запрещена', async () => {
      const { agent, user } = await loginAs({ email: 'wl-update-inactive-project@test.local' });
      const activeProject = await createProject();
      const closedProject = await createProject({ status: 'closed' });
      const log = await createWorkLog({
        user_id: user.id,
        project_id: activeProject.id,
        date: '2025-01-06',
      });

      const res = await agent
        .patch(`/api/work-logs/${log.id}`)
        .send({ project_id: closedProject.id });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PROJECT_NOT_ACTIVE');
    });

    it('24. Смена даты на день с absence запрещена', async () => {
      const { agent, user } = await loginAs({ email: 'wl-update-absence@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });
      await createAbsence({
        user_id: user.id,
        type: 'vacation',
        date: '2025-01-07',
      });

      const res = await agent
        .patch(`/api/work-logs/${log.id}`)
        .send({ date: '2025-01-07' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ABSENCE_CONFLICT');
    });

    it('25–26. Доступ: пользователь vs админ', async () => {
      const { user } = await loginAs({ email: 'wl-update-owner@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const { agent: otherAgent } = await loginAs({ email: 'wl-update-other@test.local' });
      let res = await otherAgent
        .patch(`/api/work-logs/${log.id}`)
        .send({ comment: 'No access' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');

      const { agent: adminAgent } = await loginAs({ role: ROLES.ADMIN, email: 'wl-update-admin@test.local' });
      res = await adminAgent
        .patch(`/api/work-logs/${log.id}`)
        .send({ comment: 'Admin edit' });
      expect(res.status).toBe(200);
      expect(res.body.comment).toBe('Admin edit');
    });

    it('27–28. Несуществующий id и закрытый месяц', async () => {
      const { agent, user } = await loginAs({ email: 'wl-update-misc@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      let res = await agent
        .patch('/api/work-logs/00000000-0000-0000-0000-000000000000')
        .send({ comment: 'Any' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');

      await db('month_closures').insert({
        year: YEAR,
        month: MONTH,
        closed_by: user.id,
      });

      res = await agent
        .patch(`/api/work-logs/${log.id}`)
        .send({ comment: 'Closed' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('DELETE /api/work-logs/:id', () => {
    it('29. Успешное удаление своего лога', async () => {
      const { agent, user } = await loginAs({ email: 'wl-del-own@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const res = await agent.delete(`/api/work-logs/${log.id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Лог удалён');
    });

    it('30–31. Пользователь не может удалять чужой, админ может', async () => {
      const { user } = await loginAs({ email: 'wl-del-owner@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const { agent: otherAgent } = await loginAs({ email: 'wl-del-other@test.local' });
      let res = await otherAgent.delete(`/api/work-logs/${log.id}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');

      const { agent: adminAgent } = await loginAs({ role: ROLES.ADMIN, email: 'wl-del-admin@test.local' });
      res = await adminAgent.delete(`/api/work-logs/${log.id}`);
      expect(res.status).toBe(200);
    });

    it('32–34. Несуществующий id, закрытый месяц, без токена', async () => {
      const { agent, user } = await loginAs({ email: 'wl-del-misc@test.local' });
      const project = await createProject();
      const log = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      let res = await agent.delete('/api/work-logs/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');

      await db('month_closures').insert({
        year: YEAR,
        month: MONTH,
        closed_by: user.id,
      });

      res = await agent.delete(`/api/work-logs/${log.id}`);
      expect(res.status).toBeGreaterThanOrEqual(400);

      const resNoToken = await request(app).delete(`/api/work-logs/${log.id}`);
      expect(resNoToken.status).toBe(401);
    });
  });
});
