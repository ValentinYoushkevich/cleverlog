import { z } from 'zod';
import { NotificationService } from '../services/notification.service.js';

const globalSchema = z.object({ enabled: z.boolean() });
const userSchema = z.object({ enabled: z.boolean() });

export const NotificationController = {
  async getGlobal(_req, res, next) {
    try {
      const result = await NotificationService.getGlobalSettings();
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async updateGlobal(req, res, next) {
    try {
      const { enabled } = globalSchema.parse(req.body);
      const result = await NotificationService.updateGlobalSettings({
        enabled,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async updateUserSetting(req, res, next) {
    try {
      const { enabled } = userSchema.parse(req.body);
      const result = await NotificationService.updateUserSettings({
        userId: req.params.userId,
        enabled,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async triggerManual(_req, res, next) {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Только в development режиме',
        });
      }

      await NotificationService.sendMonthlyReminders();
      return res.json({ message: 'Рассылка запущена вручную' });
    } catch (err) {
      return next(err);
    }
  },
};
