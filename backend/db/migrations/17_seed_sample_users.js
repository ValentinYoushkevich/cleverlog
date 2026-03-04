import argon2 from 'argon2';

export async function up(knex) {
  // Не трогаем существующего администратора admin@cleverlog.local
  const usersToEnsure = [
    {
      email: 'demo-admin@cleverlog.local',
      role: 'admin',
      first_name: 'Demo',
      last_name: 'Admin',
      position: 'Demo Administrator',
      passwordPlain: 'AdminDemo123!',
    },
    {
      email: 'demo-user@cleverlog.local',
      role: 'user',
      first_name: 'Demo',
      last_name: 'User',
      position: 'Demo User',
      passwordPlain: 'UserDemo123!',
    },
  ];

  for (const u of usersToEnsure) {
    // Если пользователь с таким email уже есть, не создаём дубль
    // (это позволяет безопасно прогонять миграцию на разных стендах)
    // eslint-disable-next-line no-await-in-loop
    const existing = await knex('users').where({ email: u.email }).first();
    if (existing) continue;

    // eslint-disable-next-line no-await-in-loop
    const hash = await argon2.hash(u.passwordPlain);

    // eslint-disable-next-line no-await-in-loop
    await knex('users').insert({
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      password_hash: hash,
      role: u.role,
      position: u.position,
      status: 'active',
      hire_date: '2024-01-01',
    });
  }
}

export async function down(knex) {
  await knex('users')
    .whereIn('email', [
      'demo-admin@cleverlog.local',
      'demo-user@cleverlog.local',
    ])
    .del();
}

