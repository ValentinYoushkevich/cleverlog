# MODULE_8 — Backend: Absences

## Обзор

Модуль создания, редактирования и удаления записей об отсутствии (Vacation / Sick Leave / Day Off). Принимает диапазон дат — создаёт отдельные записи только по рабочим дням, пропуская выходные и дни с уже существующими Work Logs (с уведомлением). Запрет переноса на выходной. Проверка закрытия месяца.

---

## Шаг 1. Zod-схемы

`src/validators/absence.validators.js`:

```js
import { z } from 'zod';

export const createAbsenceSchema = z.object({
  type: z.enum(['vacation', 'sick_leave', 'day_off']),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат: YYYY-MM-DD'),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат: YYYY-MM-DD'),
  comment: z.string().optional(),
}).refine(data => data.date_from <= data.date_to, {
  message: 'date_from должна быть <= date_to',
  path: ['date_from'],
});

export const updateAbsenceSchema = z.object({
  type: z.enum(['vacation', 'sick_leave', 'day_off']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  duration: z.string().min(1).optional(),
  comment: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Нет полей для обновления' });

export const absenceFiltersSchema = z.object({
  user_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  type: z.enum(['vacation', 'sick_leave', 'day_off']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
```

---

## Шаг 2. Репозиторий

`src/repositories/absence.repository.js`:

```js
import db from '@/config/knex.js';

export const AbsenceRepository = {

  findAll: ({ userId, dateFrom, dateTo, type, page, limit }) => {
    const query = db('absences as a')
      .join('users as u', 'u.id', 'a.user_id')
      .select(
        'a.id', 'a.user_id', 'a.type', 'a.date', 'a.duration_days', 'a.comment',
        'a.created_at', 'a.updated_at',
        'u.first_name', 'u.last_name'
      )
      .orderBy('a.date', 'desc');

    if (userId) query.where('a.user_id', userId);
    if (dateFrom) query.where('a.date', '>=', dateFrom);
    if (dateTo) query.where('a.date', '<=', dateTo);
    if (type) query.where('a.type', type);

    return query.paginate({ currentPage: page, perPage: limit });
  },

  findById: (id) =>
    db('absences').where({ id }).first(),

  // Найти существующие Work Logs на список дат для пользователя
  findWorkLogDates: (userId, dates) =>
    db('work_logs')
      .where('user_id', userId)
      .whereIn('date', dates)
      .pluck('date'),

  // Найти существующие Absences на список дат для пользователя
  findAbsenceDates: (userId, dates) =>
    db('absences')
      .where('user_id', userId)
      .whereIn('date', dates)
      .pluck('date'),

  createMany: (records) =>
    db('absences').insert(records).returning('*'),

  updateById: (id, data) =>
    db('absences').where({ id }).update({ ...data, updated_at: db.fn.now() }).returning('*').then(r => r[0]),

  deleteById: (id) =>
    db('absences').where({ id }).delete(),
};
```

---

## Шаг 3. Сервис

`src/services/absence.service.js`:

