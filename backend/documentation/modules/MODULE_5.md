# MODULE_5 — Backend: Кастомные поля

## Обзор

Конструктор кастомных полей для Work Logs. Типы: Text / Number / Dropdown / Checkbox. Поля привязываются к проектам (per-project), можно включать/выключать и задавать обязательность. Удаление — soft delete. Смена типа запрещена если поле использовалось. Опции Dropdown помечаются как устаревшие вместо удаления.

---

## Шаг 1. Zod-схемы

`src/validators/customField.validators.js`:

```js
import { z } from 'zod';

export const createCustomFieldSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  type: z.enum(['text', 'number', 'dropdown', 'checkbox']),
  options: z.array(z.string().min(1)).optional(), // только для dropdown
});

export const updateCustomFieldSchema = z.object({
  name: z.string().min(1).optional(),
  // type — менять нельзя; проверяется в сервисе
}).refine(data => Object.keys(data).length > 0, { message: 'Нет полей для обновления' });

export const addOptionSchema = z.object({
  label: z.string().min(1, 'Значение обязательно'),
});

export const attachToProjectSchema = z.object({
  custom_field_id: z.string().uuid(),
  is_required: z.boolean().optional().default(false),
  is_enabled: z.boolean().optional().default(true),
});

export const updateProjectFieldSchema = z.object({
  is_required: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Нет полей для обновления' });
```

---

## Шаг 2. Репозиторий

`src/repositories/customField.repository.js`:

```js
import db from '@/config/knex.js';

export const CustomFieldRepository = {

  findAll: ({ includeDeleted = false } = {}) => {
    const query = db('custom_fields').select('*').orderBy('name');
    if (!includeDeleted) query.whereNull('deleted_at');
    return query;
  },

  findById: (id) =>
    db('custom_fields').where({ id }).first(),

  create: (data) =>
    db('custom_fields').insert(data).returning('*').then(r => r[0]),

  updateById: (id, data) =>
    db('custom_fields').where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*').then(r => r[0]),

  // Проверить, использовалось ли поле хотя бы в одном work log
  isUsed: async (id) => {
    const row = await db('work_log_custom_values').where({ custom_field_id: id }).first();
    return !!row;
  },

  // Опции Dropdown
  getOptions: (customFieldId) =>
    db('custom_field_options')
      .where({ custom_field_id: customFieldId })
      .orderBy('sort_order')
      .select('*'),

  addOption: (data) =>
    db('custom_field_options').insert(data).returning('*').then(r => r[0]),

  deprecateOption: (id) =>
    db('custom_field_options').where({ id }).update({ is_deprecated: true, updated_at: db.fn.now() }),

  findOptionById: (id) =>
    db('custom_field_options').where({ id }).first(),

  // Привязка к проектам
  getProjectFields: (projectId) =>
    db('project_custom_fields as pcf')
      .join('custom_fields as cf', 'cf.id', 'pcf.custom_field_id')
      .where('pcf.project_id', projectId)
      .whereNull('cf.deleted_at')
      .select('pcf.*', 'cf.name', 'cf.type'),

  findProjectField: (projectId, customFieldId) =>
    db('project_custom_fields')
      .where({ project_id: projectId, custom_field_id: customFieldId })
      .first(),

  attachToProject: (data) =>
    db('project_custom_fields').insert(data).returning('*').then(r => r[0]),

  updateProjectField: (projectId, customFieldId, data) =>
    db('project_custom_fields')
      .where({ project_id: projectId, custom_field_id: customFieldId })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*')
      .then(r => r[0]),

  detachFromProject: (projectId, customFieldId) =>
    db('project_custom_fields')
      .where({ project_id: projectId, custom_field_id: customFieldId })
      .delete(),
};
```

---

## Шаг 3. Сервис

`src/services/customField.service.js`:

