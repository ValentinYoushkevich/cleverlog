import dayjs from 'dayjs';
import db from '../config/knex.js';
import { CustomFieldRepository } from '../repositories/customField.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { WorkLogRepository } from '../repositories/workLog.repository.js';
import { daysToHours, parseDurationToDays } from '../utils/duration.js';
import { AuditService } from './audit.service.js';

const MAX_HOURS_PER_DAY = 12;

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export const WorkLogService = {
  async list({ userId, isAdmin, ...filters }) {
    const effectiveUserId = (isAdmin && filters.user_id) ? filters.user_id : userId;
    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const result = await WorkLogRepository.findAll({
      userId: effectiveUserId,
      projectId: filters.project_id,
      dateFrom: filters.date_from,
      dateTo: filters.date_to,
      taskNumber: filters.task_number,
      comment: filters.comment,
      page,
      limit,
    });

    const data = result.data.map((log) => ({
      ...log,
      duration_hours: daysToHours(log.duration_days),
    }));

    return {
      data,
      pagination: {
        total: result.total,
        page,
        limit,
        total_pages: Math.ceil(result.total / limit) || 1,
      },
    };
  },

  async create({ userId, isAdmin, targetUserId, custom_fields, ...data }) {
    const effectiveUserId = isAdmin && targetUserId ? targetUserId : userId;

    const todayStr = dayjs().format('YYYY-MM-DD');
    if (data.date > todayStr) {
      throw appError(400, 'FUTURE_DATE', 'Нельзя логировать будущие даты');
    }

    const project = await ProjectRepository.findById(data.project_id);
    if (!project) {
      throw appError(404, 'PROJECT_NOT_FOUND', 'Проект не найден');
    }
    if (project.status !== 'active') {
      throw appError(400, 'PROJECT_NOT_ACTIVE', 'Логирование доступно только для активных проектов');
    }

    const hasAbsence = await db('absences')
      .where({ user_id: effectiveUserId, date: data.date })
      .first();
    if (hasAbsence) {
      throw appError(400, 'ABSENCE_CONFLICT', 'В этот день уже есть запись об отсутствии');
    }

    const duration_days = parseDurationToDays(data.duration);

    const existingDays = await WorkLogRepository.sumDayDuration(effectiveUserId, data.date);
    const totalDays = existingDays + duration_days;
    const warning = daysToHours(totalDays) > MAX_HOURS_PER_DAY
      ? `Суммарное время за день превышает ${MAX_HOURS_PER_DAY}ч`
      : null;

    await validateCustomFields(data.project_id, custom_fields);

    const log = await WorkLogRepository.create({
      user_id: effectiveUserId,
      project_id: data.project_id,
      date: data.date,
      duration_days,
      comment: data.comment,
      task_number: data.task_number,
    });

    if (custom_fields && Object.keys(custom_fields).length) {
      await WorkLogRepository.upsertCustomValues(log.id, custom_fields);
    }

    await AuditService.log({
      actorId: userId,
      eventType: 'WORK_LOG_CREATED',
      entityType: 'work_log',
      entityId: log.id,
      after: { user_id: log.user_id, date: log.date, duration_days, project_id: log.project_id },
      ip: data.ip,
      result: 'success',
    });

    return { ...log, duration_hours: daysToHours(duration_days), warning };
  },

  async update({ id, userId, isAdmin, custom_fields, ...data }) {
    const log = await WorkLogRepository.findById(id);
    if (!log) {
      throw appError(404, 'NOT_FOUND', 'Лог не найден');
    }
    if (!isAdmin && log.user_id !== userId) {
      throw appError(403, 'FORBIDDEN', 'Нет доступа');
    }

    const targetUserId = log.user_id;
    const updateData = {};
    let warning = null;

    if (data.date) {
      if (dayjs(data.date).isAfter(dayjs(), 'day')) {
        throw appError(400, 'FUTURE_DATE', 'Нельзя логировать будущие даты');
      }
      updateData.date = data.date;
    }

    if (data.project_id) {
      await ensureProjectActive(data.project_id);
      updateData.project_id = data.project_id;
    }

    const dateToCheck = updateData.date || log.date;
    const hasAbsence = await db('absences')
      .where({ user_id: targetUserId, date: dateToCheck })
      .first();
    if (hasAbsence) {
      throw appError(400, 'ABSENCE_CONFLICT', 'В этот день уже есть запись об отсутствии');
    }

    if (data.duration) {
      updateData.duration_days = parseDurationToDays(data.duration);
      const existingDays = await WorkLogRepository.sumDayDuration(targetUserId, dateToCheck, id);
      if (daysToHours(existingDays + updateData.duration_days) > MAX_HOURS_PER_DAY) {
        warning = `Суммарное время за день превышает ${MAX_HOURS_PER_DAY}ч`;
      }
    }

    if (data.comment !== undefined) {
      updateData.comment = data.comment;
    }
    if (data.task_number !== undefined) {
      updateData.task_number = data.task_number;
    }

    await validateCustomFields(updateData.project_id || log.project_id, custom_fields);

    const updated = await WorkLogRepository.updateById(id, updateData);
    if (!updated) {
      throw appError(404, 'NOT_FOUND', 'Лог не найден');
    }

    if (custom_fields) {
      await WorkLogRepository.upsertCustomValues(id, custom_fields);
    }

    await AuditService.log({
      actorId: userId,
      eventType: 'WORK_LOG_UPDATED',
      entityType: 'work_log',
      entityId: id,
      before: { date: log.date, duration_days: log.duration_days, project_id: log.project_id },
      after: updateData,
      ip: data.ip,
      result: 'success',
    });

    return { ...updated, duration_hours: daysToHours(updated.duration_days), warning };
  },

  async delete({ id, userId, isAdmin, ip }) {
    const log = await WorkLogRepository.findById(id);
    if (!log) {
      throw appError(404, 'NOT_FOUND', 'Лог не найден');
    }
    if (!isAdmin && log.user_id !== userId) {
      throw appError(403, 'FORBIDDEN', 'Нет доступа');
    }

    await WorkLogRepository.deleteById(id);

    await AuditService.log({
      actorId: userId,
      eventType: 'WORK_LOG_DELETED',
      entityType: 'work_log',
      entityId: id,
      before: { date: log.date, duration_days: log.duration_days },
      ip,
      result: 'success',
    });

    return { message: 'Лог удалён' };
  },
};

async function validateCustomFields(projectId, customFields = {}) {
  const projectFields = await CustomFieldRepository.getProjectFields(projectId);
  const requiredFields = projectFields.filter((field) => field.is_required && field.is_enabled);

  for (const field of requiredFields) {
    const value = customFields?.[field.custom_field_id];
    if (value === undefined || value === null || value === '') {
      throw appError(400, 'REQUIRED_FIELD_MISSING', `Обязательное поле "${field.name}" не заполнено`);
    }
  }
}

async function ensureProjectActive(projectId) {
  const project = await ProjectRepository.findById(projectId);
  if (project?.status !== 'active') {
    throw appError(400, 'PROJECT_NOT_ACTIVE', 'Проект должен быть активным');
  }
}
