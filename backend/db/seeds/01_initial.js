import argon2 from 'argon2';

export async function seed(knex) {
  await knex('notification_settings').del();
  await knex('audit_logs').del();
  await knex('month_closures').del();
  await knex('absences').del();
  await knex('work_log_custom_values').del();
  await knex('work_logs').del();
  await knex('calendar_days').del();
  await knex('calendar_settings').del();
  await knex('project_custom_fields').del();
  await knex('custom_field_options').del();
  await knex('custom_fields').del();
  await knex('projects').del();
  await knex('users').del();

  const adminHash = await argon2.hash('Admin1234!');
  await knex('users').insert({
    first_name: 'Super',
    last_name: 'Admin',
    email: 'admin@cleverlog.local',
    password_hash: adminHash,
    role: 'admin',
    position: 'System Administrator',
    status: 'active',
    hire_date: '2024-01-01',
  });

  const userHash = await argon2.hash('User1234!');
  await knex('users').insert([
    {
      first_name: 'Ivan',
      last_name: 'Ivanov',
      email: 'ivanov@cleverlog.local',
      password_hash: userHash,
      role: 'user',
      position: 'Developer',
      status: 'active',
      hire_date: '2024-03-01',
    },
    {
      first_name: 'Maria',
      last_name: 'Petrova',
      email: 'petrova@cleverlog.local',
      password_hash: userHash,
      role: 'user',
      position: 'Designer',
      status: 'active',
      hire_date: '2024-06-01',
    },
  ]);

  await knex('projects').insert([
    { name: 'CleverLog MVP', status: 'active' },
    { name: 'Internal Tools', status: 'on_hold' },
    { name: 'Legacy Migration', status: 'closed' },
  ]);

  const now = new Date();
  await knex('calendar_settings').insert({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    norm_hours: 168,
  });

  await knex('notification_settings').insert({
    global_enabled: true,
    enabled: true,
  });
}
