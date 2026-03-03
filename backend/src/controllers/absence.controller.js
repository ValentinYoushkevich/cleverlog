import { AbsenceService } from '../services/absence.service.js';
import {
    absenceFiltersSchema,
    createAbsenceSchema,
    updateAbsenceSchema,
} from '../validators/absence.validators.js';

export const AbsenceController = {
  async list(req, res, next) {
    try {
      const filters = absenceFiltersSchema.parse(req.query);
      const result = await AbsenceService.list({
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
      const data = createAbsenceSchema.parse(req.body);
      const isAdmin = req.user.role === 'admin';
      const targetUserId = isAdmin && data.user_id ? data.user_id : req.user.id;
      const result = await AbsenceService.create({
        ...data,
        userId: targetUserId,
        actorId: req.user.id,
        ip: req.ip,
      });

      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const data = updateAbsenceSchema.parse(req.body);
      const result = await AbsenceService.update({
        id: req.params.id,
        ...data,
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
      const result = await AbsenceService.delete({
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
