import cron from 'node-cron';
import logger from '../config/logger.js';
import { NotificationService } from '../services/notification.service.js';

export function startNotificationJob() {
  cron.schedule('0 9 * * *', async () => {
    logger.warn('Notification cron job started');
    try {
      await NotificationService.sendMonthlyReminders();
    } catch (error_) {
      logger.error('Notification cron job failed', {
        error: error_.message,
      });
    }
  }, {
    timezone: 'Europe/Moscow',
  });

  logger.warn('Notification cron job scheduled: 09:00 daily');
}
