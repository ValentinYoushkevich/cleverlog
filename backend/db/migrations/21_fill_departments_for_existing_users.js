export async function up(knex) {
  const users = await knex('users').select('id', 'role', 'department');

  const departmentsByRole = {
    admin: 'Other',
    manager: 'BE',
    user: 'FE',
  };

  for (const user of users) {
    if (user.department) continue;
    const dept = departmentsByRole[user.role] || 'Other';
    // eslint-disable-next-line no-await-in-loop
    await knex('users').where({ id: user.id }).update({ department: dept });
  }
}

export async function down(knex) {
  // При откате просто очищаем department только у тех пользователей,
  // кому выставили один из наших "дефолтных" отделов.
  await knex('users')
    .whereIn('department', ['FE', 'BE', 'Other'])
    .update({ department: null });
}

