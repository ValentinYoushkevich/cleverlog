import db from '../config/knex.js';

export const ReportRepository = {
  getWorkLogs: ({
    userId,
    projectId,
    dateFrom,
    dateTo,
  }) => {
    const query = db('work_logs as wl')
      .join('projects as p', 'p.id', 'wl.project_id')
      .join('users as u', 'u.id', 'wl.user_id')
      .select(
        'wl.id',
        'wl.date',
        'wl.duration_days',
        'wl.comment',
        'wl.task_number',
        'wl.user_id',
        'wl.project_id',
        'p.name as project_name',
        'u.first_name',
        'u.last_name',
        'u.position',
      )
      .orderBy('wl.date');

    if (userId) {
      query.where('wl.user_id', userId);
    }
    if (projectId) {
      query.where('wl.project_id', projectId);
    }
    if (dateFrom) {
      query.where('wl.date', '>=', dateFrom);
    }
    if (dateTo) {
      query.where('wl.date', '<=', dateTo);
    }

    return query;
  },

  getAbsences: ({ userId, dateFrom, dateTo }) => {
    const query = db('absences as a')
      .join('users as u', 'u.id', 'a.user_id')
      .select('a.*', 'u.first_name', 'u.last_name')
      .orderBy('a.date');

    if (userId) {
      query.where('a.user_id', userId);
    }
    if (dateFrom) {
      query.where('a.date', '>=', dateFrom);
    }
    if (dateTo) {
      query.where('a.date', '<=', dateTo);
    }

    return query;
  },

  getActiveUsers: () => db('users')
    .where({ status: 'active' })
    .whereNull('deleted_at')
    .select('*')
    .orderBy('last_name'),

  async getCustomValues(workLogIds) {
    if (!workLogIds.length) {
      return [];
    }

    return db('work_log_custom_values as wcv')
      .join('custom_fields as cf', 'cf.id', 'wcv.custom_field_id')
      .whereIn('wcv.work_log_id', workLogIds)
      .whereNull('cf.deleted_at')
      .select('wcv.work_log_id', 'wcv.value', 'cf.name as field_name', 'cf.type');
  },

  getAllProjects: () => db('projects')
    .whereNull('deleted_at')
    .select('*')
    .orderBy('name'),
};
