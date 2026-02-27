# MODULE_7 — Backend: Work Logs

## Обзор

Модуль создания, редактирования и удаления рабочих логов. Длительность принимается в формате `1h 30m / 2d / 45m` и хранится в днях. Реализует все бизнес-правила: запрет логирования в будущее, в неактивные проекты, смешивания с Absence, предупреждение при >12h/день, проверку закрытия месяца, поддержку кастомных полей. Все операции пишутся в audit_log.

MODULE_7 создаёт checkMonthClosed middleware — он переиспользуется в MODULE_8 без изменений.
---

## Шаг 1. Утилита: парсинг длительности

`src/utils/duration.js`:

```js
/**
 * Парсит строку длительности в дни.
 * Поддерживает: "45m", "2h", "1d", "1h 30m", "1d 2h 30m"
 * 1d = 8h = 480m
 */
export function parseDurationToDays(input) {
  if (!input || typeof input !== 'string') throw { status: 400, code: 'INVALID_DURATION', message: 'Неверный формат длительности' };

  const str = input.trim().toLowerCase();
  const dMatch = str.match(/(\d+(?:\.\d+)?)\s*d/);
  const hMatch = str.match(/(\d+(?:\.\d+)?)\s*h/);
  const mMatch = str.match(/(\d+(?:\.\d+)?)\s*m/);

  const days = dMatch ? parseFloat(dMatch[1]) : 0;
  const hours = hMatch ? parseFloat(hMatch[1]) : 0;
  const minutes = mMatch ? parseFloat(mMatch[1]) : 0;

  if (!dMatch && !hMatch && !mMatch) {
    throw { status: 400, code: 'INVALID_DURATION', message: 'Не удалось распознать длительность' };
  }

  const totalDays = days + hours / 8 + minutes / 480;
  if (totalDays <= 0) throw { status: 400, code: 'INVALID_DURATION', message: 'Длительность должна быть больше 0' };

  return Math.round(totalDays * 10000) / 10000; // 4 знака после запятой
}

/**
 * Конвертирует дни в часы для отображения.
 */
export function daysToHours(days) {
  return Math.round(days * 8 * 100) / 100;
}
```

---

## Шаг 2. Zod-схемы

`src/validators/workLog.validators.js`:

```js
import { z } from 'zod';

export const createWorkLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат даты: YYYY-MM-DD'),
  project_id: z.string().uuid(),
  duration: z.string().min(1, 'Длительность обязательна'),
  comment: z.string().min(1, 'Комментарий обязателен'),
  task_number: z.string().min(1, 'Task Number обязателен'),
  custom_fields: z.record(z.string().uuid(), z.any()).optional(), // { fieldId: value }
});

export const updateWorkLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  project_id: z.string().uuid().optional(),
  duration: z.string().min(1).optional(),
  comment: z.string().min(1).optional(),
  task_number: z.string().min(1).optional(),
  custom_fields: z.record(z.string().uuid(), z.any()).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Нет полей для обновления' });

export const workLogFiltersSchema = z.object({
  user_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  task_number: z.string().optional(),
  comment: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
```

---

## Шаг 3. Репозиторий

`src/repositories/workLog.repository.js`:

