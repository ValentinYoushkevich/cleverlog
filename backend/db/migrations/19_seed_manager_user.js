import argon2 from 'argon2';

export async function up(knex) {
  // После расширения CHECK-constraint (миграция 18) добавляем демо-пользователя-менеджера
  const email = 'demo-manager@cleverlog.local';

  const existing = await knex('users').where({ email }).first();
  if (existing) return;

  const hash = await argon2.hash('ManagerDemo123!');

  await knex('users').insert({
    first_name: 'Demo',
    last_name: 'Manager',
    email,
    password_hash: hash,
    role: 'manager',
    position: 'Department Manager',
    status: 'active',
    hire_date: '2024-01-01',
  });
}

export async function down(knex) {
  await knex('users').where({ email: 'demo-manager@cleverlog.local' }).del();
}

