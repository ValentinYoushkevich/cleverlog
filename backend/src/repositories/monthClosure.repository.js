import db from '../config/knex.js';

export const MonthClosureRepository = {
  findAll: () => db('month_closures')
    .join('users as u', 'u.id', 'month_closures.closed_by')
    .select(
      'month_closures.id',
      'month_closures.year',
      'month_closures.month',
      'month_closures.closed_at',
      'u.first_name',
      'u.last_name',
      'u.email',
    )
    .orderBy([
      { column: 'month_closures.year', order: 'desc' },
      { column: 'month_closures.month', order: 'desc' },
    ]),

  findByYearMonth: (year, month) => db('month_closures').where({ year, month }).first(),

  async create(data) {
    const rows = await db('month_closures').insert(data).returning('*');
    return rows[0];
  },

  deleteByYearMonth: (year, month) => db('month_closures').where({ year, month }).delete(),
};
