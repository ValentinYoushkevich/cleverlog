# MODULE_10 — Backend: Отчёты и экспорт Excel

## Обзор

Модуль формирует четыре типа отчётов: по пользователю, по проекту, сводный по месяцу, список незаполнивших дни. Для каждого отчёта доступен экспорт в Excel через `exceljs`. Вся логика агрегации — в сервисном слое.

MODULE_10 самый тяжёлый — агрегирует данные из всех предыдущих таблиц. Его стоит реализовывать последним и, когда данные в БД уже есть.

---

## Шаг 1. Утилита: вычисление факта и нормы

`src/utils/reportHelpers.js`:

```js
import { getWorkingDays } from '@/utils/calendar.js';
import { daysToHours } from '@/utils/duration.js';

/**
 * Считает факт пользователя за месяц: Work + Absence (в часах).
 */
export function calcFact(workLogs, absences) {
  const workHours = workLogs.reduce((sum, l) => sum + parseFloat(l.duration_days) * 8, 0);
  const absenceHours = absences.reduce((sum, a) => sum + parseFloat(a.duration_days) * 8, 0);
  return Math.round((workHours + absenceHours) * 100) / 100;
}

/**
 * Считает количество незаполненных рабочих дней пользователя за месяц.
 * loggedDates: Set<string> — даты, где есть хотя бы один Work Log или Absence.
 */
export function calcUnloggedDays(year, month, loggedDates, calendarOverrides = []) {
  const days = getWorkingDays(year, month, calendarOverrides);
  const today = new Date().toISOString().slice(0, 10);
  return days.filter(d => d.day_type === 'working' && d.date <= today && !loggedDates.has(d.date));
}
```

---

## Шаг 2. Репозиторий отчётов

`src/repositories/report.repository.js`:

```js
import db from '@/config/knex.js';

export const ReportRepository = {

  // Work Logs за период для пользователя (или всех)
  getWorkLogs: ({ userId, projectId, dateFrom, dateTo }) => {
    const query = db('work_logs as wl')
      .join('projects as p', 'p.id', 'wl.project_id')
      .join('users as u', 'u.id', 'wl.user_id')
      .select(
        'wl.id', 'wl.date', 'wl.duration_days', 'wl.comment', 'wl.task_number',
        'wl.user_id', 'wl.project_id',
        'p.name as project_name',
        'u.first_name', 'u.last_name', 'u.position'
      )
      .orderBy('wl.date');

    if (userId) query.where('wl.user_id', userId);
    if (projectId) query.where('wl.project_id', projectId);
    if (dateFrom) query.where('wl.date', '>=', dateFrom);
    if (dateTo) query.where('wl.date', '<=', dateTo);

    return query;
  },

  // Absences за период
  getAbsences: ({ userId, dateFrom, dateTo }) => {
    const query = db('absences as a')
      .join('users as u', 'u.id', 'a.user_id')
      .select('a.*', 'u.first_name', 'u.last_name')
      .orderBy('a.date');

    if (userId) query.where('a.user_id', userId);
    if (dateFrom) query.where('a.date', '>=', dateFrom);
    if (dateTo) query.where('a.date', '<=', dateTo);

    return query;
  },

  // Все активные пользователи
  getActiveUsers: () =>
    db('users').where({ status: 'active' }).select('*').orderBy('last_name'),

  // Кастомные значения для списка work_log_id
  getCustomValues: (workLogIds) => {
    if (!workLogIds.length) return [];
    return db('work_log_custom_values as wcv')
      .join('custom_fields as cf', 'cf.id', 'wcv.custom_field_id')
      .whereIn('wcv.work_log_id', workLogIds)
      .where('cf.is_deleted', false)
      .select('wcv.work_log_id', 'wcv.value', 'cf.name as field_name', 'cf.type');
  },

  // Все проекты
  getAllProjects: () =>
    db('projects').select('*').orderBy('name'),
};
```

---

## Шаг 3. Сервис отчётов

`src/services/report.service.js`:

