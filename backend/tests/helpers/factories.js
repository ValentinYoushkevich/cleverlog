import argon2 from 'argon2';
import db from '../../src/config/knex.js';

function uniqueEmail(prefix = 'user') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${rand}@test.local`;
}

export async function createUser(overrides = {}) {
  const data = {
    first_name: 'Test',
    last_name: 'User',
    email: uniqueEmail('user'),
    role: 'user',
    status: 'active',
    failed_attempts: 0,
    ...overrides,
  };

  const [user] = await db('users').insert(data).returning('*');
  return user;
}

export async function createUserWithPassword({
  email = uniqueEmail('user'),
  password = 'Password123!',
  ...overrides
} = {}) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return createUser({
    email,
    password_hash: passwordHash,
    ...overrides,
  });
}

export function createInvitedUser({
  email = null,
  token = 'invite-token',
  expiresAt = new Date(Date.now() + 60 * 60 * 1000),
  ...overrides
} = {}) {
  return createUser({
    email,
    invite_token_hash: token,
    invite_expires_at: expiresAt,
    ...overrides,
  });
}