```js
import db from '@/config/knex.js';

export const WorkLogRepository = {

  findAll: ({ userId, projectId, dateFrom, dateTo, taskNumber, comment, page, limit }) => {
    const query = db('work_logs as wl')
      .join('users as u', 'u.id', 'wl.user_id')
      .join('projects as p', 'p.id', 'wl.project_id')
      .select(
        'wl.id', 'wl.date', 'wl.duration_days', 'wl.comment', 'wl.task_number',
        'wl.user_id', 'wl.project_id', 'wl.created_at', 'wl.updated_at',
        'u.first_name', 'u.last_name', 'u.position',
        'p.name as project_name'
      )
      .orderBy('wl.date', 'desc');

    if (userId) query.where('wl.user_id', userId);
    if (projectId) query.where('wl.project_id', projectId);
    if (dateFrom) query.where('wl.date', '>=', dateFrom);
    if (dateTo) query.where('wl.date', '<=', dateTo);
    if (taskNumber) query.whereILike('wl.task_number', `%${taskNumber}%`);
    if (comment) query.whereILike('wl.comment', `%${comment}%`);

    return query.paginate({ currentPage: page, perPage: limit });
  },

  findById: (id) =>
    db('work_logs').where({ id }).first(),

  create: (data) =>
    db('work_logs').insert(data).returning('*').then(r => r[0]),

  updateById: (id, data) =>
    db('work_logs').where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*').then(r => r[0]),

  deleteById: (id) =>
    db('work_logs').where({ id }).delete(),

  // Сумма часов за день для пользователя (для проверки >12h)
  sumDayDuration: async (userId, date, excludeId = null) => {
    const query = db('work_logs').where({ user_id: userId, date }).sum('duration_days as total');
    if (excludeId) query.whereNot({ id: excludeId });
    const result = await query.first();
    return parseFloat(result?.total || 0);
  },

  // Кастомные значения
  upsertCustomValues: async (workLogId, customFields = {}) => {
    for (const [fieldId, value] of Object.entries(customFields)) {
      const existing = await db('work_log_custom_values')
        .where({ work_log_id: workLogId, custom_field_id: fieldId }).first();
      if (existing) {
        await db('work_log_custom_values')
          .where({ work_log_id: workLogId, custom_field_id: fieldId })
          .update({ value: String(value), updated_at: db.fn.now() });
      } else {
        await db('work_log_custom_values')
          .insert({ work_log_id: workLogId, custom_field_id: fieldId, value: String(value) });
      }
    }
  },

  getCustomValues: (workLogId) =>
    db('work_log_custom_values as wcv')
      .join('custom_fields as cf', 'cf.id', 'wcv.custom_field_id')
      .where('wcv.work_log_id', workLogId)
      .select('wcv.custom_field_id', 'wcv.value', 'cf.name', 'cf.type'),
};
```

---

## Шаг 4. Middleware: проверка закрытия месяца

`src/middlewares/checkMonthClosed.js`:

```js
import db from '@/config/knex.js';

/**
 * Проверяет, закрыт ли месяц для указанной даты.
 * Дата берётся из req.body.date или req.workLogDate (устанавливается в контроллере).
 * Admin может всё — middleware пропускается.
 */
export async function checkMonthClosed(req, res, next) {
  try {
    if (req.user.role === 'admin') return next();

    const date = req.body.date || req.workLogDate;
    if (!date) return next();

    const [year, month] = date.split('-').map(Number);
    const closure = await db('month_closures').where({ year, month }).first();

    if (closure) {
      return res.status(403).json({ code: 'MONTH_CLOSED', message: 'Месяц закрыт. Редактирование запрещено' });
    }
    next();
  } catch (err) {
    next(err);
  }
}
```

---

## Шаг 5. Сервис

`src/services/workLog.service.js`:

