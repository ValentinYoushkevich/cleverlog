# MODULE_9 — Backend: Закрытие месяца

## Обзор

Модуль управления закрытием месяца. Закрытый месяц переводит все Work Logs и Absences в режим read-only для User. Admin сохраняет полный доступ. Middleware `checkMonthClosed` уже реализован в MODULE_7 и переиспользуется здесь.

---

## Шаг 1. Zod-схемы

`src/validators/monthClosure.validators.js`:

```js
import { z } from 'zod';

export const closeMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});
```

---

## Шаг 2. Репозиторий

`src/repositories/monthClosure.repository.js`:

```js
import db from '@/config/knex.js';

export const MonthClosureRepository = {

  findAll: () =>
    db('month_closures')
      .join('users as u', 'u.id', 'month_closures.closed_by')
      .select(
        'month_closures.id',
        'month_closures.year',
        'month_closures.month',
        'month_closures.closed_at',
        'u.first_name',
        'u.last_name',
        'u.email'
      )
      .orderBy([{ column: 'month_closures.year', order: 'desc' }, { column: 'month_closures.month', order: 'desc' }]),

  findByYearMonth: (year, month) =>
    db('month_closures').where({ year, month }).first(),

  create: (data) =>
    db('month_closures').insert(data).returning('*').then(r => r[0]),

  deleteByYearMonth: (year, month) =>
    db('month_closures').where({ year, month }).delete(),
};
```

---

## Шаг 3. Сервис

`src/services/monthClosure.service.js`:

```js
import { MonthClosureRepository } from '@/repositories/monthClosure.repository.js';
import { AuditService } from '@/services/audit.service.js';

export const MonthClosureService = {

  async list() {
    return MonthClosureRepository.findAll();
  },

  async close({ year, month, actorId, actorRole, ip }) {
    const existing = await MonthClosureRepository.findByYearMonth(year, month);
    if (existing) {
      throw { status: 409, code: 'ALREADY_CLOSED', message: 'Месяц уже закрыт' };
    }

    const closure = await MonthClosureRepository.create({
      year,
      month,
      closed_by: actorId,
    });

    await AuditService.log({
      actorId, actorRole,
      eventType: 'MONTH_CLOSED',
      entityType: 'month_closure',
      entityId: closure.id,
      after: { year, month },
      ip,
    });

    return closure;
  },

  async open({ year, month, actorId, actorRole, ip }) {
    const existing = await MonthClosureRepository.findByYearMonth(year, month);
    if (!existing) {
      throw { status: 404, code: 'NOT_CLOSED', message: 'Месяц не был закрыт' };
    }

    await MonthClosureRepository.deleteByYearMonth(year, month);

    await AuditService.log({
      actorId, actorRole,
      eventType: 'MONTH_OPENED',
      entityType: 'month_closure',
      entityId: existing.id,
      before: { year, month },
      ip,
    });

    return { message: `Месяц ${month}/${year} открыт` };
  },

  // Утилита для использования в других сервисах и middleware
  async isClosed(year, month) {
    const closure = await MonthClosureRepository.findByYearMonth(year, month);
    return !!closure;
  },
};
```

---

## Шаг 4. Контроллер

`src/controllers/monthClosure.controller.js`:

```js
import { MonthClosureService } from '@/services/monthClosure.service.js';
import { closeMonthSchema } from '@/validators/monthClosure.validators.js';

export const MonthClosureController = {

  async list(req, res, next) {
    try {
      const closures = await MonthClosureService.list();
      res.json(closures);
    } catch (err) { next(err); }
  },

  async close(req, res, next) {
    try {
      const { year, month } = closeMonthSchema.parse(req.body);
      const result = await MonthClosureService.close({
        year, month,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.status(201).json(result);
    } catch (err) { next(err); }
  },

  async open(req, res, next) {
    try {
      const year = Number(req.params.year);
      const month = Number(req.params.month);

      if (!year || !month) {
        return res.status(400).json({ code: 'INVALID_PARAMS', message: 'Неверные параметры year/month' });
      }

      const result = await MonthClosureService.open({
        year, month,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  // Проверка статуса одного месяца — удобно для фронта
  async status(req, res, next) {
    try {
      const year = Number(req.params.year);
      const month = Number(req.params.month);
      const closed = await MonthClosureService.isClosed(year, month);
      res.json({ year, month, closed });
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 5. Роутер

`src/routes/monthClosureRouter.js`:

```js
import { Router } from 'express';
import { MonthClosureController } from '@/controllers/monthClosure.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();

// Статус месяца — все авторизованные (нужен фронту для отображения lock-иконки)
router.get('/status/:year/:month', authenticate, MonthClosureController.status);

// CRUD закрытий — только Admin
router.use(authenticate, authorize('admin'));
router.get('/', MonthClosureController.list);
router.post('/', MonthClosureController.close);
router.delete('/:year/:month', MonthClosureController.open);

export default router;
```

Подключить в `app.js`:

```js
import monthClosureRouter from '@/routes/monthClosureRouter.js';
app.use('/api/month-closures', monthClosureRouter);
```

---

## Шаг 6. Обновление checkMonthClosed (уточнение)

`checkMonthClosed` из MODULE_7 уже покрывает все сценарии. Убедиться, что он подключён в `workLogRouter.js` и `absenceRouter.js`.

Для удобства — экспортировать `isClosed` из сервиса как утилиту:

```js
// Пример использования в других сервисах
import { MonthClosureService } from '@/services/monthClosure.service.js';
const closed = await MonthClosureService.isClosed(2025, 6);
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Закрытие месяца | `POST /api/month-closures` `{ year: 2025, month: 6 }` Admin-cookie → `201`; запись в `month_closures` |
| 2 | Повторное закрытие → ошибка | Тот же запрос → `409 ALREADY_CLOSED` |
| 3 | Статус месяца | `GET /api/month-closures/status/2025/6` → `{ closed: true }` |
| 4 | Список всех закрытий | `GET /api/month-closures` → массив с данными кто и когда закрыл |
| 5 | User заблокирован в закрытом | `POST /api/work-logs` с датой из закрытого месяца User-cookie → `403 MONTH_CLOSED` |
| 6 | Admin работает в закрытом | Те же действия Admin-cookie → `201` |
| 7 | Открытие месяца | `DELETE /api/month-closures/2025/6` Admin → `200`; запись удалена; User снова может логировать |
| 8 | Открытие незакрытого | `DELETE /api/month-closures/2025/7` (не закрыт) → `404 NOT_CLOSED` |
| 9 | Только Admin закрывает/открывает | С User-cookie → `403 FORBIDDEN` |
| 10 | Audit log пишется | `SELECT * FROM audit_logs WHERE entity_type='month_closure';` → записи о закрытии и открытии |
