import { UserService } from '../services/user.service.js';
import { createUserSchema, updateUserSchema } from '../validators/user.validators.js';

export const UserController = {
  async list(req, res, next) {
    try {
      const { status, role, tags } = req.query;
      const users = await UserService.list({
        status,
        role,
        tags: tags ? String(tags).split(',') : undefined,
      });

      return res.json(users);
    } catch (err) {
      return next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const user = await UserService.getById(req.params.id);
      return res.json(user);
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const data = createUserSchema.parse(req.body);
      const user = await UserService.create({
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.status(201).json(user);
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const data = updateUserSchema.parse(req.body);
      const user = await UserService.update({
        id: req.params.id,
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(user);
    } catch (err) {
      return next(err);
    }
  },

  async resendInvite(req, res, next) {
    try {
      const result = await UserService.resendInvite({
        id: req.params.id,
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
