import { AuditLogService } from '../services/auditLog.service.js';
import { auditLogFiltersSchema } from '../validators/auditLog.validators.js';

export const AuditLogController = {
  async list(req, res, next) {
    try {
      const filters = auditLogFiltersSchema.parse(req.query);
      const result = await AuditLogService.list({
        actorId: filters.actor_id,
        eventType: filters.event_type,
        entityType: filters.entity_type,
        dateFrom: filters.date_from,
        dateTo: filters.date_to,
        ip: filters.ip,
        result: filters.result,
        search: filters.search,
        page: filters.page,
        limit: filters.limit,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async filterOptions(_req, res, next) {
    try {
      const options = await AuditLogService.getFilterOptions();
      return res.json(options);
    } catch (err) {
      return next(err);
    }
  },

  async export(req, res, next) {
    try {
      const filters = auditLogFiltersSchema.parse(req.query);
      const wb = await AuditLogService.export({
        actorId: filters.actor_id,
        eventType: filters.event_type,
        entityType: filters.entity_type,
        dateFrom: filters.date_from,
        dateTo: filters.date_to,
        ip: filters.ip,
        result: filters.result,
        search: filters.search,
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_log.xlsx"');
      await wb.xlsx.write(res);
      return res.end();
    } catch (err) {
      return next(err);
    }
  },
};
