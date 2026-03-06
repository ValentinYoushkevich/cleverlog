import db from '../config/knex.js';
import { AUDIT_EVENT_LABEL } from '../constants/auditEvents.js';

export const AuditService = {
  async log({
    actorId,
    actorRole,
    eventType,
    eventLabel,
    entityType,
    entityId,
    before,
    after,
    ip,
    result = 'success',
  }) {
    await db('audit_logs').insert({
      actor_id: actorId ?? null,
      actor_role: actorRole ?? null,
      event_type: eventType,
      event_label: eventLabel ?? AUDIT_EVENT_LABEL[eventType] ?? eventType,
      entity_type: entityType,
      entity_id: entityId ?? null,
      before: before ?? null,
      after: after ?? null,
      ip: ip ?? null,
      result,
    });
  },
};