```js
import dayjs from 'dayjs';
import db from '@/config/knex.js';
import { ReportRepository } from '@/repositories/report.repository.js';
import { CalendarRepository } from '@/repositories/calendar.repository.js';
import { calcFact, calcUnloggedDays } from '@/utils/reportHelpers.js';
import { daysToHours } from '@/utils/duration.js';

const DEFAULT_NORM = 168;

export const ReportService = {

  // (1) Отчёт по пользователю
  async userReport({ userId, isAdmin, targetUserId, dateFrom, dateTo, projectId, type, taskNumber, comment }) {
    const effectiveUserId = isAdmin ? targetUserId : userId;

    const workLogs = await ReportRepository.getWorkLogs({ userId: effectiveUserId, projectId, dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ userId: effectiveUserId, dateFrom, dateTo });

    // Фильтрация по типу
    const filteredAbsences = type && type !== 'work'
      ? absences.filter(a => a.type === type)
      : absences;
    const filteredWork = (!type || type === 'work') ? workLogs : [];

    // Фильтр по task_number и comment
    const finalWork = filteredWork.filter(l => {
      if (taskNumber && !l.task_number.toLowerCase().includes(taskNumber.toLowerCase())) return false;
      if (comment && !l.comment.toLowerCase().includes(comment.toLowerCase())) return false;
      return true;
    });

    // Кастомные поля
    const customValues = await ReportRepository.getCustomValues(finalWork.map(l => l.id));
    const customByLog = groupBy(customValues, 'work_log_id');

    const rows = [
      ...finalWork.map(l => ({
        type: 'work',
        date: l.date,
        project_name: l.project_name,
        task_number: l.task_number,
        duration_hours: daysToHours(l.duration_days),
        comment: l.comment,
        custom_fields: customByLog[l.id] || [],
      })),
      ...filteredAbsences.map(a => ({
        type: a.type,
        date: a.date,
        duration_hours: daysToHours(a.duration_days),
        comment: a.comment || '',
        project_name: null,
        task_number: null,
        custom_fields: [],
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    // Итоги
    const totalHours = rows.reduce((s, r) => s + r.duration_hours, 0);
    const byProject = groupAndSum(finalWork, 'project_name', 'duration_days');
    const byType = {
      work: sumDays(finalWork),
      vacation: sumDays(filteredAbsences.filter(a => a.type === 'vacation')),
      sick_leave: sumDays(filteredAbsences.filter(a => a.type === 'sick_leave')),
      day_off: sumDays(filteredAbsences.filter(a => a.type === 'day_off')),
    };

    // Блок Факт/Норма/Отклонение — только при полном месяце
    let normBlock = null;
    if (isFullMonth(dateFrom, dateTo)) {
      const [year, month] = dateFrom.split('-').map(Number);
      const normRow = await CalendarRepository.getNorm(year, month);
      const norm = normRow?.norm_hours ?? DEFAULT_NORM;
      const fact = calcFact(workLogs, absences);
      normBlock = { norm, fact, deviation: Math.round((fact - norm) * 100) / 100 };
    }

    return { rows, totals: { total_hours: totalHours, by_project: byProject, by_type: byType }, norm_block: normBlock };
  },

  // (2) Отчёт по проекту (только Work)
  async projectReport({ projectId, dateFrom, dateTo, userId, taskNumber, comment }) {
    const workLogs = await ReportRepository.getWorkLogs({ projectId, dateFrom, dateTo });

    const filtered = workLogs.filter(l => {
      if (userId && l.user_id !== userId) return false;
      if (taskNumber && !l.task_number.toLowerCase().includes(taskNumber.toLowerCase())) return false;
      if (comment && !l.comment.toLowerCase().includes(comment.toLowerCase())) return false;
      return true;
    });

    const customValues = await ReportRepository.getCustomValues(filtered.map(l => l.id));
    const customByLog = groupBy(customValues, 'work_log_id');

    const rows = filtered.map(l => ({
      user: `${l.last_name} ${l.first_name}`,
      position: l.position,
      date: l.date,
      project_name: l.project_name,
      task_number: l.task_number,
      duration_hours: daysToHours(l.duration_days),
      comment: l.comment,
      custom_fields: customByLog[l.id] || [],
    }));

    const totalHours = rows.reduce((s, r) => s + r.duration_hours, 0);
    const byUser = groupAndSum(filtered, r => `${r.last_name} ${r.first_name}`, 'duration_days');

    return { rows, totals: { total_hours: totalHours, by_user: byUser } };
  },

  // (3) Сводный отчёт по месяцу
  async monthlySummary({ year, month }) {
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');

    const users = await ReportRepository.getActiveUsers();
    const projects = await ReportRepository.getAllProjects();
    const workLogs = await ReportRepository.getWorkLogs({ dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ dateFrom, dateTo });

    const normRow = await CalendarRepository.getNorm(year, month);
    const norm = normRow?.norm_hours ?? DEFAULT_NORM;

    const rows = users.map(user => {
      const userLogs = workLogs.filter(l => l.user_id === user.id);
      const userAbsences = absences.filter(a => a.user_id === user.id);

      const byProject = {};
      for (const proj of projects) {
        const hours = daysToHours(
          userLogs.filter(l => l.project_id === proj.id).reduce((s, l) => s + parseFloat(l.duration_days), 0)
        );
        byProject[proj.id] = hours;
      }

      const absenceHours = daysToHours(userAbsences.reduce((s, a) => s + parseFloat(a.duration_days), 0));
      const fact = calcFact(userLogs, userAbsences);

      return {
        user_id: user.id,
        user_name: `${user.last_name} ${user.first_name}`,
        by_project: byProject,
        absence_hours: absenceHours,
        fact_hours: fact,
        is_on_norm: Math.abs(fact - norm) < 0.01,
      };
    });

    // Итоговая строка
    const totals = { by_project: {}, absence_hours: 0, fact_hours: 0 };
    for (const row of rows) {
      for (const [pid, h] of Object.entries(row.by_project)) {
        totals.by_project[pid] = (totals.by_project[pid] || 0) + h;
      }
      totals.absence_hours += row.absence_hours;
      totals.fact_hours += row.fact_hours;
    }

    return { year, month, norm, projects, rows, totals };
  },

  // (4) Незаполнившие дни
  async unlogged({ year, month }) {
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');

    const users = await ReportRepository.getActiveUsers();
    const workLogs = await ReportRepository.getWorkLogs({ dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ dateFrom, dateTo });
    const overrides = await CalendarRepository.getOverrides(year, month);
    const normRow = await CalendarRepository.getNorm(year, month);
    const norm = normRow?.norm_hours ?? DEFAULT_NORM;

    const result = [];

    for (const user of users) {
      const userLogs = workLogs.filter(l => l.user_id === user.id);
      const userAbsences = absences.filter(a => a.user_id === user.id);

      const loggedDates = new Set([
        ...userLogs.map(l => l.date),
        ...userAbsences.map(a => a.date),
      ]);

      const unloggedDays = calcUnloggedDays(year, month, loggedDates, overrides);

      if (unloggedDays.length > 0) {
        const fact = calcFact(userLogs, userAbsences);
        const lastLog = userLogs.sort((a, b) => b.date.localeCompare(a.date))[0];
        result.push({
          user_id: user.id,
          user_name: `${user.last_name} ${user.first_name}`,
          unlogged_count: unloggedDays.length,
          unlogged_dates: unloggedDays.map(d => d.date),
          fact_hours: fact,
          last_log_date: lastLog?.date || null,
        });
      }
    }

    return { count: result.length, users: result };
  },
};

// Хелперы
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});
}

function groupAndSum(arr, keyFn, valueKey) {
  const result = {};
  for (const item of arr) {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    result[key] = (result[key] || 0) + daysToHours(parseFloat(item[valueKey]));
  }
  return result;
}

function sumDays(arr) {
  return daysToHours(arr.reduce((s, i) => s + parseFloat(i.duration_days || 0), 0));
}

function isFullMonth(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return false;
  const from = dayjs(dateFrom);
  const to = dayjs(dateTo);
  return from.date() === 1 && to.date() === to.daysInMonth() && from.month() === to.month();
}
```

