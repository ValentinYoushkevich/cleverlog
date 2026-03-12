import dayjs from 'dayjs';
import db from '../config/knex.js';

function toDateKey(value) {
  return dayjs(value).format('YYYY-MM-DD');
}

function applyAbsenceFilters(query, { userId, dateFrom, dateTo, type }) {
  if (userId) { query.where('a.user_id', userId); }
  if (dateFrom) { query.where('a.date', '>=', dateFrom); }
  if (dateTo) { query.where('a.date', '<=', dateTo); }
  if (type) { query.where('a.type', type); }
}

const ABSENCE_LIST_COLUMNS = [
  'a.id', 'a.user_id', 'a.type', 'a.date', 'a.duration_days',
  'a.comment', 'a.created_at', 'a.updated_at', 'u.first_name', 'u.last_name',
];

export const AbsenceRepository = {
  async findAll({ userId, dateFrom, dateTo, type, page, limit }) {
    const baseQuery = db('absences as a').join('users as u', 'u.id', 'a.user_id');
    applyAbsenceFilters(baseQuery, { userId, dateFrom, dateTo, type });

    const countRow = await baseQuery.clone().countDistinct('a.id as total').first();
    const total = Number(countRow?.total || 0);
    const data = await baseQuery.clone().select(...ABSENCE_LIST_COLUMNS)
      .orderBy('a.date', 'desc').offset((page - 1) * limit).limit(limit);
    return { data, total };
  },

  findById: (id) => db('absences').where({ id }).first(),

  findByUserAndDate: (userId, date) => db('absences')
    .where({ user_id: userId, date })
    .first(),

  async findWorkLogDates(userId, dates) {
    if (!dates.length) {
      return [];
    }

    const rows = await db('work_logs')
      .where('user_id', userId)
      .whereIn('date', dates)
      .select('date');

    return rows.map((row) => toDateKey(row.date));
  },

  async findAbsenceDates(userId, dates) {
    if (!dates.length) {
      return [];
    }

    const rows = await db('absences')
      .where('user_id', userId)
      .whereIn('date', dates)
      .select('date');

    return rows.map((row) => toDateKey(row.date));
  },

  createMany: (records) => db('absences').insert(records).returning('*'),

  async updateById(id, data) {
    const rows = await db('absences')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');

    return rows[0] ?? null;
  },

  deleteById: (id) => db('absences').where({ id }).delete(),

  async findCalendarOverrides(dates) {
    if (!dates.length) {
      return [];
    }

    const rows = await db('calendar_days')
      .whereIn('date', dates)
      .select('date', 'day_type');

    return rows.map((row) => ({ ...row, date: toDateKey(row.date) }));
  },

  hasWorkLogOnDate: async (userId, date) => {
    const row = await db('work_logs')
      .where({ user_id: userId, date })
      .first();

    return Boolean(row);
  },
};