```js
import dayjs from 'dayjs';
import db from '@/config/knex.js';
import { AbsenceRepository } from '@/repositories/absence.repository.js';
import { AuditService } from '@/services/audit.service.js';
import { parseDurationToDays, daysToHours } from '@/utils/duration.js';
import { getDefaultDayType } from '@/utils/calendar.js';

export const AbsenceService = {

  async list({ userId, isAdmin, ...filters }) {
    const effectiveUserId = isAdmin ? filters.user_id : userId;
    const result = await AbsenceRepository.findAll({ ...filters, userId: effectiveUserId });
    result.data = result.data.map(a => ({
      ...a,
      duration_hours: daysToHours(a.duration_days),
    }));
    return result;
  },

  async create({ userId, isAdmin, type, date_from, date_to, comment, ip }) {
    // 1. Нельзя создавать в будущее — нет ограничения по BRD,
    //    но будущие рабочие дни засчитываются в норму.
    //    Ограничение только: запрет на выходные.

    // 2. Сгенерировать все даты в диапазоне
    const allDates = generateDateRange(date_from, date_to);

    // 3. Определить рабочие дни (учитывая переопределения Admin)
    const overrides = await db('calendar_days')
      .whereIn('date', allDates)
      .select('date', 'day_type');
    const overrideMap = Object.fromEntries(overrides.map(o => [o.date, o.day_type]));

    const workingDates = allDates.filter(date => {
      const type = overrideMap[date] ?? getDefaultDayType(date);
      return type === 'working';
    });

    if (workingDates.length === 0) {
      throw { status: 400, code: 'NO_WORKING_DAYS', message: 'В выбранном диапазоне нет рабочих дней' };
    }

    // 4. Пропустить дни с Work Logs
    const workLogDates = await AbsenceRepository.findWorkLogDates(userId, workingDates);
    const workLogSet = new Set(workLogDates);

    // 5. Пропустить дни с уже существующими Absences
    const existingAbsenceDates = await AbsenceRepository.findAbsenceDates(userId, workingDates);
    const absenceSet = new Set(existingAbsenceDates);

    const skippedWorkLog = workingDates.filter(d => workLogSet.has(d));
    const skippedAbsence = workingDates.filter(d => absenceSet.has(d));
    const skippedWeekend = allDates.filter(d => !workingDates.includes(d));

    const validDates = workingDates.filter(d => !workLogSet.has(d) && !absenceSet.has(d));

    if (validDates.length === 0) {
      throw {
        status: 400,
        code: 'ALL_DAYS_SKIPPED',
        message: 'Все дни в диапазоне заняты или выходные',
        skipped: { weekends: skippedWeekend, work_logs: skippedWorkLog, absences: skippedAbsence },
      };
    }

    // 6. Создать записи
    const records = validDates.map(date => ({
      user_id: userId,
      type,
      date,
      duration_days: 1, // по умолчанию 1d
      comment: comment || null,
    }));

    const created = await AbsenceRepository.createMany(records);

    await AuditService.log({
      actorId: userId,
      eventType: 'ABSENCE_CREATED',
      entityType: 'absence',
      entityId: null,
      after: { type, dates: validDates },
      ip,
    });

    return {
      created,
      skipped: {
        weekends: skippedWeekend,
        work_logs: skippedWorkLog,
        absences: skippedAbsence,
      },
    };
  },

  async update({ id, userId, isAdmin, ip, ...data }) {
    const absence = await AbsenceRepository.findById(id);
    if (!absence) throw { status: 404, code: 'NOT_FOUND', message: 'Запись не найдена' };
    if (!isAdmin && absence.user_id !== userId) throw { status: 403, code: 'FORBIDDEN', message: 'Нет доступа' };

    const updateData = {};

    // Запрет переноса на выходной
    if (data.date) {
      const override = await db('calendar_days').where({ date: data.date }).first();
      const dayType = override?.day_type ?? getDefaultDayType(data.date);
      if (dayType !== 'working') {
        throw { status: 400, code: 'WEEKEND_DATE', message: 'Нельзя перенести отсутствие на выходной или праздник' };
      }

      // Запрет смешивания с Work Log
      const hasWorkLog = await db('work_logs')
        .where({ user_id: absence.user_id, date: data.date })
        .first();
      if (hasWorkLog) {
        throw { status: 400, code: 'WORK_LOG_CONFLICT', message: 'В этот день уже есть рабочий лог' };
      }

      updateData.date = data.date;
    }

    if (data.type) updateData.type = data.type;
    if (data.comment !== undefined) updateData.comment = data.comment;
    if (data.duration) updateData.duration_days = parseDurationToDays(data.duration);

    const before = { date: absence.date, type: absence.type, duration_days: absence.duration_days };
    const updated = await AbsenceRepository.updateById(id, updateData);

    await AuditService.log({
      actorId: userId,
      eventType: 'ABSENCE_UPDATED',
      entityType: 'absence',
      entityId: id,
      before,
      after: updateData,
      ip,
    });

    return { ...updated, duration_hours: daysToHours(updated.duration_days) };
  },

  async delete({ id, userId, isAdmin, ip }) {
    const absence = await AbsenceRepository.findById(id);
    if (!absence) throw { status: 404, code: 'NOT_FOUND', message: 'Запись не найдена' };
    if (!isAdmin && absence.user_id !== userId) throw { status: 403, code: 'FORBIDDEN', message: 'Нет доступа' };

    await AbsenceRepository.deleteById(id);

    await AuditService.log({
      actorId: userId,
      eventType: 'ABSENCE_DELETED',
      entityType: 'absence',
      entityId: id,
      before: { date: absence.date, type: absence.type },
      ip,
    });

    return { message: 'Запись удалена' };
  },
};

// Генерация всех дат в диапазоне включительно
function generateDateRange(from, to) {
  const dates = [];
  let current = dayjs(from);
  const end = dayjs(to);
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  return dates;
}
```