---

## Шаг 4. Сервис экспорта Excel

`src/services/export.service.js`:

```js
import ExcelJS from 'exceljs';
import { ReportService } from '@/services/report.service.js';

export const ExportService = {

  async exportUser(params) {
    const { rows } = await ReportService.userReport(params);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Отчёт по пользователю');

    ws.columns = [
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Тип записи', key: 'type', width: 16 },
      { header: 'Проект', key: 'project_name', width: 24 },
      { header: 'Task Number', key: 'task_number', width: 16 },
      { header: 'Длительность (ч)', key: 'duration_hours', width: 18 },
      { header: 'Комментарий', key: 'comment', width: 40 },
    ];

    for (const row of rows) {
      ws.addRow(row);
    }

    styleHeader(ws);
    return wb;
  },

  async exportProject(params) {
    const { rows } = await ReportService.projectReport(params);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Отчёт по проекту');

    ws.columns = [
      { header: 'Сотрудник', key: 'user', width: 24 },
      { header: 'Должность', key: 'position', width: 20 },
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Проект', key: 'project_name', width: 24 },
      { header: 'Task Number', key: 'task_number', width: 16 },
      { header: 'Длительность (ч)', key: 'duration_hours', width: 18 },
      { header: 'Комментарий', key: 'comment', width: 40 },
    ];

    for (const row of rows) {
      ws.addRow(row);
    }

    styleHeader(ws);
    return wb;
  },

  async exportMonthlySummary({ year, month }) {
    const { projects, rows, totals, norm } = await ReportService.monthlySummary({ year, month });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Сводный отчёт');

    // Динамические колонки: Сотрудник + проекты + Absence + Факт
    const columns = [
      { header: 'Сотрудник', key: 'user_name', width: 24 },
      ...projects.map(p => ({ header: p.name, key: `proj_${p.id}`, width: 16 })),
      { header: 'Отсутствие (ч)', key: 'absence_hours', width: 16 },
      { header: 'Факт (ч)', key: 'fact_hours', width: 14 },
    ];
    ws.columns = columns;

    for (const row of rows) {
      const excelRow = {
        user_name: row.user_name,
        absence_hours: row.absence_hours,
        fact_hours: row.fact_hours,
      };
      for (const proj of projects) {
        excelRow[`proj_${proj.id}`] = row.by_project[proj.id] || 0;
      }
      const addedRow = ws.addRow(excelRow);

      // Подсветка строк: зелёный = норма, жёлтый = отклонение
      addedRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: row.is_on_norm ? 'FFD4EDDA' : 'FFFFF3CD' },
      };
    }

    // Итоговая строка TOTAL
    const totalRow = { user_name: 'TOTAL', absence_hours: totals.absence_hours, fact_hours: totals.fact_hours };
    for (const proj of projects) {
      totalRow[`proj_${proj.id}`] = totals.by_project[proj.id] || 0;
    }
    const tr = ws.addRow(totalRow);
    tr.font = { bold: true };

    styleHeader(ws);
    return wb;
  },

  async exportUnlogged({ year, month }) {
    const { users } = await ReportService.unlogged({ year, month });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Незаполненные дни');

    ws.columns = [
      { header: 'Сотрудник', key: 'user_name', width: 24 },
      { header: 'Незаполнено дней', key: 'unlogged_count', width: 18 },
      { header: 'Даты', key: 'unlogged_dates', width: 40 },
      { header: 'Факт (ч)', key: 'fact_hours', width: 14 },
      { header: 'Последний лог', key: 'last_log_date', width: 16 },
    ];

    for (const u of users) {
      ws.addRow({ ...u, unlogged_dates: u.unlogged_dates.join(', ') });
    }

    styleHeader(ws);
    return wb;
  },
};

function styleHeader(ws) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' },
  };
}
```

