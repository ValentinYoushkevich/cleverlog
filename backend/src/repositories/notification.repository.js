import db from '../config/knex.js';

export const NotificationRepository = {
  getGlobal: () => db('notification_settings').whereNull('user_id').first(),

  getForUser: (userId) => db('notification_settings').where({ user_id: userId }).first(),

  getAllUserSettings: () => db('notification_settings').whereNotNull('user_id').select('*'),

  async upsertGlobal(enabled) {
    const existing = await db('notification_settings').whereNull('user_id').first();
    if (existing) {
      const rows = await db('notification_settings')
        .whereNull('user_id')
        .update({ global_enabled: enabled, updated_at: db.fn.now() })
        .returning('*');
      return rows[0];
    }

    const rows = await db('notification_settings')
      .insert({ global_enabled: enabled })
      .returning('*');
    return rows[0];
  },

  async upsertForUser(userId, enabled) {
    const existing = await db('notification_settings').where({ user_id: userId }).first();
    if (existing) {
      const rows = await db('notification_settings')
        .where({ user_id: userId })
        .update({ enabled, updated_at: db.fn.now() })
        .returning('*');
      return rows[0];
    }

    const rows = await db('notification_settings')
      .insert({ user_id: userId, enabled, global_enabled: true })
      .returning('*');
    return rows[0];
  },
};
