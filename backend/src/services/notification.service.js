import dayjs from 'dayjs';
import db from '../config/knex.js';
import logger from '../config/logger.js';
import { CalendarRepository } from '../repositories/calendar.repository.js';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { ReportRepository } from '../repositories/report.repository.js';
import { getLastWorkingDay } from '../utils/calendar.js';
import { mailer } from '../utils/mailer.js';
import { calcFact, calcUnloggedDays } from '../utils/reportHelpers.js';
import { AuditService } from './audit.service.js';

const DEFAULT_NORM = 168;

function toDateKey(value) {
  return dayjs(value).format('YYYY-MM-DD');
}

export const NotificationService = {
  async shouldRunToday() {
    const today = dayjs().format('YYYY-MM-DD');
    const year = dayjs().year();
    const month = dayjs().month() + 1;
    const lastWorkingDay = await getLastWorkingDay(year, month, db);
    return lastWorkingDay === today;
  },

  async sendMonthlyReminders() {
    const shouldRun = await NotificationService.shouldRunToday();
    if (!shouldRun) {
      logger.warn('Notification job: today is not the last working day, skipping');
      return;
    }

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
    const userSettingMap = Object.fromEntries(userSettings.map((setting) => [setting.user_id, setting.enabled]));

    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      if (userSettingMap[user.id] === false) {
        skipped += 1;
        continue;
      }

      const userLogs = workLogs.filter((log) => log.user_id === user.id);
      const userAbsences = absences.filter((absence) => absence.user_id === user.id);
      const fact = calcFact(userLogs, userAbsences);

      const loggedDates = new Set([
        ...userLogs.map((log) => toDateKey(log.date)),
        ...userAbsences.map((absence) => toDateKey(absence.date)),
      ]);
      const unloggedDays = calcUnloggedDays(year, month, loggedDates, overrides);
      const hasLogToday = loggedDates.has(dateTo);

      const needsNotification = unloggedDays.length > 0 || fact < norm || !hasLogToday;
      if (!needsNotification) {
        skipped += 1;
        continue;
      }

      try {
        await sendReminderEmail({
          to: user.email,
          firstName: user.first_name,
          fact,
          norm,
          unloggedCount: unloggedDays.length,
          unloggedDates: unloggedDays.map((day) => day.date),
          hasLogToday,
          month,
          year,
        });
        sent += 1;
      } catch (error_) {
        logger.error('Failed to send reminder', {
          userId: user.id,
          error: error_.message,
        });
      }
    }

    logger.warn(`Notification job complete: sent=${sent}, skipped=${skipped}`);
  },

  async getGlobalSettings() {
    const setting = await NotificationRepository.getGlobal();
    return { global_enabled: setting?.global_enabled ?? true };
  },

  async updateGlobalSettings({ enabled, actorId, actorRole, ip }) {
    const before = await NotificationRepository.getGlobal();
    const setting = await NotificationRepository.upsertGlobal(enabled);
    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'NOTIFICATIONS_GLOBAL_UPDATED',
      entityType: 'notification_settings',
      entityId: null,
      before: before ? { global_enabled: before.global_enabled } : null,
      after: { global_enabled: setting.global_enabled },
      ip,
      result: 'success',
    });
    return setting;
  },

  async updateUserSettings({ userId, enabled, actorId, actorRole, ip }) {
    const before = await NotificationRepository.getForUser(userId);
    const setting = await NotificationRepository.upsertForUser(userId, enabled);
    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'NOTIFICATIONS_USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      before: before ? { enabled: before.enabled } : null,
      after: { enabled: setting.enabled },
      ip,
      result: 'success',
    });
    return setting;
  },
};

async function sendReminderEmail({
  to,
  firstName,
  fact,
  norm,
  unloggedCount,
  unloggedDates,
  hasLogToday,
  month,
  year,
}) {
  const deviation = Math.round((fact - norm) * 100) / 100;
  const monthName = new Date(year, month - 1).toLocaleString('ru-RU', { month: 'long' });

  const issues = [];
  if (!hasLogToday) {
    issues.push('не заполнен последний рабочий день месяца');
  }
  if (unloggedCount > 0) {
    issues.push(`незаполненных рабочих дней: ${unloggedCount} (${unloggedDates.slice(0, 5).join(', ')}${unloggedDates.length > 5 ? '...' : ''})`);
  }
  if (fact < norm) {
    issues.push(`факт (${fact} ч) меньше нормы (${norm} ч), отклонение: ${deviation} ч`);
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `CleverLog: не забудьте заполнить время за ${monthName}`,
    html: `
      <p>Здравствуйте, ${firstName}!</p>
      <p>Сегодня последний рабочий день ${monthName}. Обнаружены следующие проблемы:</p>
      <ul>${issues.map((issue) => `<li>${issue}</li>`).join('')}</ul>
      <p>Пожалуйста, заполните рабочее время до конца дня.</p>
      <p><a href="${process.env.CLIENT_URL}/calendar">Перейти в календарь</a></p>
    `,
  });
}
