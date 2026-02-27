# MODULE_6 — Backend: Календарь

## Обзор

Модуль управления календарём: настройка нормы часов на месяц, переопределение статуса дней (рабочий / выходной / праздник). Хранятся только те дни, которые Admin явно изменил — остальные считаются рабочими по умолчанию (пн–пт). Все операции логируются в audit_log.

MODULE_6 вводит dayjs — нужно npm install dayjs. Утилита isWorkingDay и getWorkingDays из utils/calendar.js переиспользуется в MODULE_7, MODULE_8 и MODULE_10.

---

## Шаг 1. Утилита: определение типа дня по умолчанию

`src/utils/calendar.js`:

```js
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
dayjs.extend(isoWeek);

/**
 * Возвращает тип дня по умолчанию (без учёта переопределений Admin).
 * 6 = суббота, 7 = воскресенье по ISO.
 */
export function getDefaultDayType(date) {
  const dow = dayjs(date).isoWeekday(); // 1=пн, 7=вс
  return dow >= 6 ? 'weekend' : 'working';
}

/**
 * Возвращает список рабочих дней в месяце (с учётом переопределений).
 * overrides: массив { date, day_type } из calendar_days
 */
export function getWorkingDays(year, month, overrides = []) {
  const overrideMap = Object.fromEntries(overrides.map(o => [o.date, o.day_type]));
  const days = [];
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const total = start.daysInMonth();

  for (let d = 1; d <= total; d++) {
    const date = start.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    const type = overrideMap[dateStr] ?? getDefaultDayType(dateStr);
    days.push({ date: dateStr, day_type: type });
  }
  return days;
}

/**
 * Проверяет, является ли дата рабочим днём (с учётом переопределений).
 */
export async function isWorkingDay(date, db) {
  const override = await db('calendar_days').where({ date }).first();
  if (override) return override.day_type === 'working';
  return getDefaultDayType(date) === 'working';
}
```

---

## Шаг 2. Zod-схемы

`src/validators/calendar.validators.js`:

```js
import { z } from 'zod';

export const updateDaySchema = z.object({
  day_type: z.enum(['working', 'weekend', 'holiday']),
});

export const normSchema = z.object({
  norm_hours: z.number().positive('Норма должна быть положительной'),
});
```

---

## Шаг 3. Репозиторий

`src/repositories/calendar.repository.js`:

```js
import db from '@/config/knex.js';

export const CalendarRepository = {

  // Получить все переопределения дней за месяц
  getOverrides: (year, month) => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(month).padStart(2, '0')}-31`;
    return db('calendar_days')
      .whereBetween('date', [start, end])
      .select('*');
  },

  // Найти переопределение конкретного дня
  getDayOverride: (date) =>
    db('calendar_days').where({ date }).first(),

  // Создать или обновить статус дня
  upsertDay: async (date, day_type) => {
    const existing = await db('calendar_days').where({ date }).first();
    if (existing) {
      return db('calendar_days')
        .where({ date })
        .update({ day_type, updated_at: db.fn.now() })
        .returning('*')
        .then(r => r[0]);
    }
    return db('calendar_days')
      .insert({ date, day_type })
      .returning('*')
      .then(r => r[0]);
  },

  // Норма часов
  getNorm: (year, month) =>
    db('calendar_settings').where({ year, month }).first(),

  upsertNorm: async (year, month, norm_hours) => {
    const existing = await db('calendar_settings').where({ year, month }).first();
    if (existing) {
      return db('calendar_settings')
        .where({ year, month })
        .update({ norm_hours, updated_at: db.fn.now() })
        .returning('*')
        .then(r => r[0]);
    }
    return db('calendar_settings')
      .insert({ year, month, norm_hours })
      .returning('*')
      .then(r => r[0]);
  },
};
```

---

## Шаг 4. Сервис

`src/services/calendar.service.js`:

```js
import { CalendarRepository } from '@/repositories/calendar.repository.js';
import { AuditService } from '@/services/audit.service.js';
import { getWorkingDays } from '@/utils/calendar.js';

const DEFAULT_NORM = 168;

