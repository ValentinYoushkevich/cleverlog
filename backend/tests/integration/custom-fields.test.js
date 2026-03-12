import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app.js';
import db from '../../src/config/knex.js';
import { ROLES } from '../../src/constants/roles.js';
import { loginAs } from '../helpers/auth.js';
import {
  createCustomField,
  createDropdownFieldWithOptions,
  createProject,
  createUserWithPassword,
  createWorkLog,
} from '../helpers/factories.js';

describe('CustomField module', () => {
  describe('GET /api/custom-fields', () => {
    it('1. Возвращает список активных полей (без удалённых)', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-list@test.local' });

      const active1 = await createCustomField({ name: 'Field 1', type: 'text' });
      const active2 = await createCustomField({ name: 'Field 2', type: 'number' });
      const deleted = await createCustomField({ name: 'Field deleted', type: 'text' });
      await db('custom_fields').where({ id: deleted.id }).update({ deleted_at: new Date() });

      const res = await agent.get('/api/custom-fields');
      expect(res.status).toBe(200);
      const ids = res.body.map((f) => f.id);
      expect(ids).toContain(active1.id);
      expect(ids).toContain(active2.id);
      expect(ids).not.toContain(deleted.id);
    });

    it('2. С параметром includeDeleted возвращает все поля', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-list-deleted@test.local' });

      const field = await createCustomField({ name: 'Field deleted 2', type: 'text' });
      await db('custom_fields').where({ id: field.id }).update({ deleted_at: new Date() });

      const res = await agent.get('/api/custom-fields?include_deleted=true');
      expect(res.status).toBe(200);
      expect(res.body.some((f) => f.id === field.id)).toBe(true);
    });

    it('3. Обычный пользователь получает 403', async () => {
      const { agent } = await loginAs({ email: 'cf-user@test.local' });

      const res = await agent.get('/api/custom-fields');
      expect(res.status).toBe(403);
    });

    it('4. Без токена возвращает 401', async () => {
      const res = await request(app).get('/api/custom-fields');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/custom-fields', () => {
    it('5. Успешное создание поля типа Text', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-create-text@test.local' });

      const res = await agent
        .post('/api/custom-fields')
        .send({ name: 'Задача', type: 'text' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe('text');
    });

    it('6. Успешное создание поля типа Dropdown с опциями', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-create-dd@test.local' });

      const res = await agent
        .post('/api/custom-fields')
        .send({
          name: 'Приоритет',
          type: 'dropdown',
          options: ['Низкий', 'Средний', 'Высокий'],
        });

      expect(res.status).toBe(201);
      const fieldId = res.body.id;

      const optRes = await agent.get(`/api/custom-fields/${fieldId}/options`);
      expect(optRes.status).toBe(200);
      expect(optRes.body.length).toBe(3);
    });

    it('7. Создание поля типа не-dropdown без опций — опции игнорируются', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-create-checkbox@test.local' });

      const res = await agent
        .post('/api/custom-fields')
        .send({
          name: 'Флаг',
          type: 'checkbox',
          options: ['A', 'B'],
        });

      expect(res.status).toBe(201);
      const fieldId = res.body.id;

      const optRes = await agent.get(`/api/custom-fields/${fieldId}/options`);
      expect(optRes.status).toBe(400);
      expect(optRes.body.code).toBe('NOT_DROPDOWN');
    });

    it('8. Невалидные данные не проходят Zod', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-create-invalid@test.local' });

      const res = await agent
        .post('/api/custom-fields')
        .send({ type: 'unknown' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('PATCH /api/custom-fields/:id', () => {
    it('9. Успешное переименование поля', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-rename@test.local' });
      const field = await createCustomField({ name: 'Old name', type: 'text' });

      const res = await agent
        .patch(`/api/custom-fields/${field.id}`)
        .send({ name: 'Новое имя' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Новое имя');
    });

    it('10. Смена типа разрешена если поле не используется', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-change-type-ok@test.local' });
      const field = await createCustomField({ name: 'Type change', type: 'text' });

      const res = await agent
        .patch(`/api/custom-fields/${field.id}`)
        .send({ type: 'number' });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe('number');
    });

    it('11. Смена типа запрещена если поле уже используется', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-change-type-used@test.local' });
      const field = await createCustomField({ name: 'Used field', type: 'text' });

      const user = await createUserWithPassword({ email: 'cf-used-user@test.local' });
      const project = await createProject();
      const workLog = await createWorkLog({
        user_id: user.id,
        project_id: project.id,
        date: '2025-01-06',
      });

      await db('work_log_custom_values').insert({
        work_log_id: workLog.id,
        custom_field_id: field.id,
        value: 'test',
      });

      const res = await agent
        .patch(`/api/custom-fields/${field.id}`)
        .send({ type: 'number' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('TYPE_CHANGE_FORBIDDEN');
    });

    it('12. PATCH удалённого поля возвращает 400', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-patch-deleted@test.local' });
      const field = await createCustomField({ name: 'To delete', type: 'text' });

      await db('custom_fields').where({ id: field.id }).update({ deleted_at: new Date() });

      const res = await agent
        .patch(`/api/custom-fields/${field.id}`)
        .send({ name: 'New name' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FIELD_DELETED');
    });

    it('13. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-patch-notfound@test.local' });

      const res = await agent
        .patch('/api/custom-fields/00000000-0000-0000-0000-000000000000')
        .send({ name: 'New name' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/custom-fields/:id', () => {
    it('14. Успешный soft delete', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-soft-delete@test.local' });
      const field = await createCustomField({ name: 'Soft delete', type: 'text' });

      const res = await agent.delete(`/api/custom-fields/${field.id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Поле скрыто (soft delete)');

      const list = await agent.get('/api/custom-fields');
      expect(list.body.some((f) => f.id === field.id)).toBe(false);
    });

    it('15. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-del-notfound@test.local' });

      const res = await agent.delete('/api/custom-fields/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/custom-fields/:id/restore', () => {
    it('16. Успешное восстановление удалённого поля', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-restore@test.local' });
      const field = await createCustomField({ name: 'To restore', type: 'text' });
      await db('custom_fields').where({ id: field.id }).update({ deleted_at: new Date() });

      const res = await agent.post(`/api/custom-fields/${field.id}/restore`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Поле восстановлено');

      const list = await agent.get('/api/custom-fields');
      expect(list.body.some((f) => f.id === field.id)).toBe(true);
    });

    it('17. Restore не удалённого поля возвращает 400', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-restore-notdeleted@test.local' });
      const field = await createCustomField({ name: 'Active', type: 'text' });

      const res = await agent.post(`/api/custom-fields/${field.id}/restore`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NOT_DELETED');
    });

    it('18. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-restore-notfound@test.local' });

      const res = await agent.post('/api/custom-fields/00000000-0000-0000-0000-000000000000/restore');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/custom-fields/:id/options', () => {
    it('19. Успешно возвращает опции dropdown поля', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-get-options@test.local' });
      const { field } = await createDropdownFieldWithOptions({
        name: 'Status',
        options: ['A', 'B'],
      });

      const res = await agent.get(`/api/custom-fields/${field.id}/options`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('label');
    });

    it('20. Для не-dropdown поля возвращает 400', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-get-options-not-dd@test.local' });
      const field = await createCustomField({ name: 'Text field', type: 'text' });

      const res = await agent.get(`/api/custom-fields/${field.id}/options`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NOT_DROPDOWN');
    });

    it('21. Несуществующий id возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-get-options-notfound@test.local' });

      const res = await agent.get('/api/custom-fields/00000000-0000-0000-0000-000000000000/options');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/custom-fields/:id/options', () => {
    it('22. Успешное добавление опции к dropdown', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-add-option@test.local' });
      const { field } = await createDropdownFieldWithOptions({
        name: 'Priority',
        options: ['Low'],
      });

      const res = await agent
        .post(`/api/custom-fields/${field.id}/options`)
        .send({ label: 'High' });

      expect(res.status).toBe(201);
      expect(res.body.label).toBe('High');

      const list = await agent.get(`/api/custom-fields/${field.id}/options`);
      expect(list.body.length).toBe(2);
      expect(list.body[1].sort_order).toBeGreaterThan(list.body[0].sort_order);
    });

    it('23. Добавление опции к не-dropdown возвращает 400', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-add-option-not-dd@test.local' });
      const field = await createCustomField({ name: 'Text field 2', type: 'text' });

      const res = await agent
        .post(`/api/custom-fields/${field.id}/options`)
        .send({ label: 'Any' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NOT_DROPDOWN');
    });
  });

  describe('DELETE /api/custom-fields/:id/options/:optionId', () => {
    it('24. Успешное устаревание опции (deprecate)', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-deprecate-option@test.local' });
      const { field, options } = await createDropdownFieldWithOptions({
        name: 'Status 2',
        options: ['To deprecate'],
      });
      const option = options[0];

      const res = await agent.delete(`/api/custom-fields/${field.id}/options/${option.id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Опция помечена как устаревшая');

      const row = await db('custom_field_options').where({ id: option.id }).first();
      expect(row.is_deprecated).toBe(true);
    });

    it('25. Несуществующая опция возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-deprecate-notfound@test.local' });
      const { field } = await createDropdownFieldWithOptions({
        name: 'Status 3',
        options: ['A'],
      });

      const res = await agent.delete(`/api/custom-fields/${field.id}/options/00000000-0000-0000-0000-000000000000`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('26. Опция принадлежащая другому полю возвращает 404', async () => {
      const { agent } = await loginAs({ role: ROLES.ADMIN, email: 'cf-deprecate-other@test.local' });
      const { field: field1 } = await createDropdownFieldWithOptions({
        name: 'Field 1',
        options: ['A'],
      });
      const { options: options2 } = await createDropdownFieldWithOptions({
        name: 'Field 2',
        options: ['B'],
      });

      const res = await agent.delete(`/api/custom-fields/${field1.id}/options/${options2[0].id}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});
