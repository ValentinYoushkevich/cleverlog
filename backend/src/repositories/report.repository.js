import db from '../config/knex.js';

export const ReportRepository = {
  getActiveUsers: () => db('users')
    .where({ status: 'active' })
    .whereNull('deleted_at')
    .select('id', 'first_name', 'last_name')
    .orderBy('last_name', 'asc'),

  getAllProjects: () => db('projects')
    .whereNull('deleted_at')
    .select('id', 'name')
    .orderBy('name', 'asc'),

  getWorkLogs: ({ dateFrom, dateTo }) => db('work_logs as wl')
    .join('projects as p', 'p.id', 'wl.project_id')
    .whereBetween('wl.date', [dateFrom, dateTo])
    .select(
      'wl.id',
      'wl.user_id',
      'wl.project_id',
      'wl.date',
      'wl.duration_days',
      'p.name as project_name',
    ),

  getAbsences: ({ dateFrom, dateTo }) => db('absences')
    .whereBetween('date', [dateFrom, dateTo])
    .select('id', 'user_id', 'date', 'duration_days', 'type'),
};
