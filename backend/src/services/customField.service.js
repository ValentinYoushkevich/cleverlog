import { CustomFieldRepository } from '../repositories/customField.repository.js';
import { AuditService } from './audit.service.js';

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function attachNewProjectField(opts) {
  const { projectId, customFieldId, data, actorId, actorRole, ip } = opts;
  const field = await CustomFieldRepository.findById(customFieldId);
  if (!field || field.deleted_at) {
    throw appError(404, 'NOT_FOUND', 'Поле не найдено');
  }
  const created = await CustomFieldRepository.attachToProject({
    project_id: projectId, custom_field_id: customFieldId,
    is_required: data.is_required ?? false, is_enabled: data.is_enabled ?? true,
  });
  await AuditService.log({
    actorId, actorRole, eventType: 'CUSTOM_FIELD_ATTACHED',
    entityType: 'project', entityId: projectId, after: { custom_field_id: customFieldId, ...data }, ip, result: 'success',
  });
  return created;
}

export const CustomFieldService = {
  async list({ includeDeleted = false } = {}) {
    const fields = await CustomFieldRepository.findAll({ includeDeleted });
    return fields;
  },

  async create({ actorId, actorRole, ip, options, ...data }) {
    const field = await CustomFieldRepository.create(data);

    if (data.type === 'dropdown' && options?.length) {
      for (let index = 0; index < options.length; index += 1) {
        await CustomFieldRepository.addOption({
          custom_field_id: field.id,
          label: options[index],
          sort_order: index,
        });
      }
    }

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CUSTOM_FIELD_CREATED',
      entityType: 'custom_field',
      entityId: field.id,
      after: { name: field.name, type: field.type },
      ip,
      result: 'success',
    });

    return field;
  },

  async update({ id, actorId, actorRole, ip, ...data }) {
    const field = await CustomFieldRepository.findById(id);
    if (!field) {
      throw appError(404, 'NOT_FOUND', 'Поле не найдено');
    }

    if (field.deleted_at) {
      throw appError(400, 'FIELD_DELETED', 'Поле удалено');
    }

    if (data.type && data.type !== field.type) {
      const used = await CustomFieldRepository.isUsed(id);
      if (used) {
        throw appError(409, 'TYPE_CHANGE_FORBIDDEN', 'Нельзя изменить тип: поле уже используется');
      }
    }

    const updated = await CustomFieldRepository.updateById(id, data);
    if (!updated) {
      throw appError(404, 'NOT_FOUND', 'Поле не найдено');
    }

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CUSTOM_FIELD_UPDATED',
      entityType: 'custom_field',
      entityId: id,
      before: { name: field.name, type: field.type },
      after: data,
      ip,
      result: 'success',
    });

    return updated;
  },

  async softDelete({ id, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(id);
    if (!field) {
      throw appError(404, 'NOT_FOUND', 'Поле не найдено');
    }

    await CustomFieldRepository.updateById(id, { deleted_at: new Date() });

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CUSTOM_FIELD_DELETED',
      entityType: 'custom_field',
      entityId: id,
      ip,
      result: 'success',
    });

    return { message: 'Поле скрыто (soft delete)' };
  },

  async restore({ id, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(id);
    if (!field) {
      throw appError(404, 'NOT_FOUND', 'Поле не найдено');
    }

    if (!field.deleted_at) {
      throw appError(400, 'NOT_DELETED', 'Поле не удалено');
    }

    await CustomFieldRepository.updateById(id, { deleted_at: null });

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CUSTOM_FIELD_RESTORED',
      entityType: 'custom_field',
      entityId: id,
      ip,
      result: 'success',
    });

    return { message: 'Поле восстановлено' };
  },

  async getOptions(id) {
    const field = await CustomFieldRepository.findById(id);
    if (!field) {
      throw appError(404, 'NOT_FOUND', 'Поле не найдено');
    }

    if (field.type !== 'dropdown') {
      throw appError(400, 'NOT_DROPDOWN', 'Поле не является Dropdown');
    }

    return CustomFieldRepository.getOptions(id);
  },

  async addOption({ id, label, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(id);
    if (field?.type !== 'dropdown') {
      throw appError(400, 'NOT_DROPDOWN', 'Поле не является Dropdown');
    }

    const options = await CustomFieldRepository.getOptions(id);
    const option = await CustomFieldRepository.addOption({
      custom_field_id: id,
      label,
      sort_order: options.length,
    });

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CUSTOM_FIELD_OPTION_ADDED',
      entityType: 'custom_field',
      entityId: id,
      after: { label },
      ip,
      result: 'success',
    });

    return option;
  },

  async deprecateOption({ fieldId, optionId, actorId, actorRole, ip }) {
    const field = await CustomFieldRepository.findById(fieldId);
    if (field?.type !== 'dropdown') {
      throw appError(400, 'NOT_DROPDOWN', 'Поле не является Dropdown');
    }

    const option = await CustomFieldRepository.findOptionById(optionId);
    if (!option || option.custom_field_id !== fieldId) {
      throw appError(404, 'NOT_FOUND', 'Опция не найдена');
    }

    await CustomFieldRepository.deprecateOption(optionId);

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CUSTOM_FIELD_OPTION_DEPRECATED',
      entityType: 'custom_field',
      entityId: fieldId,
      after: { option_id: optionId },
      ip,
      result: 'success',
    });

    return { message: 'Опция помечена как устаревшая' };
  },

  async getProjectFields(projectId) {
    const fields = await CustomFieldRepository.getProjectFields(projectId);
    return fields;
  },

  async attachToProject({
    projectId,
    customFieldId,
    is_required,
    is_enabled,
    actorId,
    actorRole,
    ip,
  }) {
    const field = await CustomFieldRepository.findById(customFieldId);
    if (!field || field.deleted_at) {
      throw appError(404, 'NOT_FOUND', 'Поле не найдено');
    }

    const existing = await CustomFieldRepository.findProjectField(projectId, customFieldId);
    if (existing) {
      throw appError(409, 'ALREADY_ATTACHED', 'Поле уже привязано к проекту');
    }

    const result = await CustomFieldRepository.attachToProject({
      project_id: projectId,
      custom_field_id: customFieldId,
      is_required,
      is_enabled,
    });

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CUSTOM_FIELD_ATTACHED',
      entityType: 'project',
      entityId: projectId,
      after: { custom_field_id: customFieldId, is_required, is_enabled },
      ip,
      result: 'success',
    });

    return result;
  },

  async updateProjectField({ projectId, customFieldId, data, actorId, actorRole, ip }) {
    const existing = await CustomFieldRepository.findProjectField(projectId, customFieldId);
    if (!existing) {
      return attachNewProjectField({ projectId, customFieldId, data, actorId, actorRole, ip });
    }
    const result = await CustomFieldRepository.updateProjectField(projectId, customFieldId, data);
    if (!result) { throw appError(404, 'NOT_FOUND', 'Привязка не найдена'); }
    await AuditService.log({
      actorId, actorRole, eventType: 'CUSTOM_FIELD_PROJECT_UPDATED',
      entityType: 'project', entityId: projectId, after: { custom_field_id: customFieldId, ...data }, ip, result: 'success',
    });
    return result;
  },

  async detachFromProject({ projectId, customFieldId, actorId, actorRole, ip }) {
    const existing = await CustomFieldRepository.findProjectField(projectId, customFieldId);
    if (!existing) {
      throw appError(404, 'NOT_FOUND', 'Привязка не найдена');
    }

    await CustomFieldRepository.detachFromProject(projectId, customFieldId);

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CUSTOM_FIELD_DETACHED',
      entityType: 'project',
      entityId: projectId,
      after: { custom_field_id: customFieldId },
      ip,
      result: 'success',
    });

    return { message: 'Поле откреплено от проекта' };
  },
};