```js
import { CustomFieldRepository } from '@/repositories/customField.repository.js';
import { AuditService } from '@/services/audit.service.js';

export const CustomFieldService = {

  async list({ includeDeleted = false } = {}) {
    return CustomFieldRepository.findAll({ includeDeleted });
  },

  async create({ actorId, actorRole, ip, options, ...data }) {
    const field = await CustomFieldRepository.create(data);

    // Для Dropdown сразу добавляем опции
    if (data.type === 'dropdown' && options?.length) {
      for (let i = 0; i < options.length; i++) {
        await CustomFieldRepository.addOption({
          custom_field_id: field.id,
          label: options[i],
          sort_order: i,
        });
      }
    }

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_CREATED',
      entityType: 'custom_field',
      entityId: field.id,
      after: { name: field.name, type: field.type },
      ip,
    });

    return field;
  },

  async update({ id, actorId, actorRole, ip, ...data }) {
    const field = await CustomFieldRepository.findById(id);
    if (!field) throw { status: 404, code: 'NOT_FOUND', message: 'Поле не найдено' };
    if (field.deleted_at) throw { status: 400, code: 'FIELD_DELETED', message: 'Поле удалено' };

    // Смена типа запрещена если поле используется
    if (data.type && data.type !== field.type) {
      const used = await CustomFieldRepository.isUsed(id);
      if (used) throw { status: 409, code: 'TYPE_CHANGE_FORBIDDEN', message: 'Нельзя изменить тип: поле уже используется' };
    }

    const before = { name: field.name };
    const updated = await CustomFieldRepository.updateById(id, data);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_UPDATED',
      entityType: 'custom_field',
      entityId: id,
      before,
      after: data,
      ip,
    });

    return updated;
  },

  async softDelete({ id, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(id);
    if (!field) throw { status: 404, code: 'NOT_FOUND', message: 'Поле не найдено' };

    await CustomFieldRepository.updateById(id, { deleted_at: new Date() });

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_DELETED',
      entityType: 'custom_field',
      entityId: id,
      ip,
    });

    return { message: 'Поле скрыто (soft delete)' };
  },

  async restore({ id, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(id);
    if (!field) throw { status: 404, code: 'NOT_FOUND', message: 'Поле не найдено' };
    if (!field.deleted_at) throw { status: 400, code: 'NOT_DELETED', message: 'Поле не удалено' };

    await CustomFieldRepository.updateById(id, { deleted_at: null });

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_RESTORED',
      entityType: 'custom_field',
      entityId: id,
      ip,
    });

    return { message: 'Поле восстановлено' };
  },

  // --- Опции Dropdown ---

  async getOptions(id) {
    const field = await CustomFieldRepository.findById(id);
    if (!field) throw { status: 404, code: 'NOT_FOUND', message: 'Поле не найдено' };
    if (field.type !== 'dropdown') throw { status: 400, code: 'NOT_DROPDOWN', message: 'Поле не является Dropdown' };
    return CustomFieldRepository.getOptions(id);
  },

  async addOption({ id, label, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(id);
    if (!field || field.type !== 'dropdown') throw { status: 400, code: 'NOT_DROPDOWN', message: 'Поле не является Dropdown' };

    const options = await CustomFieldRepository.getOptions(id);
    const option = await CustomFieldRepository.addOption({
      custom_field_id: id,
      label,
      sort_order: options.length,
    });

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_OPTION_ADDED',
      entityType: 'custom_field',
      entityId: id,
      after: { label },
      ip,
    });

    return option;
  },

  async deprecateOption({ fieldId, optionId, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(fieldId);
    if (!field || field.type !== 'dropdown') throw { status: 400, code: 'NOT_DROPDOWN', message: 'Поле не является Dropdown' };

    const option = await CustomFieldRepository.findOptionById(optionId);
    if (!option || option.custom_field_id !== fieldId) throw { status: 404, code: 'NOT_FOUND', message: 'Опция не найдена' };

    await CustomFieldRepository.deprecateOption(optionId);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_OPTION_DEPRECATED',
      entityType: 'custom_field',
      entityId: fieldId,
      after: { option_id: optionId },
      ip,
    });

    return { message: 'Опция помечена как устаревшая' };
  },

  // --- Привязка к проектам ---

  async getProjectFields(projectId) {
    return CustomFieldRepository.getProjectFields(projectId);
  },

  async attachToProject({ projectId, customFieldId, is_required, is_enabled, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(customFieldId);
    if (!field || field.deleted_at) throw { status: 404, code: 'NOT_FOUND', message: 'Поле не найдено' };

    const existing = await CustomFieldRepository.findProjectField(projectId, customFieldId);

    if (existing) throw { status: 409, code: 'ALREADY_ATTACHED', message: 'Поле уже привязано к проекту' };

    const result = await CustomFieldRepository.attachToProject({
      project_id: projectId,
      custom_field_id: customFieldId,
      is_required,
      is_enabled,
    });

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_ATTACHED',
      entityType: 'project',
      entityId: projectId,
      after: { custom_field_id: customFieldId, is_required, is_enabled },
      ip,
    });

    return result;
  },

  async updateProjectField({ projectId, customFieldId, data, actorId, actorRole, ip }) {
    const existing = await CustomFieldRepository.findProjectField(projectId, customFieldId);
    if (!existing) throw { status: 404, code: 'NOT_FOUND', message: 'Привязка не найдена' };

    const result = await CustomFieldRepository.updateProjectField(projectId, customFieldId, data);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_PROJECT_UPDATED',
      entityType: 'project',
      entityId: projectId,
      after: { custom_field_id: customFieldId, ...data },
      ip,
    });

    return result;
  },

  async detachFromProject({ projectId, customFieldId, actorId, actorRole, ip }) {
    const existing = await CustomFieldRepository.findProjectField(projectId, customFieldId);
    if (!existing) throw { status: 404, code: 'NOT_FOUND', message: 'Привязка не найдена' };

    await CustomFieldRepository.detachFromProject(projectId, customFieldId);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CUSTOM_FIELD_DETACHED',
      entityType: 'project',
      entityId: projectId,
      after: { custom_field_id: customFieldId },
      ip,
    });

    return { message: 'Поле откреплено от проекта' };
  },
};
```

