import db from '../config/knex.js';

export const AuditService = {
  async log({
    actorId,
    actorRole,
    eventType,
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
      entity_type: entityType,
      entity_id: entityId ?? null,
      before: before ?? null,
      after: after ?? null,
      ip: ip ?? null,
      result,
    });
  },
};
