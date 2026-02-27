import { MonthClosureService } from '../services/monthClosure.service.js';
import { closeMonthSchema } from '../validators/monthClosure.validators.js';

export const MonthClosureController = {
  async list(_req, res, next) {
    try {
      const closures = await MonthClosureService.list();
      return res.json(closures);
    } catch (err) {
      return next(err);
    }
  },

  async close(req, res, next) {
    try {
      const { year, month } = closeMonthSchema.parse(req.body);
      const result = await MonthClosureService.close({
        year,
        month,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async open(req, res, next) {
    try {
      const { year, month } = closeMonthSchema.parse(req.params);
      const result = await MonthClosureService.open({
        year,
        month,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async status(req, res, next) {
    try {
      const { year, month } = closeMonthSchema.parse(req.params);
      const closed = await MonthClosureService.isClosed(year, month);
      return res.json({ year, month, closed });
    } catch (err) {
      return next(err);
    }
  },
};
