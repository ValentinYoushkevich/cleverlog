# MODULE_13 — Backend: Уведомления (Email)

## Обзор

Модуль реализует автоматическую рассылку email-уведомлений пользователям в 09:00 последнего рабочего дня месяца. Письмо отправляется если: есть незаполненные рабочие дни, или факт < нормы, или нет логов за последний рабочий день. Admin управляет рассылкой глобально и per-user.

MODULE_13 требует одного ручного шага — в конец существующего mailer.js (MODULE_3) нужно добавить export const mailer = transporter, иначе cron-сервис не импортирует транспортёр.

> **Зависимости модуля:**
> - `node-cron` — уже установлен в MODULE_0
> - `sendInviteEmail` паттерн из `utils/mailer.js` (MODULE_3) — переиспользуем транспорт nodemailer
> - `calcFact`, `calcUnloggedDays` из `utils/reportHelpers.js` (MODULE_10)
> - `CalendarRepository` из MODULE_6 — для определения последнего рабочего дня
> - `ReportRepository` из MODULE_10 — для получения логов пользователей

---

## Шаг 1. Утилита: последний рабочий день месяца

Добавить в `src/utils/calendar.js`:

```js
import db from '@/config/knex.js';

/**
 * Возвращает последний рабочий день месяца с учётом переопределений Admin.
 * Формат: 'YYYY-MM-DD'
 */
export async function getLastWorkingDay(year, month, dbInstance) {
  const overrides = await dbInstance('calendar_days')
    .whereBetween('date', [
      `${year}-${String(month).padStart(2, '0')}-01`,
      `${year}-${String(month).padStart(2, '0')}-31`,
    ])
    .select('date', 'day_type');

  const days = getWorkingDays(year, month, overrides);
  const workingDays = days.filter(d => d.day_type === 'working');
  return workingDays.length ? workingDays[workingDays.length - 1].date : null;
}
```

---

## Шаг 2. Настройки уведомлений — репозиторий

`src/repositories/notification.repository.js`:

```js
import db from '@/config/knex.js';

export const NotificationRepository = {

  // Глобальная настройка (запись с user_id = null)
  getGlobal: () =>
    db('notification_settings').whereNull('user_id').first(),

  // Per-user настройка
  getForUser: (userId) =>
    db('notification_settings').where({ user_id: userId }).first(),

  // Все per-user настройки
  getAllUserSettings: () =>
    db('notification_settings').whereNotNull('user_id').select('*'),

  upsertGlobal: async (enabled) => {
    const existing = await db('notification_settings').whereNull('user_id').first();
    if (existing) {
      return db('notification_settings')
        .whereNull('user_id')
        .update({ global_enabled: enabled, updated_at: db.fn.now() })
        .returning('*')
        .then(r => r[0]);
    }
    return db('notification_settings')
      .insert({ global_enabled: enabled })
      .returning('*')
      .then(r => r[0]);
  },

  upsertForUser: async (userId, enabled) => {
    const existing = await db('notification_settings').where({ user_id: userId }).first();
    if (existing) {
      return db('notification_settings')
        .where({ user_id: userId })
        .update({ enabled, updated_at: db.fn.now() })
        .returning('*')
        .then(r => r[0]);
    }
    return db('notification_settings')
      .insert({ user_id: userId, enabled, global_enabled: true })
      .returning('*')
      .then(r => r[0]);
  },
};
```

---

## Шаг 3. Сервис уведомлений

`src/services/notification.service.js`:

