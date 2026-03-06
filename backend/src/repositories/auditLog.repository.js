import db from '../config/knex.js';

function applyFilters(query, {
  actorId,
  eventType,
  entityType,
  dateFrom,
  dateTo,
  ip,
  result,
  search,
  searchEntityTypes,
}) {
  if (actorId) {
    query.where('al.actor_id', actorId);
  }
  if (eventType) {
    query.where('al.event_type', eventType);
  }
  if (entityType) {
    query.where('al.entity_type', entityType);
  }
  if (dateFrom) {
    query.where('al.timestamp', '>=', dateFrom);
  }
  if (dateTo) {
    query.where('al.timestamp', '<=', `${dateTo} 23:59:59`);
  }
  if (ip) {
    query.whereILike('al.ip', `%${ip}%`);
  }
  if (result) {
    query.where('al.result', result);
  }
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

export const AuditLogRepository = {
  async findAll({
    actorId,
    eventType,
    entityType,
    dateFrom,
    dateTo,
    ip,
    result,
    search,
    searchEntityTypes,
    page,
    limit,
  }) {
    const baseQuery = db('audit_logs as al')
      .leftJoin('users as u', 'u.id', 'al.actor_id');

    applyFilters(baseQuery, {
      actorId,
      eventType,
      entityType,
      dateFrom,
      dateTo,
      ip,
      result,
      search,
      searchEntityTypes,
    });

    const countRow = await baseQuery.clone().countDistinct('al.id as total').first();
    const total = Number(countRow?.total || 0);

    const data = await baseQuery
      .clone()
      .select(
        'al.id',
        'al.timestamp',
        'al.actor_id',
        'al.actor_role',
        'al.event_type',
        'al.event_label',
        'al.entity_type',
        'al.entity_id',
        'al.before',
        'al.after',
        'al.ip',
        'al.result',
        'u.first_name',
        'u.last_name',
        'u.email as actor_email',
      )
      .orderBy('al.timestamp', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

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