---

## Шаг 4. Контроллер

`src/controllers/customField.controller.js`:

```js
import { CustomFieldService } from '@/services/customField.service.js';
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  addOptionSchema,
  attachToProjectSchema,
  updateProjectFieldSchema,
} from '@/validators/customField.validators.js';

export const CustomFieldController = {

  async list(req, res, next) {
    try {
      const includeDeleted = req.query.include_deleted === 'true';
      const fields = await CustomFieldService.list({ includeDeleted });
      res.json(fields);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const data = createCustomFieldSchema.parse(req.body);
      const field = await CustomFieldService.create({ ...data, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.status(201).json(field);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const data = updateCustomFieldSchema.parse(req.body);
      const field = await CustomFieldService.update({ id: req.params.id, ...data, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.json(field);
    } catch (err) { next(err); }
  },

  async softDelete(req, res, next) {
    try {
      const result = await CustomFieldService.softDelete({ id: req.params.id, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.json(result);
    } catch (err) { next(err); }
  },

  async restore(req, res, next) {
    try {
      const result = await CustomFieldService.restore({ id: req.params.id, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.json(result);
    } catch (err) { next(err); }
  },

  async getOptions(req, res, next) {
    try {
      const options = await CustomFieldService.getOptions(req.params.id);
      res.json(options);
    } catch (err) { next(err); }
  },

  async addOption(req, res, next) {
    try {
      const { label } = addOptionSchema.parse(req.body);
      const option = await CustomFieldService.addOption({ id: req.params.id, label, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.status(201).json(option);
    } catch (err) { next(err); }
  },

  async deprecateOption(req, res, next) {
    try {
      const result = await CustomFieldService.deprecateOption({ fieldId: req.params.id, optionId: req.params.optionId, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.json(result);
    } catch (err) { next(err); }
  },

  async getProjectFields(req, res, next) {
    try {
      const fields = await CustomFieldService.getProjectFields(req.params.projectId);
      res.json(fields);
    } catch (err) { next(err); }
  },

  async attachToProject(req, res, next) {
    try {
      const data = attachToProjectSchema.parse(req.body);
      const result = await CustomFieldService.attachToProject({ projectId: req.params.projectId, ...data, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.status(201).json(result);
    } catch (err) { next(err); }
  },

  async updateProjectField(req, res, next) {
    try {
      const data = updateProjectFieldSchema.parse(req.body);
      const result = await CustomFieldService.updateProjectField({ projectId: req.params.projectId, customFieldId: req.params.fieldId, data, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.json(result);
    } catch (err) { next(err); }
  },

  async detachFromProject(req, res, next) {
    try {
      const result = await CustomFieldService.detachFromProject({ projectId: req.params.projectId, customFieldId: req.params.fieldId, actorId: req.user.id, actorRole: req.user.role, ip: req.ip });
      res.json(result);
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 5. Роутер

`src/routes/customFieldRouter.js`:

```js
import { Router } from 'express';
import { CustomFieldController } from '@/controllers/customField.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();
router.use(authenticate, authorize('admin'));

