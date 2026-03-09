export async function up(knex) {
  await knex.schema.alterTable('js_errors', (table) => {
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('user_email').nullable();
    table.text('user_name').nullable();

    table.text('request_url').nullable();
    table.string('request_method', 16).nullable();
    table.jsonb('request_body').nullable();

    table.integer('response_status').nullable();
    table.jsonb('response_body').nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('js_errors', (table) => {
    table.dropColumn('response_body');
    table.dropColumn('response_status');
    table.dropColumn('request_body');
    table.dropColumn('request_method');
    table.dropColumn('request_url');
    table.dropColumn('user_name');
    table.dropColumn('user_email');
    table.dropColumn('user_id');
  });
}
