# MODULE_4 — Backend: Проекты

## Обзор

Модуль управления проектами: CRUD, смена статуса (Active / On Hold / Closed) в любую сторону. Все операции доступны только Admin. Все изменения пишутся в audit_log.

---

## Шаг 1. Zod-схемы

`src/validators/project.validators.js`:

```js
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'on_hold', 'closed']).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Нет полей для обновления' });
```

---

## Шаг 2. Репозиторий

`src/repositories/project.repository.js`:

```js
import db from '@/config/knex.js';

export const ProjectRepository = {

  findAll: ({ status } = {}) => {
    const query = db('projects').select('*').orderBy('name');
    if (status) query.where({ status });
    return query;
  },

  findById: (id) =>
    db('projects').where({ id }).first(),

  create: (data) =>
    db('projects').insert(data).returning('*').then(r => r[0]),

  updateById: (id, data) =>
    db('projects').where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*').then(r => r[0]),
};
```

---

## Шаг 3. Сервис

`src/services/project.service.js`:

```js
import { ProjectRepository } from '@/repositories/project.repository.js';
import { AuditService } from '@/services/audit.service.js';

export const ProjectService = {

  async list({ status } = {}) {
    return ProjectRepository.findAll({ status });
  },

  async getById(id) {
    const project = await ProjectRepository.findById(id);
    if (!project) throw { status: 404, code: 'NOT_FOUND', message: 'Проект не найден' };
    return project;
  },

  async create({ actorId, actorRole, ip, ...data }) {
    const project = await ProjectRepository.create(data);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'PROJECT_CREATED',
      entityType: 'project',
      entityId: project.id,
      after: { name: project.name, status: project.status },
      ip,
    });

    return project;
  },

  async update({ id, actorId, actorRole, ip, ...data }) {
    const project = await ProjectRepository.findById(id);
    if (!project) throw { status: 404, code: 'NOT_FOUND', message: 'Проект не найден' };

    const before = { name: project.name, status: project.status };
    const updated = await ProjectRepository.updateById(id, data);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'PROJECT_UPDATED',
      entityType: 'project',
      entityId: id,
      before,
      after: data,
      ip,
    });

    return updated;
  },
};
```

---

## Шаг 4. Контроллер

`src/controllers/project.controller.js`:

```js
import { ProjectService } from '@/services/project.service.js';
import { createProjectSchema, updateProjectSchema } from '@/validators/project.validators.js';

export const ProjectController = {

  async list(req, res, next) {
    try {
      const { status } = req.query;
      const projects = await ProjectService.list({ status });
      res.json(projects);
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const project = await ProjectService.getById(req.params.id);
      res.json(project);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const data = createProjectSchema.parse(req.body);
      const project = await ProjectService.create({
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.status(201).json(project);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const data = updateProjectSchema.parse(req.body);
      const project = await ProjectService.update({
        id: req.params.id,
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.json(project);
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 5. Роутер

`src/routes/projectRouter.js`:

```js
import { Router } from 'express';
import { ProjectController } from '@/controllers/project.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();

// GET-эндпоинты доступны всем авторизованным пользователям.
// POST/PATCH — только Admin.
router.get('/', authenticate, ProjectController.list);
router.get('/:id', authenticate, ProjectController.getById);
router.post('/', authenticate, authorize('admin'), ProjectController.create);
router.patch('/:id', authenticate, authorize('admin'), ProjectController.update);

export default router;
```

Подключить в `app.js`:

```js
import projectRouter from '@/routes/projectRouter.js';
app.use('/api/projects', projectRouter);
```

---

## Шаг 6. Бизнес-правила (контроль на уровне сервиса)

| Правило | Где проверяется |
|---------|----------------|
| Статусы Active / On Hold / Closed | Zod enum в `updateProjectSchema` |
| Переходы в любую сторону (без ограничений) | Ограничений нет — любое значение из enum допустимо |
| В On Hold / Closed логировать нельзя | Проверяется в MODULE_7 (Work Logs) и MODULE_8 (Absences) на этапе создания лога |
| User видит только Active проекты в форме логирования | Фронт фильтрует, бэк дополнительно проверяет статус при создании Work Log |

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | `GET /api/projects` для любого авторизованного | Запрос с User-cookie → `200`, список проектов |
| 2 | `GET /api/projects?status=active` | Только активные проекты в ответе |
| 3 | `GET /api/projects/:id` несуществующий | → `404 NOT_FOUND` |
| 4 | `POST /api/projects` только Admin | С User-cookie → `403 FORBIDDEN` |
| 5 | Создание проекта | `POST /api/projects` с `{ "name": "Test Project" }` → `201`, проект в БД со статусом `active` |
| 6 | Переименование | `PATCH /api/projects/:id` с `{ "name": "New Name" }` → `200`, обновлено |
| 7 | Смена статуса Active → Closed | `PATCH /api/projects/:id` с `{ "status": "closed" }` → `200` |
| 8 | Смена статуса Closed → Active | То же с `{ "status": "active" }` → `200` (обратный переход разрешён) |
| 9 | Невалидный статус | `PATCH` с `{ "status": "archived" }` → `400` (Zod) |
| 10 | Audit log пишется | После create/update → `SELECT * FROM audit_logs WHERE entity_type='project';` → записи есть |
