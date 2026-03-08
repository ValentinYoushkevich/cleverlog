import dayjs from 'dayjs';
import { AbsenceRepository } from '../repositories/absence.repository.js';
import { getDefaultDayType } from '../utils/calendar.js';
import { daysToHours, parseDurationToDays } from '../utils/duration.js';
import { AuditService } from './audit.service.js';

function appError(status, code, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function generateDateRange(from, to) {
  const dates = [];
  let current = dayjs(from);
  const end = dayjs(to);

  while (current.isBefore(end, 'day') || current.isSame(end, 'day')) {
    dates.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }

  return dates;
}

export const AbsenceService = {
  async list({ userId, isAdmin, ...filters }) {
    const effectiveUserId = (isAdmin && filters.user_id) ? filters.user_id : userId;
    const page = filters.page || 1;
    const limit = filters.limit || 50;

    const result = await AbsenceRepository.findAll({
      userId: effectiveUserId,
      dateFrom: filters.date_from,
      dateTo: filters.date_to,
      type: filters.type,
      page,
      limit,
    });

    const data = result.data.map((absence) => ({
      ...absence,
      duration_hours: daysToHours(absence.duration_days),
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

  async create({ userId, actorId, type, date_from, date_to, comment, ip }) {
    const allDates = generateDateRange(date_from, date_to);
    const overrides = await AbsenceRepository.findCalendarOverrides(allDates);
    const overrideMap = Object.fromEntries(overrides.map((item) => [item.date, item.day_type]));

    const workingDates = allDates.filter((date) => {
      const dayType = overrideMap[date] ?? getDefaultDayType(date);
      return dayType === 'working';
    });

    if (!workingDates.length) {
      throw appError(400, 'NO_WORKING_DAYS', 'В выбранном диапазоне нет рабочих дней');
    }

    const workLogDates = await AbsenceRepository.findWorkLogDates(userId, workingDates);
    const absenceDates = await AbsenceRepository.findAbsenceDates(userId, workingDates);
    const workLogSet = new Set(workLogDates);
    const absenceSet = new Set(absenceDates);

    const skippedWeekend = allDates.filter((date) => !workingDates.includes(date));
    const skippedWorkLog = workingDates.filter((date) => workLogSet.has(date));
    const skippedAbsence = workingDates.filter((date) => absenceSet.has(date));
    const validDates = workingDates.filter((date) => !workLogSet.has(date) && !absenceSet.has(date));

    if (!validDates.length) {
      throw appError(400, 'ALL_DAYS_SKIPPED', 'Все дни в диапазоне заняты или выходные', {
        skipped: {
          weekends: skippedWeekend,
          work_logs: skippedWorkLog,
          absences: skippedAbsence,
        },
      });
    }

    const records = validDates.map((date) => ({
      user_id: userId,
      type,
      date,
      duration_days: 1,
      comment: comment || null,
    }));

    const created = await AbsenceRepository.createMany(records);

    await AuditService.log({
      actorId: actorId ?? userId,
      eventType: 'ABSENCE_CREATED',
      entityType: 'absence',
      entityId: null,
      after: { type, dates: validDates },
      ip,
      result: 'success',
    });

    return {
      created: created.map((absence) => ({
        ...absence,
        duration_hours: daysToHours(absence.duration_days),
      })),
      skipped: {
        weekends: skippedWeekend,
        work_logs: skippedWorkLog,
        absences: skippedAbsence,
      },
    };
  },

  async update({ id, userId, isAdmin, ip, ...data }) {
    const absence = await AbsenceRepository.findById(id);
    if (!absence) {
      throw appError(404, 'NOT_FOUND', 'Запись не найдена');
    }
    if (!isAdmin && absence.user_id !== userId) {
      throw appError(403, 'FORBIDDEN', 'Нет доступа');
    }

    const updateData = {};

    if (data.date) {
      const [override] = await AbsenceRepository.findCalendarOverrides([data.date]);
      const dayType = override?.day_type ?? getDefaultDayType(data.date);
      if (dayType !== 'working') {
        throw appError(400, 'WEEKEND_DATE', 'Нельзя перенести отсутствие на выходной или праздник');
      }

      const hasWorkLog = await AbsenceRepository.hasWorkLogOnDate(absence.user_id, data.date);
      if (hasWorkLog) {
        throw appError(400, 'WORK_LOG_CONFLICT', 'В этот день уже есть рабочий лог');
      }

      const existingAbsence = await AbsenceRepository.findByUserAndDate(absence.user_id, data.date);
      if (existingAbsence && existingAbsence.id !== id) {
        throw appError(400, 'ABSENCE_CONFLICT', 'В этот день уже есть запись об отсутствии');
      }

      updateData.date = data.date;
    }

    if (data.type) {
      updateData.type = data.type;
    }
    if (data.comment !== undefined) {
      updateData.comment = data.comment;
    }
    if (data.duration) {
      const days = parseDurationToDays(data.duration);
      if (days > 3) { throw appError(400, 'DURATION_EXCEEDS_MAX', 'Длительность не более 24ч или 1д'); }
      updateData.duration_days = days;
    }

    const before = {
      date: absence.date,
      type: absence.type,
      duration_days: absence.duration_days,
      comment: absence.comment,
    };
    const updated = await AbsenceRepository.updateById(id, updateData);

    await AuditService.log({
      actorId: userId,
      eventType: 'ABSENCE_UPDATED',
      entityType: 'absence',
      entityId: id,
      before,
      after: updateData,
      ip,
      result: 'success',
    });

    return { ...updated, duration_hours: daysToHours(updated.duration_days) };
  },

  async delete({ id, userId, isAdmin, ip }) {
    const absence = await AbsenceRepository.findById(id);
    if (!absence) {
      throw appError(404, 'NOT_FOUND', 'Запись не найдена');
    }
    if (!isAdmin && absence.user_id !== userId) {
      throw appError(403, 'FORBIDDEN', 'Нет доступа');
    }

    await AbsenceRepository.deleteById(id);

    await AuditService.log({
      actorId: userId,
      eventType: 'ABSENCE_DELETED',
      entityType: 'absence',
      entityId: id,
      before: { date: absence.date, type: absence.type },
      ip,
      result: 'success',
    });

    return { message: 'Запись удалена' };
  },
};
