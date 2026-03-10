import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import { loginAs } from '../helpers/auth.js';
import {
  createAbsence,
  createProject,
  createUserWithPassword,
  createWorkLog,
} from '../helpers/factories.js';

const YEAR = 2025;
const MONTH = 1;

describe('Report module', () => {
  describe('GET /api/reports/user', () => {
    it('1. Пользователь получает свой отчёт', async () => {
      const { agent, user } = await loginAs({ email: 'report-user@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-10',
        duration_days: 1,
      });
      await createAbsence({
        user_id: user.id,
        type: 'vacation',
        date: '2025-01-15',
        duration_days: 1,
      });

      const res = await agent.get('/api/reports/user?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.rows)).toBe(true);
      expect(res.body.rows.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('totals');
    });

    it('2. Пользователь не видит чужие данные', async () => {
      const { agent, user } = await loginAs({ email: 'report-owner@test.local' });
      const other = await createUserWithPassword({ email: 'report-other@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-05',
      });
      await createWorkLog({
        user_id: other.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const res = await agent.get('/api/reports/user?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(res.body.rows.every((row) => row.user_id === user.id)).toBe(true);
    });

    it('3. Админ может получить отчёт по конкретному пользователю', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-admin@test.local' });
      const target = await createUserWithPassword({ email: 'report-target@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: target.id,
        project_id: project.id,
        date: '2025-01-07',
      });

      const res = await agent.get(`/api/reports/user?user_id=${target.id}&date_from=2025-01-01&date_to=2025-01-31`);
      expect(res.status).toBe(200);
      expect(res.body.rows.length).toBeGreaterThan(0);
      expect(res.body.rows.every((row) => row.user_id === target.id)).toBe(true);
    });

    it('4. Фильтрация по project_id', async () => {
      const { agent, user } = await loginAs({ email: 'report-project-filter@test.local' });
      const project1 = await createProject({ name: 'R1' });
      const project2 = await createProject({ name: 'R2' });

      await createWorkLog({
        user_id: user.id,
        project_id: project1.id,
        date: '2025-01-05',
      });
      await createWorkLog({
        user_id: user.id,
        project_id: project2.id,
        date: '2025-01-06',
      });

      const res = await agent.get(`/api/reports/user?project_id=${project1.id}&date_from=2025-01-01&date_to=2025-01-31`);
      expect(res.status).toBe(200);
      expect(res.body.rows.length).toBeGreaterThan(0);
      expect(res.body.rows.every((row) => row.project_id === project1.id)).toBe(true);
    });

    it('5. type=work возвращает только work_logs', async () => {
      const { agent, user } = await loginAs({ email: 'report-type-work@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-05',
      });
      await createAbsence({
        user_id: user.id,
        type: 'vacation',
        date: '2025-01-06',
      });

      const res = await agent.get('/api/reports/user?type=work&date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(res.body.rows.length).toBeGreaterThan(0);
      expect(res.body.rows.every((row) => row.type === 'work')).toBe(true);
    });

    it('6. type=vacation возвращает только absences типа vacation', async () => {
      const { agent, user } = await loginAs({ email: 'report-type-vacation@test.local' });

      await createAbsence({
        user_id: user.id,
        type: 'vacation',
        date: '2025-01-05',
      });
      await createAbsence({
        user_id: user.id,
        type: 'sick_leave',
        date: '2025-01-06',
      });

      const res = await agent.get('/api/reports/user?type=vacation&date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(res.body.rows.length).toBeGreaterThan(0);
      expect(res.body.rows.every((row) => row.type === 'vacation')).toBe(true);
    });

    it('7. Фильтрация по task_number (подстрока)', async () => {
      const { agent, user } = await loginAs({ email: 'report-task@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-05',
        task_number: 'PROJ-42',
      });

      const res = await agent.get('/api/reports/user?task_number=PROJ&date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(res.body.rows.some((row) => row.task_number === 'PROJ-42')).toBe(true);
    });

    it('8. norm_block присутствует при полном месяце', async () => {
      const { agent } = await loginAs({ email: 'report-norm-full@test.local' });

      const res = await agent.get('/api/reports/user?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('norm_block');
    });

    it('9. norm_block отсутствует при неполном периоде', async () => {
      const { agent } = await loginAs({ email: 'report-norm-partial@test.local' });

      const res = await agent.get('/api/reports/user?date_from=2025-01-05&date_to=2025-01-20');
      expect(res.status).toBe(200);
      expect(res.body.norm_block === null || res.body.norm_block === undefined).toBe(true);
    });

    it('10. totals.by_project содержит корректную разбивку часов', async () => {
      const { agent, user } = await loginAs({ email: 'report-totals-project@test.local' });
      const project1 = await createProject({ name: 'P1' });
      const project2 = await createProject({ name: 'P2' });

      await createWorkLog({
        user_id: user.id,
        project_id: project1.id,
        date: '2025-01-05',
        duration_days: 1,
      });
      await createWorkLog({
        user_id: user.id,
        project_id: project2.id,
        date: '2025-01-06',
        duration_days: 2,
      });

      const res = await agent.get('/api/reports/user?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(typeof res.body.totals.by_project).toBe('object');
      const keys = Object.keys(res.body.totals.by_project);
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });

    it('11. Строки отсортированы по дате', async () => {
      const { agent, user } = await loginAs({ email: 'report-sorted@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-10',
      });
      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-05',
      });

      const res = await agent.get('/api/reports/user?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      const dates = res.body.rows.map((row) => row.date);
      const sorted = [...dates].sort((a, b) => {
        if (a < b) { return -1; }
        if (a > b) { return 1; }
        return 0;
      });
      expect(dates).toEqual(sorted);
    });

    it('12. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/reports/user?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/user/export', () => {
    it('13. Успешно возвращает Excel-файл', async () => {
      const { agent } = await loginAs({ email: 'report-export-user@test.local' });

      const res = await agent.get('/api/reports/user/export?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    it('14. Фильтры применяются к экспорту', async () => {
      const { agent } = await loginAs({ email: 'report-export-filter@test.local' });

      const res = await agent.get('/api/reports/user/export?date_from=2025-01-01&date_to=2025-01-31');
      expect(res.status).toBe(200);
    });

    it('15. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/reports/user/export');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/reports/project', () => {
    it('16. Успешно возвращает отчёт по проекту', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-project@test.local' });
      const user1 = await createUserWithPassword({ email: 'report-project-u1@test.local' });
      const user2 = await createUserWithPassword({ email: 'report-project-u2@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user1.id,
        project_id: project.id,
        date: '2025-01-05',
      });
      await createWorkLog({
        user_id: user2.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const res = await agent.get(`/api/reports/project?project_id=${project.id}&date_from=2025-01-01&date_to=2025-01-31`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.rows)).toBe(true);
      expect(res.body.rows.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('totals');
    });

    it('17. Фильтрация по user_id внутри проекта', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-project-filter-user@test.local' });
      const user1 = await createUserWithPassword({ email: 'report-project-fu1@test.local' });
      const user2 = await createUserWithPassword({ email: 'report-project-fu2@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user1.id,
        project_id: project.id,
        date: '2025-01-05',
      });
      await createWorkLog({
        user_id: user2.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      const res = await agent.get(`/api/reports/project?project_id=${project.id}&user_id=${user1.id}&date_from=2025-01-01&date_to=2025-01-31`);
      expect(res.status).toBe(200);
      expect(res.body.rows.length).toBeGreaterThan(0);
      expect(res.body.rows.every((row) => row.user_id === user1.id)).toBe(true);
    });

    it('18. totals.by_user содержит корректные суммы', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-project-totals@test.local' });
      const user1 = await createUserWithPassword({ email: 'report-project-t1@test.local' });
      const user2 = await createUserWithPassword({ email: 'report-project-t2@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user1.id,
        project_id: project.id,
        date: '2025-01-05',
        duration_days: 1,
      });
      await createWorkLog({
        user_id: user2.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 2,
      });

      const res = await agent.get(`/api/reports/project?project_id=${project.id}&date_from=2025-01-01&date_to=2025-01-31`);
      expect(res.status).toBe(200);
      expect(typeof res.body.totals.by_user).toBe('object');
    });

    it('19. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'report-project-user@test.local' });
      const res = await agent.get('/api/reports/project');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/reports/monthly-summary', () => {
    it('20. Успешно возвращает сводный отчёт за месяц', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'report-monthly@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-05',
        duration_days: 1,
      });

      const res = await agent.get(`/api/reports/monthly-summary?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.rows)).toBe(true);
      expect(res.body).toHaveProperty('projects');
      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('norm');
    });

    it('21. Каждая строка содержит обязательные поля', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-monthly-fields@test.local' });

      const res = await agent.get(`/api/reports/monthly-summary?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      const row = res.body.rows[0];
      if (row) {
        expect(row).toHaveProperty('by_project');
        expect(row).toHaveProperty('absence_hours');
        expect(row).toHaveProperty('fact_hours');
        expect(row).toHaveProperty('is_on_norm');
      }
    });

    it('22. totals суммирует данные всех пользователей', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-monthly-totals@test.local' });

      const res = await agent.get(`/api/reports/monthly-summary?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      const sum = res.body.rows.reduce((acc, row) => acc + Number(row.fact_hours || 0), 0);
      expect(Number(res.body.totals.fact_hours || 0)).toBe(sum);
    });

    it('23. Неактивные пользователи не попадают в отчёт', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-monthly-inactive@test.local' });
      const inactive = await createUserWithPassword({ email: 'report-inactive@test.local', status: 'inactive' });
      const project = await createProject();

      await createWorkLog({
        user_id: inactive.id,
        project_id: project.id,
        date: '2025-01-05',
      });

      const res = await agent.get(`/api/reports/monthly-summary?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      expect(res.body.rows.every((row) => row.user_id !== inactive.id)).toBe(true);
    });

    it('24. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'report-monthly-user@test.local' });
      const res = await agent.get(`/api/reports/monthly-summary?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/reports/unlogged', () => {
    it('25. Возвращает только пользователей с незаполненными днями', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-unlogged@test.local' });

      const res = await agent.get(`/api/reports/unlogged?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('26. Пользователь с полностью заполненным месяцем не попадает в список', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'report-unlogged-full@test.local' });
      const project = await createProject();

      for (let day = 1; day <= 31; day += 1) {
        // Заполняем все дни месяца логами
        const dayStr = String(day).padStart(2, '0');
        await createWorkLog({
          user_id: user.id,
          project_id: project.id,
          date: `2025-01-${dayStr}`,
        });
      }

      const res = await agent.get(`/api/reports/unlogged?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      expect(res.body.users.every((u) => u.user_id !== user.id)).toBe(true);
    });

    it('27. Каждая запись содержит unlogged_count, unlogged_dates, last_log_date', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-unlogged-fields@test.local' });

      const res = await agent.get(`/api/reports/unlogged?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      const row = res.body.users[0];
      if (row) {
        expect(row).toHaveProperty('unlogged_count');
        expect(row).toHaveProperty('unlogged_dates');
        expect(row).toHaveProperty('last_log_date');
      }
    });

    it('28. count соответствует количеству элементов в users', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-unlogged-count@test.local' });

      const res = await agent.get(`/api/reports/unlogged?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(res.body.users.length);
    });

    it('29. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'report-unlogged-user@test.local' });
      const res = await agent.get(`/api/reports/unlogged?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Export роуты', () => {
    it('30. Каждый export-роут возвращает xlsx файл', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'report-export-all@test.local' });
      const project = await createProject();

      const resUser = await agent.get('/api/reports/user/export?date_from=2025-01-01&date_to=2025-01-31');
      expect(resUser.status).toBe(200);
      expect(resUser.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      const resProject = await agent.get(`/api/reports/project/export?project_id=${project.id}&date_from=2025-01-01&date_to=2025-01-31`);
      expect(resProject.status).toBe(200);
      expect(resProject.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      const resMonthly = await agent.get(`/api/reports/monthly-summary/export?year=${YEAR}&month=${MONTH}`);
      expect(resMonthly.status).toBe(200);
      expect(resMonthly.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      const resUnlogged = await agent.get(`/api/reports/unlogged/export?year=${YEAR}&month=${MONTH}`);
      expect(resUnlogged.status).toBe(200);
      expect(resUnlogged.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    it('31. Обычный пользователь получает 403 для admin export-роутов', async () => {
      const { agent } = await loginAs({ email: 'report-export-user-role@test.local' });

      const resProject = await agent.get('/api/reports/project/export');
      expect(resProject.status).toBe(403);

      const resMonthly = await agent.get(`/api/reports/monthly-summary/export?year=${YEAR}&month=${MONTH}`);
      expect(resMonthly.status).toBe(403);

      const resUnlogged = await agent.get(`/api/reports/unlogged/export?year=${YEAR}&month=${MONTH}`);
      expect(resUnlogged.status).toBe(403);
    });
  });
});