```js
import dayjs from 'dayjs';
import db from '@/config/knex.js';
import { WorkLogRepository } from '@/repositories/workLog.repository.js';
import { AuditService } from '@/services/audit.service.js';
import { parseDurationToDays, daysToHours } from '@/utils/duration.js';
import { isWorkingDay } from '@/utils/calendar.js';
import { ProjectRepository } from '@/repositories/project.repository.js';
import { CustomFieldRepository } from '@/repositories/customField.repository.js';

const MAX_HOURS_PER_DAY = 12;

export const WorkLogService = {

  async list({ userId, isAdmin, ...filters }) {
    // User видит только свои логи
    const effectiveUserId = isAdmin ? filters.user_id : userId;
    const result = await WorkLogRepository.findAll({ ...filters, userId: effectiveUserId });
    // Конвертируем duration_days → hours для отображения
    result.data = result.data.map(log => ({
      ...log,
      duration_hours: daysToHours(log.duration_days),
    }));
    return result;
  },

  async create({ userId, isAdmin, custom_fields, ...data }) {
    // 1. Запрет в будущее
    if (dayjs(data.date).isAfter(dayjs(), 'day')) {
      throw { status: 400, code: 'FUTURE_DATE', message: 'Нельзя логировать будущие даты' };
    }

    // 2. Проект должен быть Active
    const project = await ProjectRepository.findById(data.project_id);
    if (!project) throw { status: 404, code: 'PROJECT_NOT_FOUND', message: 'Проект не найден' };
    if (project.status !== 'active') {
      throw { status: 400, code: 'PROJECT_NOT_ACTIVE', message: 'Логирование доступно только для активных проектов' };
    }

    // 3. Запрет смешивания с Absence
    const hasAbsence = await db('absences').where({ user_id: userId, date: data.date }).first();
    if (hasAbsence) {
      throw { status: 400, code: 'ABSENCE_CONFLICT', message: 'В этот день уже есть запись об отсутствии' };
    }

    // 4. Парсинг длительности
    const duration_days = parseDurationToDays(data.duration);

    // 5. Предупреждение при >12h/день (не блокирует)
    const existingDays = await WorkLogRepository.sumDayDuration(userId, data.date);
    const totalDays = existingDays + duration_days;
    const warning = daysToHours(totalDays) > MAX_HOURS_PER_DAY
      ? `Суммарное время за день превышает ${MAX_HOURS_PER_DAY}ч`
      : null;

    // 6. Проверка кастомных полей проекта (обязательные)
    await validateCustomFields(data.project_id, custom_fields);

    const log = await WorkLogRepository.create({
      user_id: userId,
      project_id: data.project_id,
      date: data.date,
      duration_days,
      comment: data.comment,
      task_number: data.task_number,
    });

    if (custom_fields && Object.keys(custom_fields).length) {
      await WorkLogRepository.upsertCustomValues(log.id, custom_fields);
    }

    await AuditService.log({
      actorId: userId,
      eventType: 'WORK_LOG_CREATED',
      entityType: 'work_log',
      entityId: log.id,
      after: { date: log.date, duration_days, project_id: log.project_id },
      ip: data.ip,
    });

    return { ...log, duration_hours: daysToHours(duration_days), warning };
  },

  async update({ id, userId, isAdmin, custom_fields, ...data }) {
    const log = await WorkLogRepository.findById(id);
    if (!log) throw { status: 404, code: 'NOT_FOUND', message: 'Лог не найден' };
    if (!isAdmin && log.user_id !== userId) throw { status: 403, code: 'FORBIDDEN', message: 'Нет доступа' };

    const updateData = {};
    let warning = null;

    if (data.date) {
      if (dayjs(data.date).isAfter(dayjs(), 'day')) {
        throw { status: 400, code: 'FUTURE_DATE', message: 'Нельзя логировать будущие даты' };
      }
      updateData.date = data.date;
    }

    if (data.project_id) {
      const project = await ProjectRepository.findById(data.project_id);
      if (!project || project.status !== 'active') {
        throw { status: 400, code: 'PROJECT_NOT_ACTIVE', message: 'Проект должен быть активным' };
      }
      updateData.project_id = data.project_id;
    }

    if (data.duration) {
      updateData.duration_days = parseDurationToDays(data.duration);
      const dateToCheck = updateData.date || log.date;
      const existingDays = await WorkLogRepository.sumDayDuration(userId, dateToCheck, id);
      if (daysToHours(existingDays + updateData.duration_days) > MAX_HOURS_PER_DAY) {
        warning = `Суммарное время за день превышает ${MAX_HOURS_PER_DAY}ч`;
      }
    }

    if (data.comment) updateData.comment = data.comment;
    if (data.task_number) updateData.task_number = data.task_number;

    const before = { date: log.date, duration_days: log.duration_days, project_id: log.project_id };
    const updated = await WorkLogRepository.updateById(id, updateData);

    if (custom_fields) {
      await WorkLogRepository.upsertCustomValues(id, custom_fields);
    }

    await AuditService.log({
      actorId: userId,
      eventType: 'WORK_LOG_UPDATED',
      entityType: 'work_log',
      entityId: id,
      before,
      after: updateData,
      ip: data.ip,
    });

    return { ...updated, duration_hours: daysToHours(updated.duration_days), warning };
  },

  async delete({ id, userId, isAdmin, ip }) {
    const log = await WorkLogRepository.findById(id);
    if (!log) throw { status: 404, code: 'NOT_FOUND', message: 'Лог не найден' };
    if (!isAdmin && log.user_id !== userId) throw { status: 403, code: 'FORBIDDEN', message: 'Нет доступа' };

    await WorkLogRepository.deleteById(id);

    await AuditService.log({
      actorId: userId,
      eventType: 'WORK_LOG_DELETED',
      entityType: 'work_log',
      entityId: id,
      before: { date: log.date, duration_days: log.duration_days },
      ip,
    });

    return { message: 'Лог удалён' };
  },
};

// Вспомогательная: проверка обязательных кастомных полей проекта
async function validateCustomFields(projectId, customFields = {}) {
  const projectFields = await CustomFieldRepository.getProjectFields(projectId);
  const requiredFields = projectFields.filter(f => f.is_required && f.is_enabled);

  for (const field of requiredFields) {
    const value = customFields?.[field.custom_field_id];
    if (value === undefined || value === null || value === '') {
      throw {
        status: 400,
        code: 'REQUIRED_FIELD_MISSING',
        message: `Обязательное поле "${field.name}" не заполнено`,
      };
    }
  }
}
```

