import dayjs from 'dayjs';
import db from '../config/knex.js';

export const CalendarRepository = {
  getOverrides: (year, month) => {
    const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD');
    const end = dayjs(start).endOf('month').format('YYYY-MM-DD');

    return db('calendar_days')
      .whereBetween('date', [start, end])
      .select('*');
  },

  getDayOverride: (date) => db('calendar_days').where({ date }).first(),

  async upsertDay(date, day_type) {
    const existing = await db('calendar_days').where({ date }).first();
    if (existing) {
      const rows = await db('calendar_days')
        .where({ date })
        .update({ day_type, updated_at: db.fn.now() })
        .returning('*');

      return rows[0];
    }

    const rows = await db('calendar_days')
      .insert({ date, day_type })
      .returning('*');

    return rows[0];
  },

  getNorm: (year, month) => db('calendar_settings').where({ year, month }).first(),

  async upsertNorm(year, month, norm_hours) {
    const existing = await db('calendar_settings').where({ year, month }).first();
    if (existing) {
      const rows = await db('calendar_settings')
        .where({ year, month })
        .update({ norm_hours, updated_at: db.fn.now() })
        .returning('*');

      return rows[0];
    }

    const rows = await db('calendar_settings')
      .insert({ year, month, norm_hours })
      .returning('*');

    return rows[0];
  },
};
