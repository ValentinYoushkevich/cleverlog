# MODULE_11 — Backend: Дашборд

## Обзор

Модуль агрегирует данные для Admin-дашборда: часы по проектам, распределение сотрудников, карточки недоработки/переработки/незаполненных дней, детализация по каждой карточке. Все данные зависят от выбранного периода.

> **Зависимости модуля:**
> - Переиспользует `ReportService.unlogged` из MODULE_10 для виджета незаполнивших
> - Переиспользует `calcFact` из `utils/reportHelpers.js` (MODULE_10)
> - Переиспользует `CalendarRepository.getNorm` из MODULE_6
> - Переиспользует `ReportRepository` из MODULE_10

---

## Шаг 1. Сервис

`src/services/dashboard.service.js`:

```js
import dayjs from 'dayjs';
import { ReportRepository } from '@/repositories/report.repository.js';
import { CalendarRepository } from '@/repositories/calendar.repository.js';
import { calcFact, calcUnloggedDays } from '@/utils/reportHelpers.js';
import { daysToHours } from '@/utils/duration.js';

const DEFAULT_NORM = 168;

export const DashboardService = {

  async getSummary({ year, month }) {
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');

    const users = await ReportRepository.getActiveUsers();
    const projects = await ReportRepository.getAllProjects();
    const workLogs = await ReportRepository.getWorkLogs({ dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ dateFrom, dateTo });
    const overrides = await CalendarRepository.getOverrides(year, month);
    const normRow = await CalendarRepository.getNorm(year, month);
    const norm = normRow?.norm_hours ?? DEFAULT_NORM;

    // --- Часы по проектам (круговая диаграмма 1) ---
    const hoursByProject = {};
    for (const proj of projects) {
      const hours = daysToHours(
        workLogs
          .filter(l => l.project_id === proj.id)
          .reduce((s, l) => s + parseFloat(l.duration_days), 0)
      );
      if (hours > 0) hoursByProject[proj.id] = { name: proj.name, hours };
    }

    // --- Распределение сотрудников по проектам (круговая диаграмма 2) ---
    // Считаем кол-во уникальных сотрудников на каждом проекте
    const usersByProject = {};
    for (const proj of projects) {
      const uniqueUsers = new Set(workLogs.filter(l => l.project_id === proj.id).map(l => l.user_id));
      if (uniqueUsers.size > 0) {
        usersByProject[proj.id] = { name: proj.name, user_count: uniqueUsers.size };
      }
    }

    // --- Карточки недо/переработки и незаполненных ---
    const undertime = [];
    const overtime = [];
    const unlogged = [];

    for (const user of users) {
      const userLogs = workLogs.filter(l => l.user_id === user.id);
      const userAbsences = absences.filter(a => a.user_id === user.id);
      const fact = calcFact(userLogs, userAbsences);
      const deviation = Math.round((fact - norm) * 100) / 100;

      // TOP-2 проектов пользователя
      const projHours = {};
      for (const log of userLogs) {
        projHours[log.project_name] = (projHours[log.project_name] || 0) + parseFloat(log.duration_days) * 8;
      }
      const top2 = Object.entries(projHours)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }));

      // Незаполненные дни
      const loggedDates = new Set([...userLogs.map(l => l.date), ...userAbsences.map(a => a.date)]);
      const unloggedDays = calcUnloggedDays(year, month, loggedDates, overrides);
      const lastLog = [...userLogs].sort((a, b) => b.date.localeCompare(a.date))[0];

      const userCard = {
        user_id: user.id,
        user_name: `${user.last_name} ${user.first_name}`,
        fact_hours: fact,
        absence_hours: daysToHours(userAbsences.reduce((s, a) => s + parseFloat(a.duration_days), 0)),
        deviation,
        top2_projects: top2,
        unlogged_count: unloggedDays.length,
        last_log_date: lastLog?.date || null,
      };

      if (deviation < 0) undertime.push(userCard);
      if (deviation > 0) overtime.push(userCard);
      if (unloggedDays.length > 0) unlogged.push(userCard);
    }

    return {
      year, month, norm,
      charts: {
        hours_by_project: Object.values(hoursByProject),
        users_by_project: Object.values(usersByProject),
      },
      cards: {
        undertime_count: undertime.length,
        overtime_count: overtime.length,
        unlogged_count: unlogged.length,
      },
    };
  },

  async getDetailList({ year, month, type }) {
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
      const fact = calcFact(userLogs, userAbsences);
      const deviation = Math.round((fact - norm) * 100) / 100;

      const loggedDates = new Set([...userLogs.map(l => l.date), ...userAbsences.map(a => a.date)]);
      const unloggedDays = calcUnloggedDays(year, month, loggedDates, overrides);
      const lastLog = [...userLogs].sort((a, b) => b.date.localeCompare(a.date))[0];

      const projHours = {};
      for (const log of userLogs) {
        projHours[log.project_name] = (projHours[log.project_name] || 0) + parseFloat(log.duration_days) * 8;
      }
      const top2 = Object.entries(projHours)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }));

      const card = {
        user_id: user.id,
        user_name: `${user.last_name} ${user.first_name}`,
        fact_hours: fact,
        absence_hours: daysToHours(userAbsences.reduce((s, a) => s + parseFloat(a.duration_days), 0)),
        deviation,
        top2_projects: top2,
        unlogged_count: unloggedDays.length,
        unlogged_dates: unloggedDays.map(d => d.date),
        last_log_date: lastLog?.date || null,
      };

      if (type === 'undertime' && deviation < 0) result.push(card);
      if (type === 'overtime' && deviation > 0) result.push(card);
      if (type === 'unlogged' && unloggedDays.length > 0) result.push(card);
    }

    return { type, year, month, count: result.length, users: result };
  },
};
```