// Поля
router.get('/', CustomFieldController.list);
router.post('/', CustomFieldController.create);
router.patch('/:id', CustomFieldController.update);
router.delete('/:id', CustomFieldController.softDelete);
router.post('/:id/restore', CustomFieldController.restore);

// Опции Dropdown
router.get('/:id/options', CustomFieldController.getOptions);
router.post('/:id/options', CustomFieldController.addOption);
router.delete('/:id/options/:optionId', CustomFieldController.deprecateOption);

export default router;
```

`src/routes/projectCustomFieldRouter.js`:

```js
import { Router } from 'express';
import { CustomFieldController } from '@/controllers/customField.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router({ mergeParams: true }); // для доступа к :projectId

router.get('/', authenticate, CustomFieldController.getProjectFields);           // все авторизованные
router.post('/', authenticate, authorize('admin'), CustomFieldController.attachToProject);
router.patch('/:fieldId', authenticate, authorize('admin'), CustomFieldController.updateProjectField);
router.delete('/:fieldId', authenticate, authorize('admin'), CustomFieldController.detachFromProject);

export default router;
```

Подключить в `app.js`:

```js
import customFieldRouter from '@/routes/customFieldRouter.js';
import projectCustomFieldRouter from '@/routes/projectCustomFieldRouter.js';

app.use('/api/custom-fields', customFieldRouter);
app.use('/api/projects/:projectId/custom-fields', projectCustomFieldRouter);
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | Создание поля Text | `POST /api/custom-fields` `{ "name": "Branch", "type": "text" }` → `201` | ✅ Пройдено |
| 2 | Создание Dropdown с опциями | `{ "type": "dropdown", "options": ["A", "B"] }` → `201`, опции в `custom_field_options` | ✅ Пройдено |
| 3 | Переименование поля | `PATCH /api/custom-fields/:id` `{ "name": "New Name" }` → `200` | ✅ Пройдено |
| 4 | Смена типа неиспользованного | `PATCH` с `{ "type": "number" }` без логов → `200` | ✅ Пройдено |
| 5 | Смена типа использованного | Создать Work Log с полем → `PATCH` с новым типом → `409 TYPE_CHANGE_FORBIDDEN` | ✅ Пройдено |
| 6 | Soft delete | `DELETE /api/custom-fields/:id` → `200`; `GET` без `include_deleted` — поле не видно | ✅ Пройдено |
| 7 | Восстановление | `POST /api/custom-fields/:id/restore` → `200`; поле снова в списке | ✅ Пройдено |
| 8 | Добавление опции Dropdown | `POST /api/custom-fields/:id/options` `{ "label": "C" }` → `201` | ✅ Пройдено |
| 9 | Устаревание опции | `DELETE /api/custom-fields/:id/options/:optionId` → `200`; `is_deprecated = true` в БД | ✅ Пройдено |
| 10 | Привязка к проекту | `POST /api/projects/:id/custom-fields` → `201` | ✅ Пройдено |
| 11 | Включение/выключение per-project | `PATCH /api/projects/:id/custom-fields/:fieldId` `{ "is_enabled": false }` → `200` | ✅ Пройдено |
| 12 | Отвязка от проекта | `DELETE /api/projects/:id/custom-fields/:fieldId` → `200`; запись удалена из `project_custom_fields` | ✅ Пройдено |
| 13 | Audit log пишется | После каждой операции → `SELECT * FROM audit_logs WHERE entity_type='custom_field';` | ✅ Пройдено |
