import db from '../config/knex.js';

export const WorkLogRepository = {
  async findAll({
    userId,
    projectId,
    dateFrom,
    dateTo,
    taskNumber,
    comment,
    page,
    limit,
  }) {
    const baseQuery = db('work_logs as wl')
      .join('users as u', 'u.id', 'wl.user_id')
      .join('projects as p', 'p.id', 'wl.project_id');

    if (userId) {
      baseQuery.where('wl.user_id', userId);
    }
    if (projectId) {
      baseQuery.where('wl.project_id', projectId);
    }
    if (dateFrom) {
      baseQuery.where('wl.date', '>=', dateFrom);
    }
    if (dateTo) {
      baseQuery.where('wl.date', '<=', dateTo);
    }
    if (taskNumber) {
      baseQuery.whereILike('wl.task_number', `%${taskNumber}%`);
    }
    if (comment) {
      baseQuery.whereILike('wl.comment', `%${comment}%`);
    }

    const countRow = await baseQuery.clone().countDistinct('wl.id as total').first();
    const total = Number(countRow?.total || 0);

    const data = await baseQuery
      .clone()
      .select(
        'wl.id',
        'wl.date',
        'wl.duration_days',
        'wl.comment',
        'wl.task_number',
        'wl.user_id',
        'wl.project_id',
        'wl.created_at',
        'wl.updated_at',
        'u.first_name',
        'u.last_name',
        'u.position',
        'p.name as project_name',
      )
      .orderBy('wl.date', 'desc')
      .offset((page - 1) * limit)
      .limit(limit);

    return { data, total };
  },

  findById: (id) => db('work_logs').where({ id }).first(),

  async create(data) {
    const rows = await db('work_logs').insert(data).returning('*');
    return rows[0];
  },

  async updateById(id, data) {
    const rows = await db('work_logs')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');

    return rows[0] ?? null;
  },

  deleteById: (id) => db('work_logs').where({ id }).delete(),

  async sumDayDuration(userId, date, excludeId = null) {
    const query = db('work_logs')
      .where({ user_id: userId, date })
      .sum('duration_days as total');

    if (excludeId) {
      query.whereNot({ id: excludeId });
    }

    const result = await query.first();
    return Number.parseFloat(result?.total || 0);
  },

  async upsertCustomValues(workLogId, customFields = {}) {
    for (const [fieldId, value] of Object.entries(customFields)) {
      const existing = await db('work_log_custom_values')
        .where({ work_log_id: workLogId, custom_field_id: fieldId })
        .first();

      if (existing) {
        await db('work_log_custom_values')
          .where({ work_log_id: workLogId, custom_field_id: fieldId })
          .update({ value: String(value), updated_at: db.fn.now() });
      } else {
        await db('work_log_custom_values')
          .insert({ work_log_id: workLogId, custom_field_id: fieldId, value: String(value) });
      }
    }
  },

  getCustomValues: (workLogId) => db('work_log_custom_values as wcv')
    .join('custom_fields as cf', 'cf.id', 'wcv.custom_field_id')
    .where('wcv.work_log_id', workLogId)
    .select('wcv.custom_field_id', 'wcv.value', 'cf.name', 'cf.type'),
};
