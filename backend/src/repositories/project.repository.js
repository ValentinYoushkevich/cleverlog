import db from '../config/knex.js';

export const ProjectRepository = {
  findAll: ({ status } = {}) => {
    const query = db('projects')
      .select('*')
      .whereNull('deleted_at')
      .orderBy('name');

    if (status) {
      query.where({ status });
    }

    return query;
  },

  findById: (id) => db('projects').where({ id }).whereNull('deleted_at').first(),

  async create(data) {
    const rows = await db('projects')
      .insert(data)
      .returning('*');

    return rows[0];
  },

  async updateById(id, data) {
    const rows = await db('projects')
      .where({ id })
      .whereNull('deleted_at')
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');

    return rows[0] ?? null;
  },
};
