export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('invite_mode').nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('invite_mode');
  });
}