export const CalendarService = {

  async getMonth(year, month) {
    const overrides = await CalendarRepository.getOverrides(year, month);
    const days = getWorkingDays(year, month, overrides);
    const normRow = await CalendarRepository.getNorm(year, month);
    const norm_hours = normRow?.norm_hours ?? DEFAULT_NORM;

    return { year, month, norm_hours, days };
  },

  async updateDay({ date, day_type, actorId, actorRole, ip }) {
    // Запрет изменения будущих? — Нет, Admin может настраивать будущие месяцы
    const existing = await CalendarRepository.getDayOverride(date);
    const before = existing ? { day_type: existing.day_type } : null;

    const updated = await CalendarRepository.upsertDay(date, day_type);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CALENDAR_DAY_UPDATED',
      entityType: 'calendar',
      entityId: null,
      before,
      after: { date, day_type },
      ip,
    });

    return updated;
  },

  async getNorm(year, month) {
    const normRow = await CalendarRepository.getNorm(year, month);
    return { year, month, norm_hours: normRow?.norm_hours ?? DEFAULT_NORM };
  },

  async updateNorm({ year, month, norm_hours, actorId, actorRole, ip }) {
    const existing = await CalendarRepository.getNorm(year, month);
    const before = existing ? { norm_hours: existing.norm_hours } : null;

    const updated = await CalendarRepository.upsertNorm(year, month, norm_hours);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'CALENDAR_NORM_UPDATED',
      entityType: 'calendar',
      entityId: null,
      before,
      after: { year, month, norm_hours },
      ip,
    });

    return updated;
  },
};
```

---

## Шаг 5. Контроллер

`src/controllers/calendar.controller.js`:

```js
import { CalendarService } from '@/services/calendar.service.js';
import { updateDaySchema, normSchema } from '@/validators/calendar.validators.js';

export const CalendarController = {

  async getMonth(req, res, next) {
    try {
      const { year, month } = req.params;
      const data = await CalendarService.getMonth(Number(year), Number(month));
      res.json(data);
    } catch (err) { next(err); }
  },

  async updateDay(req, res, next) {
    try {
      const { date } = req.params;
      const { day_type } = updateDaySchema.parse(req.body);
      const result = await CalendarService.updateDay({
        date, day_type,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async getNorm(req, res, next) {
    try {
      const { year, month } = req.params;
      const result = await CalendarService.getNorm(Number(year), Number(month));
      res.json(result);
    } catch (err) { next(err); }
  },

  async updateNorm(req, res, next) {
    try {
      const { year, month } = req.params;
      const { norm_hours } = normSchema.parse(req.body);
      const result = await CalendarService.updateNorm({
        year: Number(year),
        month: Number(month),
        norm_hours,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.json(result);
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 6. Роутер

`src/routes/calendarRouter.js`:

```js
import { Router } from 'express';
import { CalendarController } from '@/controllers/calendar.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();

// Чтение — все авторизованные
router.get('/:year/:month', authenticate, CalendarController.getMonth);
router.get('/norm/:year/:month', authenticate, CalendarController.getNorm);

// Запись — только Admin
router.patch('/days/:date', authenticate, authorize('admin'), CalendarController.updateDay);
router.put('/norm/:year/:month', authenticate, authorize('admin'), CalendarController.updateNorm);

export default router;
```

Подключить в `app.js`:

```js
import calendarRouter from '@/routes/calendarRouter.js';
app.use('/api/calendar', calendarRouter);
```

Установить `dayjs`:

```bash
npm install dayjs
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | `GET /api/calendar/2025/6` возвращает данные | Ответ содержит `year`, `month`, `norm_hours`, `days` (массив дней с типами) | ✅ Пройдено |
| 2 | Выходные по умолчанию | В массиве `days` суббота и воскресенье имеют `day_type: "weekend"` | ✅ Пройдено |
| 3 | Смена статуса дня | `PATCH /api/calendar/days/2025-06-02` `{ "day_type": "holiday" }` → `200`; повторный `GET` — день с типом `holiday` | ✅ Пройдено |
| 4 | Данные не удаляются при смене | Work Logs за этот день сохраняются в БД — `SELECT * FROM work_logs WHERE date = '2025-06-02'` | ✅ Пройдено |
| 5 | Выходной → рабочий | Смена обратно на `working` → день снова рабочий в ответе | ✅ Пройдено |
| 6 | Получение нормы | `GET /api/calendar/norm/2025/6` → `{ norm_hours: 168 }` (дефолт если не задана) | ✅ Пройдено |
| 7 | Обновление нормы | `PUT /api/calendar/norm/2025/6` `{ "norm_hours": 160 }` → `200`; повторный GET → `160` | ✅ Пройдено |
| 8 | Только Admin может менять | С User-cookie → `PATCH /api/calendar/days/:date` → `403 FORBIDDEN` | ✅ Пройдено |
| 9 | Audit log пишется | После смены дня и нормы → `SELECT * FROM audit_logs WHERE entity_type='calendar';` | ✅ Пройдено |