---

## Шаг 5. Контроллер

`src/controllers/report.controller.js`:

```js
import { ReportService } from '@/services/report.service.js';
import { ExportService } from '@/services/export.service.js';

async function sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

export const ReportController = {

  async userReport(req, res, next) {
    try {
      const result = await ReportService.userReport({
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        targetUserId: req.query.user_id,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
        projectId: req.query.project_id,
        type: req.query.type,
        taskNumber: req.query.task_number,
        comment: req.query.comment,
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async exportUser(req, res, next) {
    try {
      const wb = await ExportService.exportUser({
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        targetUserId: req.query.user_id,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
      });
      await sendWorkbook(res, wb, 'report_user');
    } catch (err) { next(err); }
  },

  async projectReport(req, res, next) {
    try {
      const result = await ReportService.projectReport({
        projectId: req.query.project_id,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
        userId: req.query.user_id,
        taskNumber: req.query.task_number,
        comment: req.query.comment,
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async exportProject(req, res, next) {
    try {
      const wb = await ExportService.exportProject({
        projectId: req.query.project_id,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
      });
      await sendWorkbook(res, wb, 'report_project');
    } catch (err) { next(err); }
  },

  async monthlySummary(req, res, next) {
    try {
      const result = await ReportService.monthlySummary({
        year: Number(req.query.year),
        month: Number(req.query.month),
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async exportMonthlySummary(req, res, next) {
    try {
      const wb = await ExportService.exportMonthlySummary({
        year: Number(req.query.year),
        month: Number(req.query.month),
      });
      await sendWorkbook(res, wb, 'report_monthly_summary');
    } catch (err) { next(err); }
  },

  async unlogged(req, res, next) {
    try {
      const result = await ReportService.unlogged({
        year: Number(req.query.year),
        month: Number(req.query.month),
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  async exportUnlogged(req, res, next) {
    try {
      const wb = await ExportService.exportUnlogged({
        year: Number(req.query.year),
        month: Number(req.query.month),
      });
      await sendWorkbook(res, wb, 'report_unlogged');
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 6. Роутер

`src/routes/reportRouter.js`:

```js
import { Router } from 'express';
import { ReportController } from '@/controllers/report.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();
router.use(authenticate);

