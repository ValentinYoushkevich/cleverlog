import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { loginAs } from '../helpers/auth.js';
import {
  createProject,
} from '../helpers/factories.js';

describe('Project module', () => {
  describe('GET /api/projects', () => {
    it('1–4. Список и фильтрация по статусу', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'proj-list@test.local' });
      const active = await createProject({ name: 'Active', status: 'active' });
      const onHold = await createProject({ name: 'OnHold', status: 'on_hold' });
      const closed = await createProject({ name: 'Closed', status: 'closed' });

      let res = await agent.get('/api/projects');
      expect(res.status).toBe(200);
      const ids = res.body.map((p) => p.id);
      expect(ids).toEqual(
        expect.arrayContaining([active.id, onHold.id, closed.id]),
      );

      res = await agent.get('/api/projects?status=active');
      expect(res.status).toBe(200);
      expect(res.body.every((p) => p.status === 'active')).toBe(true);

      res = await agent.get('/api/projects?status=on_hold');
      expect(res.status).toBe(200);
      expect(res.body.every((p) => p.status === 'on_hold')).toBe(true);
    });

    it('5. Обычный пользователь видит список проектов', async () => {
      const { agent } = await loginAs({ email: 'proj-user@test.local' });
      const res = await agent.get('/api/projects');
      expect(res.status).toBe(200);
    });

    it('6. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('7. Успешно возвращает проект по id', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'proj-get@test.local' });
      const project = await createProject({ name: 'ProjGet', status: 'active' });

      const res = await agent.get(`/api/projects/${project.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(project.id);
      expect(res.body.name).toBe('ProjGet');
    });

    it('8. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'proj-get-404@test.local' });
      const res = await agent.get('/api/projects/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('9. Обычный пользователь может получить проект', async () => {
      const { agent } = await loginAs({ email: 'proj-get-user@test.local' });
      const project = await createProject();
      const res = await agent.get(`/api/projects/${project.id}`);
      expect(res.status).toBe(200);
    });

    it('10. Без токена возвращает 401', async () => {
      const project = await createProject();
      const res = await request(app).get(`/api/projects/${project.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/projects', () => {
    it('11. Успешное создание проекта', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'proj-create@test.local' });

      const res = await agent
        .post('/api/projects')
        .send({ name: 'Новый проект' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Новый проект');
      expect(res.body.status).toBe('active');
    });

    it('12. Невалидные данные не проходят Zod', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'proj-create-invalid@test.local' });

      const res = await agent
        .post('/api/projects')
        .send({ name: '' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('13. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'proj-create-user@test.local' });

      const res = await agent
        .post('/api/projects')
        .send({ name: 'Проект' });

      expect(res.status).toBe(403);
    });

    it('14. Без токена возвращает 401', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Проект' });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('15–18. Переименование и смена статусов', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'proj-patch@test.local' });
      const project = await createProject({ name: 'Old', status: 'active' });

      let res = await agent
        .patch(`/api/projects/${project.id}`)
        .send({ name: 'Новое название' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Новое название');

      res = await agent
        .patch(`/api/projects/${project.id}`)
        .send({ status: 'on_hold' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('on_hold');

      res = await agent
        .patch(`/api/projects/${project.id}`)
        .send({ status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');

      res = await agent
        .patch(`/api/projects/${project.id}`)
        .send({ status: 'closed' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('closed');
    });

    it('19. Закрытый проект нельзя использовать для нового work_log', async () => {
      const { agent, user } = await loginAs({ role: 'admin', email: 'proj-closed-log@test.local' });
      const project = await createProject({ status: 'closed' });

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

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PROJECT_NOT_ACTIVE');
    });

    it('20. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ role: 'admin', email: 'proj-patch-404@test.local' });

      const res = await agent
        .patch('/api/projects/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Any' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('21. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'proj-patch-user@test.local' });
      const project = await createProject();

      const res = await agent
        .patch(`/api/projects/${project.id}`)
        .send({ name: 'New' });

      expect(res.status).toBe(403);
    });

    it('22. Без токена возвращает 401', async () => {
      const project = await createProject();

      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({ name: 'New' });

      expect(res.status).toBe(401);
    });
  });
});

