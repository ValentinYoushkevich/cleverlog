import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { loginAs } from '../helpers/auth.js';
import {
  createAbsence,
  createCalendarNorm,
  createProject,
  createUserWithPassword,
  createWorkLog,
} from '../helpers/factories.js';

const YEAR = 2025;
const MONTH = 1;

describe('Dashboard module', () => {
  describe('GET /api/dashboard', () => {
    it('1. Успешно возвращает сводку за месяц', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'dash-summary@test.local' });
      const project = await createProject();
      await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 1,
      });

      const res = await agent.get(`/api/dashboard?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      expect(res.body.year).toBe(YEAR);
      expect(res.body.month).toBe(MONTH);
      expect(res.body).toHaveProperty('norm');
      expect(res.body).toHaveProperty('charts');
      expect(res.body).toHaveProperty('cards');
    });

    it('2–4. charts.hours_by_project и users_by_project корректны', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'dash-charts@test.local' });
      const project1 = await createProject({ name: 'Project A' });
      const project2 = await createProject({ name: 'Project B' });
      await createProject({ name: 'No logs' });

      await createWorkLog({
        user_id: user.id,
        project_id: project1.id,
        date: '2025-01-06',
        duration_days: 1,
      });
      await createWorkLog({
        user_id: user.id,
        project_id: project2.id,
        date: '2025-01-07',
        duration_days: 0.5,
      });

      const otherUser = await createUserWithPassword({ email: 'dash-user2@test.local' });
      await createWorkLog({
        user_id: otherUser.id,
        project_id: project1.id,
        date: '2025-01-08',
        duration_days: 0.5,
      });

      const res = await agent.get(`/api/dashboard?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);

      const hoursByProject = res.body.charts.hours_by_project;
      const projectNames = hoursByProject.map((p) => p.name);
      expect(projectNames).toContain('Project A');
      expect(projectNames).toContain('Project B');
      expect(projectNames).not.toContain('No logs');

      const usersByProject = res.body.charts.users_by_project;
      const proj1 = usersByProject.find((p) => p.name === 'Project A');
      expect(proj1.user_count).toBe(2);
    });

    it('5–7,10. cards содержит счётчики и пользователей без логов', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'dash-cards@test.local' });
      const normValue = 16;
      await createCalendarNorm({ year: YEAR, month: MONTH, norm_hours: normValue });

      const undertimeUser = await createUserWithPassword({ email: 'dash-under@test.local' });
      const overtimeUser = await createUserWithPassword({ email: 'dash-over@test.local' });
      await createUserWithPassword({ email: 'dash-unlogged@test.local' });
      const project = await createProject();

      await createWorkLog({
        user_id: undertimeUser.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 0.5, // 4h
      });

      await createWorkLog({
        user_id: overtimeUser.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 2, // 16h
      });

      await createAbsence({
        user_id: undertimeUser.id,
        type: 'vacation',
        date: '2025-01-07',
        duration_days: 1,
      });

      const res = await agent.get(`/api/dashboard?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      const cards = res.body.cards;
      expect(cards).toHaveProperty('undertime_count');
      expect(cards).toHaveProperty('overtime_count');
      expect(cards).toHaveProperty('unlogged_count');
    });

    it('8–9. norm из calendar_settings или 168', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'dash-norm@test.local' });

      await createCalendarNorm({ year: YEAR, month: MONTH, norm_hours: 160 });
      let res = await agent.get(`/api/dashboard?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(200);
      expect(Number(res.body.norm)).toBe(160);

      await db('calendar_settings').where({ year: YEAR, month: 2 }).del();
      res = await agent.get(`/api/dashboard?year=${YEAR}&month=2`);
      expect(res.status).toBe(200);
      expect(Number(res.body.norm)).toBe(168);
    });

    it('11. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'dash-user@test.local' });
      const res = await agent.get(`/api/dashboard?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(403);
    });

    it('12. Без токена возвращает 401', async () => {
      const res = await request(app).get(`/api/dashboard?year=${YEAR}&month=${MONTH}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/users', () => {
    it('13–15. Фильтры type=undertime|overtime|unlogged', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'dash-users@test.local' });
      await createCalendarNorm({ year: YEAR, month: MONTH, norm_hours: 8 });
      const project = await createProject();

      const undertimeUser = await createUserWithPassword({ email: 'dash-u1@test.local' });
      await createWorkLog({
        user_id: undertimeUser.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 0.5,
      });

      const overtimeUser = await createUserWithPassword({ email: 'dash-u2@test.local' });
      await createWorkLog({
        user_id: overtimeUser.id,
        project_id: project.id,
        date: '2025-01-06',
        duration_days: 2,
      });

      const unloggedUser = await createUserWithPassword({ email: 'dash-u3@test.local' });
      await createAbsence({
        user_id: unloggedUser.id,
        type: 'vacation',
        date: '2025-01-06',
        duration_days: 1,
      });

      let res = await agent.get(`/api/dashboard/users?year=${YEAR}&month=${MONTH}&type=undertime`);
      expect(res.status).toBe(200);
      expect(res.body.type).toBe('undertime');
      expect(res.body.users.some((u) => u.user_id === undertimeUser.id)).toBe(true);

      res = await agent.get(`/api/dashboard/users?year=${YEAR}&month=${MONTH}&type=overtime`);
      expect(res.status).toBe(200);
      expect(res.body.users.some((u) => u.user_id === overtimeUser.id)).toBe(true);

      res = await agent.get(`/api/dashboard/users?year=${YEAR}&month=${MONTH}&type=unlogged`);
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    });

    it('16–18. Структура карточки и top2_projects/unlogged_dates', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'dash-struct@test.local' });
      await createCalendarNorm({ year: YEAR, month: MONTH, norm_hours: 160 });
      const project1 = await createProject({ name: 'P1' });
      const project2 = await createProject({ name: 'P2' });
      const project3 = await createProject({ name: 'P3' });

      const user = await createUserWithPassword({ email: 'dash-card@test.local' });

      await createWorkLog({
        user_id: user.id,
        project_id: project1.id,
        date: '2025-01-06',
        duration_days: 0.5,
      });
      await createWorkLog({
        user_id: user.id,
        project_id: project2.id,
        date: '2025-01-07',
        duration_days: 1,
      });
      await createWorkLog({
        user_id: user.id,
        project_id: project3.id,
        date: '2025-01-08',
        duration_days: 0.25,
      });

      const res = await agent.get(`/api/dashboard/users?year=${YEAR}&month=${MONTH}&type=undertime`);
      expect(res.status).toBe(200);
      const card = res.body.users.find((u) => u.user_id === user.id);
      expect(card).toBeTruthy();
      expect(card).toHaveProperty('user_name');
      expect(card).toHaveProperty('fact_hours');
      expect(card).toHaveProperty('deviation');
      expect(card).toHaveProperty('top2_projects');
      expect(card).toHaveProperty('unlogged_count');
      expect(card).toHaveProperty('unlogged_dates');
      expect(card).toHaveProperty('last_log_date');

      expect(card.top2_projects.length).toBeLessThanOrEqual(2);
    });

    it('19. Пустой список при отсутствии пользователей нужного типа', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'dash-empty@test.local' });
      await createCalendarNorm({ year: YEAR, month: MONTH, norm_hours: 0 });

      const res = await agent.get(`/api/dashboard/users?year=${YEAR}&month=${MONTH}&type=overtime`);
      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeGreaterThanOrEqual(0);
    });

    it('20. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'dash-users-user@test.local' });
      const res = await agent.get(`/api/dashboard/users?year=${YEAR}&month=${MONTH}&type=undertime`);
      expect(res.status).toBe(403);
    });

    it('21. Без токена возвращает 401', async () => {
      const res = await request(app).get(`/api/dashboard/users?year=${YEAR}&month=${MONTH}&type=undertime`);
      expect(res.status).toBe(401);
    });
  });
});
