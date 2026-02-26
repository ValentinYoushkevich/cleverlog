# MODULE_12 — Backend: Журнал аудита

## Обзор

Модуль предоставляет Admin доступ к журналу аудита с фильтрацией, пагинацией и экспортом в Excel. Сами записи создаются через `AuditService` (реализован в MODULE_2) во всех предыдущих модулях — здесь только чтение и экспорт.

> **Зависимости модуля:**
> - `AuditService.log` из MODULE_2 — уже используется во всех предыдущих модулях, здесь не изменяется
> - `ExcelJS` из MODULE_10 — переиспользуем паттерн экспорта

---

## Шаг 1. Zod-схемы

`src/validators/auditLog.validators.js`:

```js
import { z } from 'zod';

export const auditLogFiltersSchema = z.object({
  actor_id: z.string().uuid().optional(),
  event_type: z.string().optional(),
  entity_type: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  ip: z.string().optional(),
  result: z.enum(['success', 'failure']).optional(),
  search: z.string().optional(),          // поиск по event_type, entity_type
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
```

---

## Шаг 2. Репозиторий

`src/repositories/auditLog.repository.js`:

```js
import db from '@/config/knex.js';

export const AuditLogRepository = {

  findAll: ({ actorId, eventType, entityType, dateFrom, dateTo, ip, result, search, page, limit }) => {
    const query = db('audit_logs as al')
      .leftJoin('users as u', 'u.id', 'al.actor_id')
      .select(
        'al.id', 'al.timestamp', 'al.actor_id', 'al.actor_role',
        'al.event_type', 'al.entity_type', 'al.entity_id',
        'al.before', 'al.after', 'al.ip', 'al.result',
        'u.first_name', 'u.last_name', 'u.email as actor_email'
      )
      .orderBy('al.timestamp', 'desc');

    if (actorId) query.where('al.actor_id', actorId);
    if (eventType) query.where('al.event_type', eventType);
    if (entityType) query.where('al.entity_type', entityType);
    if (dateFrom) query.where('al.timestamp', '>=', dateFrom);
    if (dateTo) query.where('al.timestamp', '<=', dateTo + ' 23:59:59');
    if (ip) query.whereILike('al.ip', `%${ip}%`);
    if (result) query.where('al.result', result);
    if (search) {
      query.where(function () {
        this.whereILike('al.event_type', `%${search}%`)
          .orWhereILike('al.entity_type', `%${search}%`);
      });
    }

    return query.paginate({ currentPage: page, perPage: limit });
  },

  // Для экспорта — без пагинации, с теми же фильтрами
  findAllRaw: (filters) => {
    const query = db('audit_logs as al')
      .leftJoin('users as u', 'u.id', 'al.actor_id')
      .select(
        'al.timestamp', 'al.actor_role', 'al.event_type', 'al.entity_type',
        'al.entity_id', 'al.ip', 'al.result',
        'u.first_name', 'u.last_name', 'u.email as actor_email'
      )
      .orderBy('al.timestamp', 'desc');

    const { actorId, eventType, entityType, dateFrom, dateTo, ip, result, search } = filters;
    if (actorId) query.where('al.actor_id', actorId);
    if (eventType) query.where('al.event_type', eventType);
    if (entityType) query.where('al.entity_type', entityType);
    if (dateFrom) query.where('al.timestamp', '>=', dateFrom);
    if (dateTo) query.where('al.timestamp', '<=', dateTo + ' 23:59:59');
    if (ip) query.whereILike('al.ip', `%${ip}%`);
    if (result) query.where('al.result', result);
    if (search) {
      query.where(function () {
        this.whereILike('al.event_type', `%${search}%`)
          .orWhereILike('al.entity_type', `%${search}%`);
      });
    }

    return query;
  },

  // Уникальные значения для фильтров-подсказок на фронте
  getDistinctEventTypes: () =>
    db('audit_logs').distinct('event_type').orderBy('event_type').pluck('event_type'),

  getDistinctEntityTypes: () =>
    db('audit_logs').distinct('entity_type').orderBy('entity_type').pluck('entity_type'),
};
```

---

## Шаг 3. Сервис

`src/services/auditLog.service.js`:

