export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('email').nullable().alter();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('email').notNullable().alter();
  });
}

