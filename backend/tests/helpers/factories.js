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

export async function createProject(overrides = {}) {
  const data = {
    name: 'Test project',
    status: 'active',
    ...overrides,
  };

  const [project] = await db('projects').insert(data).returning('*');
  return project;
}

export async function createWorkLog(overrides = {}) {
  const data = {
    user_id: overrides.user_id,
    project_id: overrides.project_id,
    date: overrides.date,
    duration_days: overrides.duration_days ?? 1,
    comment: overrides.comment ?? 'Test work log',
    task_number: overrides.task_number ?? 'TASK-1',
  };

  const [log] = await db('work_logs').insert(data).returning('*');
  return log;
}

export async function createAbsence(overrides = {}) {
  const data = {
    user_id: overrides.user_id,
    type: overrides.type ?? 'vacation',
    date: overrides.date,
    duration_days: overrides.duration_days ?? 1,
    comment: overrides.comment ?? null,
  };

  const [absence] = await db('absences').insert(data).returning('*');
  return absence;
}

export async function createCalendarNorm({ year, month, norm_hours }) {
  const [row] = await db('calendar_settings')
    .insert({ year, month, norm_hours })
    .onConflict(['year', 'month'])
    .merge()
    .returning('*');

  return row;
}

export async function createCalendarOverride({ date, day_type }) {
  const [row] = await db('calendar_days')
    .insert({ date, day_type })
    .onConflict(['date'])
    .merge()
    .returning('*');

  return row;
}

export async function createCustomField(overrides = {}) {
  const data = {
    name: overrides.name ?? 'Custom field',
    type: overrides.type ?? 'text',
  };

  const [field] = await db('custom_fields').insert(data).returning('*');
  return field;
}

export async function createDropdownFieldWithOptions({ name = 'Dropdown', options = [] } = {}) {
  const field = await createCustomField({ name, type: 'dropdown' });

  const createdOptions = [];
  for (let index = 0; index < options.length; index += 1) {
    const [opt] = await db('custom_field_options')
      .insert({
        custom_field_id: field.id,
        label: options[index],
        sort_order: index,
      })
      .returning('*');
    createdOptions.push(opt);
  }

  return { field, options: createdOptions };
}
