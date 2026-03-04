export async function up(knex) {
  // Разрешаем значение 'manager' в CHECK-constraint для колонки role
  await knex.schema.raw('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check"');
  await knex.schema.raw(
    'ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK (role IN (\'user\', \'admin\', \'manager\'))',
  );
}

export async function down(knex) {
  // Возвращаем исходное ограничение только с user/admin
  await knex.schema.raw('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check"');
  await knex.schema.raw(
    'ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK (role IN (\'user\', \'admin\'))',
  );
}

