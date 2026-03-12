import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { ROLES } from '../../src/constants/roles.js';
import { loginAs } from '../helpers/auth.js';
import {
  createCustomField,
  createProject,
} from '../helpers/factories.js';

describe('ProjectCustomField module', () => {
  describe('GET /api/projects/:projectId/custom-fields', () => {
    it('1–3. Возвращает поля проекта, пустой список и не включает поля других проектов', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-get@test.local' });
      const project1 = await createProject({ name: 'PCF1' });
      const project2 = await createProject({ name: 'PCF2' });

      const field1 = await createCustomField({ name: 'Field1' });
      const field2 = await createCustomField({ name: 'Field2' });
      const fieldOther = await createCustomField({ name: 'FieldOther' });

      await db('project_custom_fields').insert([
        { project_id: project1.id, custom_field_id: field1.id, is_required: false, is_enabled: true },
        { project_id: project1.id, custom_field_id: field2.id, is_required: true, is_enabled: false },
        { project_id: project2.id, custom_field_id: fieldOther.id, is_required: false, is_enabled: true },
      ]);

      const res1 = await agent.get(`/api/projects/${project1.id}/custom-fields`);
      expect(res1.status).toBe(200);
      expect(res1.body.length).toBe(2);
      expect(res1.body.every((f) => f.project_id === project1.id)).toBe(true);

      const project3 = await createProject({ name: 'PCF3' });
      const res2 = await agent.get(`/api/projects/${project3.id}/custom-fields`);
      expect(res2.status).toBe(200);
      expect(res2.body.length).toBe(0);
    });

    it('4. Обычный пользователь может получить список', async () => {
      const { agent } = await loginAs({ email: 'pcf-user@test.local' });
      const project = await createProject();
      const res = await agent.get(`/api/projects/${project.id}/custom-fields`);
      expect(res.status).toBe(200);
    });

    it('5. Без токена возвращает 401', async () => {
      const project = await createProject();
      const res = await request(app).get(`/api/projects/${project.id}/custom-fields`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/projects/:projectId/custom-fields', () => {
    it('6. Успешная привязка поля к проекту', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-post@test.local' });
      const project = await createProject();
      const field = await createCustomField({ name: 'CF1' });

      const res = await agent
        .post(`/api/projects/${project.id}/custom-fields`)
        .send({ custom_field_id: field.id, is_required: false, is_enabled: true });

      expect(res.status).toBe(201);

      const list = await agent.get(`/api/projects/${project.id}/custom-fields`);
      expect(list.body.some((f) => f.custom_field_id === field.id)).toBe(true);
    });

    it('7. Повторная привязка одного и того же поля возвращает 409', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-already@test.local' });
      const project = await createProject();
      const field = await createCustomField({ name: 'CF2' });

      await agent
        .post(`/api/projects/${project.id}/custom-fields`)
        .send({ custom_field_id: field.id, is_required: false, is_enabled: true });

      const res = await agent
        .post(`/api/projects/${project.id}/custom-fields`)
        .send({ custom_field_id: field.id, is_required: false, is_enabled: true });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ALREADY_ATTACHED');
    });

    it('8–9. Привязка soft-deleted или несуществующего поля возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-notfound@test.local' });
      const project = await createProject();
      const field = await createCustomField({ name: 'CF3' });

      await db('custom_fields').where({ id: field.id }).update({ deleted_at: new Date() });

      const res1 = await agent
        .post(`/api/projects/${project.id}/custom-fields`)
        .send({ custom_field_id: field.id, is_required: false, is_enabled: true });

      expect(res1.status).toBe(404);
      expect(res1.body.code).toBe('NOT_FOUND');

      const res2 = await agent
        .post(`/api/projects/${project.id}/custom-fields`)
        .send({ custom_field_id: '00000000-0000-0000-0000-000000000000', is_required: false, is_enabled: true });

      expect(res2.status).toBe(404);
      expect(res2.body.code).toBe('NOT_FOUND');
    });

    it('10. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'pcf-post-user@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      const res = await agent
        .post(`/api/projects/${project.id}/custom-fields`)
        .send({ custom_field_id: field.id, is_required: false, is_enabled: true });

      expect(res.status).toBe(403);
    });

    it('11. Без токена возвращает 401', async () => {
      const project = await createProject();
      const field = await createCustomField();

      const res = await request(app)
        .post(`/api/projects/${project.id}/custom-fields`)
        .send({ custom_field_id: field.id, is_required: false, is_enabled: true });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/projects/:projectId/custom-fields/:fieldId', () => {
    it('12–13. Обновление is_required и is_enabled', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-patch-flags@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      await db('project_custom_fields').insert({
        project_id: project.id,
        custom_field_id: field.id,
        is_required: false,
        is_enabled: true,
      });

      const res1 = await agent
        .patch(`/api/projects/${project.id}/custom-fields/${field.id}`)
        .send({ is_required: true });
      expect(res1.status).toBe(200);
      expect(res1.body.is_required).toBe(true);

      const res2 = await agent
        .patch(`/api/projects/${project.id}/custom-fields/${field.id}`)
        .send({ is_enabled: false });
      expect(res2.status).toBe(200);
      expect(res2.body.is_enabled).toBe(false);
    });

    it('14. PATCH для не привязанного поля создаёт привязку (upsert)', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-upsert@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      const res = await agent
        .patch(`/api/projects/${project.id}/custom-fields/${field.id}`)
        .send({ is_enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.custom_field_id).toBe(field.id);
      expect(res.body.is_enabled).toBe(true);
    });

    it('15. PATCH для soft-deleted поля без привязки возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-patch-deleted@test.local' });
      const project = await createProject();
      const field = await createCustomField();
      await db('custom_fields').where({ id: field.id }).update({ deleted_at: new Date() });

      const res = await agent
        .patch(`/api/projects/${project.id}/custom-fields/${field.id}`)
        .send({ is_enabled: true });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('16. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'pcf-patch-user@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      const res = await agent
        .patch(`/api/projects/${project.id}/custom-fields/${field.id}`)
        .send({ is_enabled: true });

      expect(res.status).toBe(403);
    });

    it('17. Без токена возвращает 401', async () => {
      const project = await createProject();
      const field = await createCustomField();
      const res = await request(app)
        .patch(`/api/projects/${project.id}/custom-fields/${field.id}`)
        .send({ is_enabled: true });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/projects/:projectId/custom-fields/:fieldId', () => {
    it('18–20. Открепление поля и влияние на другие проекты', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-delete@test.local' });
      const project1 = await createProject({ name: 'PCF-Del-1' });
      const project2 = await createProject({ name: 'PCF-Del-2' });
      const field = await createCustomField();

      await db('project_custom_fields').insert([
        { project_id: project1.id, custom_field_id: field.id, is_required: false, is_enabled: true },
        { project_id: project2.id, custom_field_id: field.id, is_required: false, is_enabled: true },
      ]);

      const res = await agent.delete(`/api/projects/${project1.id}/custom-fields/${field.id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Поле откреплено от проекта');

      const list1 = await agent.get(`/api/projects/${project1.id}/custom-fields`);
      expect(list1.body.some((f) => f.custom_field_id === field.id)).toBe(false);

      const list2 = await agent.get(`/api/projects/${project2.id}/custom-fields`);
      expect(list2.body.some((f) => f.custom_field_id === field.id)).toBe(true);
    });

    it('19. Открепление не привязанного поля возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'pcf-delete-notfound@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      const res = await agent.delete(`/api/projects/${project.id}/custom-fields/${field.id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('21. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'pcf-delete-user@test.local' });
      const project = await createProject();
      const field = await createCustomField();

      const res = await agent.delete(`/api/projects/${project.id}/custom-fields/${field.id}`);
      expect(res.status).toBe(403);
    });

    it('22. Без токена возвращает 401', async () => {
      const project = await createProject();
      const field = await createCustomField();

      const res = await request(app).delete(`/api/projects/${project.id}/custom-fields/${field.id}`);
      expect(res.status).toBe(401);
    });
  });
});