```js
import ExcelJS from 'exceljs';
import { AuditLogRepository } from '@/repositories/auditLog.repository.js';

export const AuditLogService = {

  async list(filters) {
    return AuditLogRepository.findAll(filters);
  },

  async getFilterOptions() {
    const [event_types, entity_types] = await Promise.all([
      AuditLogRepository.getDistinctEventTypes(),
      AuditLogRepository.getDistinctEntityTypes(),
    ]);
    return { event_types, entity_types };
  },

  async export(filters) {
    const rows = await AuditLogRepository.findAllRaw(filters);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Журнал аудита');

    ws.columns = [
      { header: 'Время', key: 'timestamp', width: 22 },
      { header: 'Актор', key: 'actor', width: 28 },
      { header: 'Роль', key: 'actor_role', width: 12 },
      { header: 'Событие', key: 'event_type', width: 28 },
      { header: 'Сущность', key: 'entity_type', width: 20 },
      { header: 'ID сущности', key: 'entity_id', width: 38 },
      { header: 'IP', key: 'ip', width: 16 },
      { header: 'Результат', key: 'result', width: 12 },
    ];

    for (const row of rows) {
      ws.addRow({
        timestamp: new Date(row.timestamp).toLocaleString('ru-RU'),
        actor: row.actor_email
          ? `${row.last_name} ${row.first_name} (${row.actor_email})`
          : 'Система',
        actor_role: row.actor_role || '—',
        event_type: row.event_type,
        entity_type: row.entity_type,
        entity_id: row.entity_id || '—',
        ip: row.ip || '—',
        result: row.result,
      });
    }

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    return wb;
  },
};
```

---

## Шаг 4. Контроллер

`src/controllers/auditLog.controller.js`:

```js
import { AuditLogService } from '@/services/auditLog.service.js';
import { auditLogFiltersSchema } from '@/validators/auditLog.validators.js';

export const AuditLogController = {

  async list(req, res, next) {
    try {
      const filters = auditLogFiltersSchema.parse(req.query);
      const result = await AuditLogService.list(filters);
      res.json(result);
    } catch (err) { next(err); }
  },

  async filterOptions(req, res, next) {
    try {
      const options = await AuditLogService.getFilterOptions();
      res.json(options);
    } catch (err) { next(err); }
  },

  async export(req, res, next) {
    try {
      const filters = auditLogFiltersSchema.parse(req.query);
      const wb = await AuditLogService.export(filters);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_log.xlsx"');
      await wb.xlsx.write(res);
      res.end();
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 5. Роутер

`src/routes/auditLogRouter.js`:

```js
import { Router } from 'express';
import { AuditLogController } from '@/controllers/auditLog.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', AuditLogController.list);
router.get('/filter-options', AuditLogController.filterOptions);
router.get('/export', AuditLogController.export);

export default router;
```

Подключить в `app.js`:

```js
import auditLogRouter from '@/routes/auditLogRouter.js';
app.use('/api/audit-logs', auditLogRouter);
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Только Admin | `GET /api/audit-logs` с User-cookie → `403 FORBIDDEN` |
| 2 | Список с пагинацией | `GET /api/audit-logs?page=1&limit=10` → `{ data: [...], pagination: { ... } }` |
| 3 | Фильтр по event_type | `?event_type=LOGIN` → только события логина |
| 4 | Фильтр по entity_type | `?entity_type=user` → только события с пользователями |
| 5 | Фильтр по result | `?result=failure` → только неуспешные попытки |
| 6 | Фильтр по периоду | `?date_from=2025-06-01&date_to=2025-06-30` → только за июнь |
| 7 | Поиск по search | `?search=WORK_LOG` → записи где event_type или entity_type содержит строку |
| 8 | before/after в записи | После логина → запись содержит `after` с данными (или null в зависимости от события) |
| 9 | Подсказки фильтров | `GET /api/audit-logs/filter-options` → `{ event_types: [...], entity_types: [...] }` |
| 10 | Экспорт | `GET /api/audit-logs/export` → скачивается `audit_log.xlsx` с корректными колонками |
| 11 | Экспорт с фильтрами | `?event_type=LOGIN` → в Excel только записи логина |
| 12 | Записи от всех модулей присутствуют | После работы с системой → в журнале есть записи по `user`, `project`, `work_log`, `absence`, `calendar` |