// Отчёт по пользователю — все авторизованные (User видит только себя)
router.get('/user', ReportController.userReport);
router.get('/user/export', ReportController.exportUser);

// Admin-only отчёты
router.get('/project', authorize('admin'), ReportController.projectReport);
router.get('/project/export', authorize('admin'), ReportController.exportProject);
router.get('/monthly-summary', authorize('admin'), ReportController.monthlySummary);
router.get('/monthly-summary/export', authorize('admin'), ReportController.exportMonthlySummary);
router.get('/unlogged', authorize('admin'), ReportController.unlogged);
router.get('/unlogged/export', authorize('admin'), ReportController.exportUnlogged);

export default router;
```

Подключить в `app.js`:

```js
import reportRouter from '@/routes/reportRouter.js';
app.use('/api/reports', reportRouter);
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Отчёт по пользователю | `GET /api/reports/user?date_from=2025-06-01&date_to=2025-06-30` → `rows`, `totals` |
| 2 | User видит только свои данные | С User-cookie без `user_id` → только его записи |
| 3 | Admin смотрит чужой | `?user_id=<uuid>` с Admin-cookie → данные указанного пользователя |
| 4 | Блок норма/факт при полном месяце | `?date_from=2025-06-01&date_to=2025-06-30` → `norm_block` содержит `norm`, `fact`, `deviation` |
| 5 | Блок норма/факт при неполном периоде | `?date_from=2025-06-01&date_to=2025-06-15` → `norm_block: null` |
| 6 | Отчёт по проекту | `GET /api/reports/project?project_id=<uuid>` → строки с сотрудниками, итоги по пользователям |
| 7 | Отчёт по проекту для User | → `403 FORBIDDEN` |
| 8 | Сводный отчёт | `GET /api/reports/monthly-summary?year=2025&month=6` → `rows` с `by_project`, `absence_hours`, `fact_hours`, `is_on_norm` |
| 9 | Незаполнившие | `GET /api/reports/unlogged?year=2025&month=6` → список пользователей с `unlogged_count > 0` |
| 10 | Экспорт пользователя | `GET /api/reports/user/export` → скачивается `.xlsx` файл с корректными колонками |
| 11 | Экспорт сводного | `.xlsx` с динамическими колонками по проектам + цветовая подсветка строк |
| 12 | Экспорт незаполнивших | `.xlsx` с датами через запятую в колонке `Даты` |
| 13 | Фильтрация по типу | `?type=vacation` → только отсутствия vacation в отчёте пользователя |
| 14 | Фильтрация по Task Number | `?task_number=TASK-1` → только совпадения |