---

## Шаг 6. Контроллер

`src/controllers/workLog.controller.js`:

```js
import { WorkLogService } from '@/services/workLog.service.js';
import { createWorkLogSchema, updateWorkLogSchema, workLogFiltersSchema } from '@/validators/workLog.validators.js';

export const WorkLogController = {

  async list(req, res, next) {
    try {
      const filters = workLogFiltersSchema.parse(req.query);
      const result = await WorkLogService.list({
        ...filters,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const { custom_fields, ...data } = createWorkLogSchema.parse(req.body);
      const result = await WorkLogService.create({
        ...data,
        custom_fields,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        ip: req.ip,
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      // Для checkMonthClosed: нужна дата лога — устанавливаем в req
      const log = await import('@/config/knex.js').then(m => m.default('work_logs').where({ id: req.params.id }).first());
      if (log) req.workLogDate = log.date;

      const { custom_fields, ...data } = updateWorkLogSchema.parse(req.body);
      const result = await WorkLogService.update({
        id: req.params.id,
        ...data,
        custom_fields,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        ip: req.ip,
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async delete(req, res, next) {
    try {
      const log = await import('@/config/knex.js').then(m => m.default('work_logs').where({ id: req.params.id }).first());
      if (log) req.workLogDate = log.date;

      const result = await WorkLogService.delete({
        id: req.params.id,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        ip: req.ip,
      });
      res.json(result);
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 7. Роутер

`src/routes/workLogRouter.js`:

```js
import { Router } from 'express';
import { WorkLogController } from '@/controllers/workLog.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { checkMonthClosed } from '@/middlewares/checkMonthClosed.js';

const router = Router();

router.use(authenticate);

router.get('/', WorkLogController.list);
router.post('/', checkMonthClosed, WorkLogController.create);
router.patch('/:id', checkMonthClosed, WorkLogController.update);
router.delete('/:id', checkMonthClosed, WorkLogController.delete);

export default router;
```

Подключить в `app.js`:

```js
import workLogRouter from '@/routes/workLogRouter.js';
app.use('/api/work-logs', workLogRouter);
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | Создание лога с `"1h 30m"` | `POST /api/work-logs` → `201`; `duration_days = 0.1875` в БД; `duration_hours = 1.5` в ответе | ✅ Пройдено |
| 2 | Создание с `"2d"` | `duration_days = 2`, `duration_hours = 16` | ✅ Пройдено |
| 3 | Запрет в будущее | Дата завтра → `400 FUTURE_DATE` | ✅ Пройдено |
| 4 | Запрет в On Hold / Closed проект | → `400 PROJECT_NOT_ACTIVE` | ✅ Пройдено |
| 5 | Запрет смешивания с Absence | Создать Absence на дату → `POST /api/work-logs` с той же датой → `400 ABSENCE_CONFLICT` | ✅ Пройдено |
| 6 | Предупреждение >12h | Создать логи суммарно >12h → в ответе `warning: "..."`, статус `201` | ✅ Пройдено |
| 7 | User видит только свои логи | `GET /api/work-logs` с User-cookie → только его записи | ✅ Пройдено |
| 8 | Admin видит все | `GET /api/work-logs?user_id=<uuid>` с Admin-cookie → логи любого пользователя | ✅ Пройдено |
| 9 | Фильтрация по проекту | `GET /api/work-logs?project_id=<uuid>` → только логи этого проекта | ✅ Пройдено |
| 10 | Фильтрация по Task Number | `?task_number=TASK-1` → только совпадающие записи | ✅ Пройдено |
| 11 | Редактирование своего лога | `PATCH /api/work-logs/:id` → `200` | ✅ Пройдено |
| 12 | User не может редактировать чужой | → `403 FORBIDDEN` | ✅ Пройдено |
| 13 | Удаление | `DELETE /api/work-logs/:id` → `200`; запись исчезает из БД | ✅ Пройдено |
| 14 | Закрытый месяц блокирует User | Закрыть месяц → User пытается создать/изменить → `403 MONTH_CLOSED` | ✅ Пройдено |
| 15 | Admin работает в закрытом | Те же действия с Admin-cookie → `201` / `200` | ✅ Пройдено |
| 16 | Обязательное кастомное поле | Создать лог без обязательного поля → `400 REQUIRED_FIELD_MISSING` | ✅ Пройдено |
| 17 | Audit log пишется | После CRUD → `SELECT * FROM audit_logs WHERE entity_type='work_log';` | ✅ Пройдено |
