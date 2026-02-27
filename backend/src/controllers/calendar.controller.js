import { CalendarService } from '../services/calendar.service.js';
import { normSchema, updateDaySchema } from '../validators/calendar.validators.js';

export const CalendarController = {
  async getMonth(req, res, next) {
    try {
      const { year, month } = req.params;
      const data = await CalendarService.getMonth(Number(year), Number(month));
      return res.json(data);
    } catch (err) {
      return next(err);
    }
  },

  async updateDay(req, res, next) {
    try {
      const { date } = req.params;
      const { day_type } = updateDaySchema.parse(req.body);
      const result = await CalendarService.updateDay({
        date,
        day_type,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async getNorm(req, res, next) {
    try {
      const { year, month } = req.params;
      const result = await CalendarService.getNorm(Number(year), Number(month));
      return res.json(result);
    } catch (err) {
      return next(err);
    }
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

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },
};
