import { WorkLogService } from '../services/workLog.service.js';
import {
  createWorkLogSchema,
  updateWorkLogSchema,
  workLogFiltersSchema,
} from '../validators/workLog.validators.js';

export const WorkLogController = {
  async list(req, res, next) {
    try {
      const filters = workLogFiltersSchema.parse(req.query);
      const result = await WorkLogService.list({
        ...filters,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const { custom_fields, user_id, ...data } = createWorkLogSchema.parse(req.body);
      const result = await WorkLogService.create({
        ...data,
        custom_fields,
        targetUserId: user_id,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        ip: req.ip,
      });

      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const { custom_fields, ...data } = updateWorkLogSchema.parse(req.body);
      const result = await WorkLogService.update({
        id: req.params.id,
        ...data,
        custom_fields,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const result = await WorkLogService.delete({
        id: req.params.id,
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },
};