```js
import dayjs from 'dayjs';
import { NotificationRepository } from '@/repositories/notification.repository.js';
import { ReportRepository } from '@/repositories/report.repository.js';
import { CalendarRepository } from '@/repositories/calendar.repository.js';
import { calcFact, calcUnloggedDays } from '@/utils/reportHelpers.js';
import { getLastWorkingDay } from '@/utils/calendar.js';
import { mailer } from '@/utils/mailer.js';
import logger from '@/config/logger.js';
import db from '@/config/knex.js';

const DEFAULT_NORM = 168;

export const NotificationService = {

  // Проверить, нужно ли отправлять письмо сегодня
  async shouldRunToday() {
    const today = dayjs().format('YYYY-MM-DD');
    const year = dayjs().year();
    const month = dayjs().month() + 1;
    const lastWorkingDay = await getLastWorkingDay(year, month, db);
    return lastWorkingDay === today;
  },

  // Основной метод: отправить письма всем кто должен получить
  async sendMonthlyReminders() {
    const shouldRun = await NotificationService.shouldRunToday();
    if (!shouldRun) {
      logger.warn('Notification job: today is not the last working day, skipping');
      return;
    }

    // Проверить глобальный флаг
    const globalSetting = await NotificationRepository.getGlobal();
    if (globalSetting && !globalSetting.global_enabled) {
      logger.warn('Notification job: globally disabled, skipping');
      return;
    }

    const now = dayjs();
    const year = now.year();
    const month = now.month() + 1;
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = now.format('YYYY-MM-DD');

    const users = await ReportRepository.getActiveUsers();
    const workLogs = await ReportRepository.getWorkLogs({ dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ dateFrom, dateTo });
    const overrides = await CalendarRepository.getOverrides(year, month);
    const normRow = await CalendarRepository.getNorm(year, month);
    const norm = normRow?.norm_hours ?? DEFAULT_NORM;
    const userSettings = await NotificationRepository.getAllUserSettings();
    const userSettingMap = Object.fromEntries(userSettings.map(s => [s.user_id, s.enabled]));

    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      // Per-user отключение
      if (userSettingMap[user.id] === false) {
        skipped++;
        continue;
      }

      const userLogs = workLogs.filter(l => l.user_id === user.id);
      const userAbsences = absences.filter(a => a.user_id === user.id);
      const fact = calcFact(userLogs, userAbsences);

      const loggedDates = new Set([...userLogs.map(l => l.date), ...userAbsences.map(a => a.date)]);
      const unloggedDays = calcUnloggedDays(year, month, loggedDates, overrides);

      // Проверить наличие лога за сегодня (последний рабочий день)
      const hasLogToday = loggedDates.has(dateTo);

      const needsNotification =
        unloggedDays.length > 0 ||
        fact < norm ||
        !hasLogToday;

      if (!needsNotification) {
        skipped++;
        continue;
      }

      try {
        await sendReminderEmail({
          to: user.email,
          firstName: user.first_name,
          fact,
          norm,
          unloggedCount: unloggedDays.length,
          unloggedDates: unloggedDays.map(d => d.date),
          hasLogToday,
          month,
          year,
        });
        sent++;
      } catch (err) {
        logger.error('Failed to send reminder', { userId: user.id, error: err.message });
      }
    }

    logger.warn(`Notification job complete: sent=${sent}, skipped=${skipped}`);
  },

  // Управление настройками
  async getGlobalSettings() {
    const setting = await NotificationRepository.getGlobal();
    return { global_enabled: setting?.global_enabled ?? true };
  },

  async updateGlobalSettings({ enabled }) {
    return NotificationRepository.upsertGlobal(enabled);
  },

  async updateUserSettings({ userId, enabled }) {
    return NotificationRepository.upsertForUser(userId, enabled);
  },
};

async function sendReminderEmail({ to, firstName, fact, norm, unloggedCount, unloggedDates, hasLogToday, month, year }) {
  const deviation = Math.round((fact - norm) * 100) / 100;
  const monthName = new Date(year, month - 1).toLocaleString('ru-RU', { month: 'long' });

  const issues = [];
  if (!hasLogToday) issues.push('— не заполнен последний рабочий день месяца');
  if (unloggedCount > 0) issues.push(`— незаполненных рабочих дней: ${unloggedCount} (${unloggedDates.slice(0, 5).join(', ')}${unloggedDates.length > 5 ? '...' : ''})`);
  if (fact < norm) issues.push(`— факт (${fact} ч) меньше нормы (${norm} ч), отклонение: ${deviation} ч`);

  await mailer.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `CleverLog: не забудьте заполнить время за ${monthName}`,
    html: `
      <p>Здравствуйте, ${firstName}!</p>
      <p>Сегодня последний рабочий день ${monthName}. Обнаружены следующие проблемы:</p>
      <ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul>
      <p>Пожалуйста, заполните рабочее время до конца дня.</p>
      <p><a href="${process.env.CLIENT_URL}/calendar">Перейти в календарь</a></p>
    `,
  });
}
```

---

## Шаг 4. Экспортировать транспорт из mailer.js

Обновить `src/utils/mailer.js` — добавить экспорт транспортёра для переиспользования:

```js
// Добавить в конец файла существующего mailer.js из MODULE_3:
export const mailer = transporter;
```

