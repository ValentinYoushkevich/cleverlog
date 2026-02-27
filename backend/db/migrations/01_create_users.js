export async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.string('email').notNullable().unique();
    table.string('password_hash').nullable();
    table.enum('role', ['user', 'admin']).notNullable().defaultTo('user');
    table.string('position').nullable();
    table.enum('status', ['active', 'inactive']).notNullable().defaultTo('active');
    table.date('hire_date').nullable();
    table.date('dismissal_date').nullable();
    table.specificType('tags', 'text[]').nullable();
    table.string('invite_token_hash').nullable().unique();
    table.timestamp('invite_expires_at').nullable();
    table.integer('failed_attempts').notNullable().defaultTo(0);
    table.timestamp('locked_until').nullable();
    table.timestamp('deleted_at').nullable();
    table.timestamps(true, true);
    table.index(['deleted_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('users');
}