---

## Шаг 2. Контроллер

`src/controllers/dashboard.controller.js`:

```js
import { DashboardService } from '@/services/dashboard.service.js';

export const DashboardController = {

  async getSummary(req, res, next) {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const month = Number(req.query.month) || new Date().getMonth() + 1;
      const result = await DashboardService.getSummary({ year, month });
      res.json(result);
    } catch (err) { next(err); }
  },

  async getDetailList(req, res, next) {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const month = Number(req.query.month) || new Date().getMonth() + 1;
      const { type } = req.query;

      if (!['undertime', 'overtime', 'unlogged'].includes(type)) {
        return res.status(400).json({ code: 'INVALID_TYPE', message: 'type должен быть: undertime | overtime | unlogged' });
      }

      const result = await DashboardService.getDetailList({ year, month, type });
      res.json(result);
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 3. Роутер

`src/routes/dashboardRouter.js`:

```js
import { Router } from 'express';
import { DashboardController } from '@/controllers/dashboard.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', DashboardController.getSummary);
router.get('/users', DashboardController.getDetailList);

export default router;
```

Подключить в `app.js`:

```js
import dashboardRouter from '@/routes/dashboardRouter.js';
app.use('/api/dashboard', dashboardRouter);
```

---

## Критерии приёмки

| # | Проверка | Как проверить |
|---|----------|---------------|
| 1 | Только Admin | `GET /api/dashboard` с User-cookie → `403 FORBIDDEN` |
| 2 | Сводка за месяц | `GET /api/dashboard?year=2025&month=6` → `charts`, `cards` с корректными счётчиками |
| 3 | Часы по проектам | `charts.hours_by_project` — массив `{ name, hours }` только для проектов с логами |
| 4 | Распределение сотрудников | `charts.users_by_project` — массив `{ name, user_count }` |
| 5 | Карточка недоработки | Создать пользователя с факт < нормы → `cards.undertime_count > 0` |
| 6 | Карточка переработки | Факт > нормы → `cards.overtime_count > 0` |
| 7 | Карточка незаполненных | Пользователь без логов → `cards.unlogged_count > 0` |
| 8 | Детализация undertime | `GET /api/dashboard/users?type=undertime&year=2025&month=6` → список с `deviation < 0` |
| 9 | Детализация overtime | `?type=overtime` → список с `deviation > 0` |
| 10 | Детализация unlogged | `?type=unlogged` → список с `unlogged_count > 0` и датами |
| 11 | TOP-2 проектов в детализации | Каждый user в списке содержит `top2_projects` (макс 2 элемента) |
| 12 | Невалидный type | `?type=wrong` → `400 INVALID_TYPE` |
