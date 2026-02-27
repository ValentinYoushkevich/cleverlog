import db from '../config/knex.js';

export const UserRepository = {
  findByEmail: (email) => db('users').where({ email }).first(),

  findByInviteToken: (token) => db('users').where({ invite_token_hash: token }).first(),

  findById: (id) => db('users').where({ id }).first(),

  updateById: (id, data) => db('users').where({ id }).update({ ...data, updated_at: db.fn.now() }),
};