---

## Шаг 4. Контроллер

`src/controllers/absence.controller.js`:

```js
import { AbsenceService } from '@/services/absence.service.js';
import { createAbsenceSchema, updateAbsenceSchema, absenceFiltersSchema } from '@/validators/absence.validators.js';

export const AbsenceController = {

  async list(req, res, next) {
    try {
      const filters = absenceFiltersSchema.parse(req.query);
      const result = await AbsenceService.list({
        ...filters,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async create(req, res, next) {
    try {
      const data = createAbsenceSchema.parse(req.body);
      const result = await AbsenceService.create({
        ...data,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        ip: req.ip,
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const absence = await import('@/config/knex.js').then(m => m.default('absences').where({ id: req.params.id }).first());
      if (absence) req.workLogDate = absence.date;

      const data = updateAbsenceSchema.parse(req.body);
      const result = await AbsenceService.update({
        id: req.params.id,
        ...data,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        ip: req.ip,
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async delete(req, res, next) {
    try {
      const absence = await import('@/config/knex.js').then(m => m.default('absences').where({ id: req.params.id }).first());
      if (absence) req.workLogDate = absence.date;

      const result = await AbsenceService.delete({
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

## Шаг 5. Роутер

`src/routes/absenceRouter.js`:

```js
import { Router } from 'express';
import { AbsenceController } from '@/controllers/absence.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { checkMonthClosed } from '@/middlewares/checkMonthClosed.js';

const router = Router();

router.use(authenticate);

router.get('/', AbsenceController.list);
router.post('/', checkMonthClosed, AbsenceController.create);
router.patch('/:id', checkMonthClosed, AbsenceController.update);
router.delete('/:id', checkMonthClosed, AbsenceController.delete);

export default router;
```

Подключить в `app.js`:

```js
import absenceRouter from '@/routes/absenceRouter.js';
app.use('/api/absences', absenceRouter);
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | Создание диапазоном на рабочие дни | `POST /api/absences` `{ date_from: "2025-06-02", date_to: "2025-06-06" }` → `201`, созданы 5 записей (пн–пт) | ✅ Пройдено |
| 2 | Выходные автоматически пропускаются | Диапазон пн–вс → создаются только 5 рабочих дней; в ответе `skipped.weekends` содержит сб и вс | ✅ Пройдено |
| 3 | Дни с Work Logs пропускаются | Создать Work Log на среду → Absence на пн–пт → среда в `skipped.work_logs`, остальные созданы | ✅ Пройдено |
| 4 | Все дни заняты → ошибка | Диапазон только из выходных → `400 NO_WORKING_DAYS` | ✅ Пройдено |
| 5 | User видит только свои | `GET /api/absences` с User-cookie → только его записи | ✅ Пройдено |
| 6 | Admin видит все | `GET /api/absences?user_id=<uuid>` → записи любого пользователя | ✅ Пройдено |
| 7 | Редактирование: перенос на рабочий | `PATCH /api/absences/:id` `{ "date": "2025-06-09" }` (понедельник) → `200` | ✅ Пройдено |
| 8 | Запрет переноса на выходной | `PATCH` с датой воскресенья → `400 WEEKEND_DATE` | ✅ Пройдено |
| 9 | Запрет переноса на день с Work Log | `PATCH` с датой где есть Work Log → `400 WORK_LOG_CONFLICT` | ✅ Пройдено |
| 10 | Изменение длительности | `PATCH` `{ "duration": "4h" }` → `duration_days = 0.5`, `duration_hours = 4` | ✅ Пройдено |
| 11 | Удаление | `DELETE /api/absences/:id` → `200`; запись исчезает из БД | ✅ Пройдено |
| 12 | User не удаляет чужое | → `403 FORBIDDEN` | ✅ Пройдено |
| 13 | Закрытый месяц блокирует User | → `403 MONTH_CLOSED` | ✅ Пройдено |
| 14 | Admin работает в закрытом месяце | → `201` / `200` | ✅ Пройдено |
| 15 | Audit log пишется | `SELECT * FROM audit_logs WHERE entity_type='absence';` → записи есть | ✅ Пройдено |
