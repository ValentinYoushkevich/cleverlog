import { ProjectService } from '../services/project.service.js';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validators.js';

export const ProjectController = {
  async list(req, res, next) {
    try {
      const { status } = req.query;
      const projects = await ProjectService.list({ status });
      return res.json(projects);
    } catch (err) {
      return next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const project = await ProjectService.getById(req.params.id);
      return res.json(project);
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const data = createProjectSchema.parse(req.body);
      const project = await ProjectService.create({
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.status(201).json(project);
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const data = updateProjectSchema.parse(req.body);
      const project = await ProjectService.update({
        id: req.params.id,
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(project);
    } catch (err) {
      return next(err);
    }
  },
};
