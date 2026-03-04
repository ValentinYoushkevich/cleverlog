export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('department').nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('department');
  });
}

