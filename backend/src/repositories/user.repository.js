import db from '../config/knex.js';

export const UserRepository = {
  findByEmail: (email) => db('users').where({ email }).whereNull('deleted_at').first(),

  findByInviteToken: (token) => db('users').where({ invite_token_hash: token }).whereNull('deleted_at').first(),

  findById: (id) => db('users').where({ id }).whereNull('deleted_at').first(),

  findAll: ({ status, role, tags } = {}) => {
    const query = db('users')
      .select(
        'id',
        'first_name',
        'last_name',
        'email',
        'role',
        'position',
        'status',
        'hire_date',
        'dismissal_date',
        'tags',
        'created_at',
      )
      .whereNull('deleted_at');

    if (status) {
      query.where({ status });
    }

    if (role) {
      query.where({ role });
    }

    if (tags?.length) {
      query.where((builder) => {
        tags.forEach((tag, index) => {
          if (index === 0) {
            // ARRAY overlap implemented via ANY(tags)
            builder.whereRaw('? = ANY(tags)', [tag]);
          } else {
            builder.orWhereRaw('? = ANY(tags)', [tag]);
          }
        });
      });
    }

    return query.orderBy('last_name').orderBy('first_name');
  },

  async create(data) {
    const rows = await db('users')
      .insert(data)
      .returning('*');

    return rows[0];
  },

  async updateById(id, data) {
    const rows = await db('users')
      .where({ id })
      .whereNull('deleted_at')
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');

    return rows[0] ?? null;
  },

  deleteSessionsByUserId: async (_id) => undefined,
};
