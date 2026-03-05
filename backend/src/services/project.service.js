import { ProjectRepository } from '../repositories/project.repository.js';
import { AuditService } from './audit.service.js';

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export const ProjectService = {
  async list({ status } = {}) {
    const projects = await ProjectRepository.findAll({ status });
    return projects;
  },

  async getById(id) {
    const project = await ProjectRepository.findById(id);
    if (!project) {
      throw appError(404, 'NOT_FOUND', 'Проект не найден');
    }

    return project;
  },

  async create({ actorId, actorRole, ip, ...data }) {
    const project = await ProjectRepository.create(data);

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'PROJECT_CREATED',
      entityType: 'project',
      entityId: project.id,
      after: { name: project.name, status: project.status },
      ip,
      result: 'success',
    });

    return project;
  },

  async update({ id, actorId, actorRole, ip, ...data }) {
    const project = await ProjectRepository.findById(id);
    if (!project) {
      throw appError(404, 'NOT_FOUND', 'Проект не найден');
    }

    const updated = await ProjectRepository.updateById(id, data);
    if (!updated) {
      throw appError(404, 'NOT_FOUND', 'Проект не найден');
    }

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'PROJECT_UPDATED',
      entityType: 'project',
      entityId: id,
      before: { name: project.name, status: project.status },
      after: data,
      ip,
      result: 'success',
    });

    return updated;
  },
};
