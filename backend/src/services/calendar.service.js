import { CalendarRepository } from '../repositories/calendar.repository.js';
import { getWorkingDays } from '../utils/calendar.js';
import { AuditService } from './audit.service.js';

const DEFAULT_NORM = 168;

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function validateYearMonth(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw appError(400, 'INVALID_PERIOD', 'Некорректный год или месяц');
  }
}

export const CalendarService = {
  async getMonth(year, month) {
    validateYearMonth(year, month);

    const overrides = await CalendarRepository.getOverrides(year, month);
    const days = getWorkingDays(year, month, overrides);
    const normRow = await CalendarRepository.getNorm(year, month);
    const norm_hours = normRow?.norm_hours ?? DEFAULT_NORM;

    return { year, month, norm_hours, days };
  },

  async updateDay({ date, day_type, actorId, actorRole, ip }) {
    const existing = await CalendarRepository.getDayOverride(date);
    const before = existing ? { day_type: existing.day_type } : null;

    const updated = await CalendarRepository.upsertDay(date, day_type);

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CALENDAR_DAY_UPDATED',
      entityType: 'calendar',
      entityId: null,
      before,
      after: { date, day_type },
      ip,
      result: 'success',
    });

    return updated;
  },

  async getNorm(year, month) {
    validateYearMonth(year, month);

    const normRow = await CalendarRepository.getNorm(year, month);
    return { year, month, norm_hours: normRow?.norm_hours ?? DEFAULT_NORM };
  },

  async updateNorm({ year, month, norm_hours, actorId, actorRole, ip }) {
    validateYearMonth(year, month);

    const existing = await CalendarRepository.getNorm(year, month);
    const before = existing ? { norm_hours: existing.norm_hours } : null;

    const updated = await CalendarRepository.upsertNorm(year, month, norm_hours);

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'CALENDAR_NORM_UPDATED',
      entityType: 'calendar',
      entityId: null,
      before,
      after: { year, month, norm_hours },
      ip,
      result: 'success',
    });

    return updated;
  },
};