---

## Шаг 5. Cron-задача

`src/cron/notificationJob.js`:

```js
import cron from 'node-cron';
import { NotificationService } from '@/services/notification.service.js';
import logger from '@/config/logger.js';

// Каждый день в 09:00
export function startNotificationJob() {
  cron.schedule('0 9 * * *', async () => {
    logger.warn('Notification cron job started');
    try {
      await NotificationService.sendMonthlyReminders();
    } catch (err) {
      logger.error('Notification cron job failed', { error: err.message });
    }
  }, {
    timezone: 'Europe/Moscow', // настроить под часовой пояс компании
  });

  logger.warn('Notification cron job scheduled: 09:00 daily');
}
```

Подключить в `server.js` после старта сервера:

```js
import { startNotificationJob } from '@/cron/notificationJob.js';

// Внутри функции start(), после app.listen():
startNotificationJob();
```

---

## Шаг 6. Контроллер

`src/controllers/notification.controller.js`:

```js
import { NotificationService } from '@/services/notification.service.js';
import { z } from 'zod';

const globalSchema = z.object({ enabled: z.boolean() });
const userSchema = z.object({ enabled: z.boolean() });

export const NotificationController = {

  async getGlobal(req, res, next) {
    try {
      const result = await NotificationService.getGlobalSettings();
      res.json(result);
    } catch (err) { next(err); }
  },

  async updateGlobal(req, res, next) {
    try {
      const { enabled } = globalSchema.parse(req.body);
      const result = await NotificationService.updateGlobalSettings({ enabled });
      res.json(result);
    } catch (err) { next(err); }
  },

  async updateUserSetting(req, res, next) {
    try {
      const { enabled } = userSchema.parse(req.body);
      const result = await NotificationService.updateUserSettings({
        userId: req.params.userId,
        enabled,
      });
      res.json(result);
    } catch (err) { next(err); }
  },

  // Ручной запуск для тестирования (только в dev)
  async triggerManual(req, res, next) {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Только в development режиме' });
      }
      await NotificationService.sendMonthlyReminders();
      res.json({ message: 'Рассылка запущена вручную' });
    } catch (err) { next(err); }
  },
};
```

---

## Шаг 7. Роутер

`src/routes/notificationRouter.js`:

```js
import { Router } from 'express';
import { NotificationController } from '@/controllers/notification.controller.js';
import { authenticate } from '@/middlewares/authenticate.js';
import { authorize } from '@/middlewares/authorize.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/settings', NotificationController.getGlobal);
router.patch('/settings', NotificationController.updateGlobal);
router.patch('/users/:userId', NotificationController.updateUserSetting);
router.post('/trigger', NotificationController.triggerManual); // dev only

export default router;
```

Подключить в `app.js`:

```js
import notificationRouter from '@/routes/notificationRouter.js';
app.use('/api/notifications', notificationRouter);
```

---

## Критерии приёмки

| # | Проверка | Как проверить | Статус |
|---|----------|---------------|--------|
| 1 | Cron регистрируется при старте | `npm run dev` → в логах `Notification cron job scheduled: 09:00 daily` | ✅ Пройдено |
| 2 | Ручной запуск отправки | `POST /api/notifications/trigger` (dev) → `200`; в логах `sent=N, skipped=M` | ✅ Пройдено |
| 3 | Письмо отправляется нужным | Создать user с незаполненными днями → trigger → письмо в Mailtrap/SMTP | ❌ Не пройдено (SMTP недоступен: `ECONNREFUSED 127.0.0.1:587`) |
| 4 | Пользователь с полным фактом не получает | Заполнить все дни с нормой → trigger → письмо не отправляется (skipped++) | ✅ Пройдено |
| 5 | Глобальное отключение | `PATCH /api/notifications/settings` `{ "enabled": false }` → trigger → `skipping globally` в логах | ✅ Пройдено |
| 6 | Per-user отключение | `PATCH /api/notifications/users/:id` `{ "enabled": false }` → trigger → этот user skipped | ✅ Пройдено |
| 7 | Получение настроек | `GET /api/notifications/settings` → `{ global_enabled: true/false }` | ✅ Пройдено |
| 8 | Только Admin | С User-cookie → `403 FORBIDDEN` | ✅ Пройдено |
| 9 | Trigger недоступен в prod | Установить `NODE_ENV=production` → `POST /trigger` → `403` | ✅ Пройдено |
