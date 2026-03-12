import db from '../config/knex.js';

function applySimpleFilters(query, f) {
  if (f.actorId) { query.where('al.actor_id', f.actorId); }
  if (f.eventType) { query.where('al.event_type', f.eventType); }
  if (f.entityType) { query.where('al.entity_type', f.entityType); }
  if (f.dateFrom) { query.where('al.timestamp', '>=', f.dateFrom); }
  if (f.dateTo) { query.where('al.timestamp', '<=', `${f.dateTo} 23:59:59`); }
  if (f.ip) { query.whereILike('al.ip', `%${f.ip}%`); }
  if (f.result) { query.where('al.result', f.result); }
}

function applySearchFilters(query, { search, searchEntityTypes }) {
  if (search) {
    query.where(function scopedSearch() {
      this.whereILike('al.event_type', `%${search}%`)
        .orWhereILike('al.event_label', `%${search}%`)
        .orWhereILike('al.entity_type', `%${search}%`);
    });
  }
  if (Array.isArray(searchEntityTypes) && searchEntityTypes.length > 0) {
    query.orWhereIn('al.entity_type', searchEntityTypes);
  }
}

function applyFilters(query, filters) {
  applySimpleFilters(query, filters);
  applySearchFilters(query, filters);
}

export const AuditLogRepository = {
  async findAll(filters) {
    const { page, limit } = filters;
    const baseQuery = db('audit_logs as al').leftJoin('users as u', 'u.id', 'al.actor_id');
    applyFilters(baseQuery, filters);

    const countRow = await baseQuery.clone().countDistinct('al.id as total').first();
    const total = Number(countRow?.total || 0);
    const data = await baseQuery.clone()
      .select(
        'al.id', 'al.timestamp', 'al.actor_id', 'al.actor_role', 'al.event_type',
        'al.event_label', 'al.entity_type', 'al.entity_id', 'al.before', 'al.after',
        'al.ip', 'al.result', 'u.first_name', 'u.last_name', 'u.email as actor_email',
      )
      .orderBy('al.timestamp', 'desc').offset((page - 1) * limit).limit(limit);
    return { data, total };
  },

  findAllRaw(filters) {
    const query = db('audit_logs as al')
      .leftJoin('users as u', 'u.id', 'al.actor_id')
      .select(
        'al.timestamp',
        'al.actor_role',
        'al.event_type',
        'al.event_label',
        'al.entity_type',
        'al.entity_id',
        'al.ip',
        'al.result',
        'u.first_name',
        'u.last_name',
        'u.email as actor_email',
      )
      .orderBy('al.timestamp', 'desc');

    applyFilters(query, filters);

    return query;
  },

  getDistinctEventTypes: () => db('audit_logs')
    .select('event_type')
    .max('event_label as event_label')
    .groupBy('event_type')
    .orderBy('event_type'),
  getDistinctEntityTypes: () => db('audit_logs').distinct('entity_type').orderBy('entity_type').pluck('entity_type'),
};
