import { MonthClosureRepository } from '../repositories/monthClosure.repository.js';
import { AuditService } from './audit.service.js';

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export const MonthClosureService = {
  list() {
    return MonthClosureRepository.findAll();
  },

  async close({ year, month, actorId, actorRole, ip }) {
    const existing = await MonthClosureRepository.findByYearMonth(year, month);
    if (existing) {
      throw appError(409, 'ALREADY_CLOSED', 'Месяц уже закрыт');
    }

    const closure = await MonthClosureRepository.create({
      year,
      month,
      closed_by: actorId,
    });

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'MONTH_CLOSED',
      entityType: 'month_closure',
      entityId: closure.id,
      after: { year, month },
      ip,
      result: 'success',
    });

    return closure;
  },

  async open({ year, month, actorId, actorRole, ip }) {
    const existing = await MonthClosureRepository.findByYearMonth(year, month);
    if (!existing) {
      throw appError(404, 'NOT_CLOSED', 'Месяц не был закрыт');
    }

    await MonthClosureRepository.deleteByYearMonth(year, month);

    await AuditService.log({
      actorId,
      actorRole,
      eventType: 'MONTH_OPENED',
      entityType: 'month_closure',
      entityId: existing.id,
      before: { year, month },
      ip,
      result: 'success',
    });

    return { message: `Месяц ${month}/${year} открыт` };
  },

  async isClosed(year, month) {
    const closure = await MonthClosureRepository.findByYearMonth(year, month);
    return Boolean(closure);
  },
};
