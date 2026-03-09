export async function up(knex) {
  await knex.schema.createTable('js_errors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.text('message').notNullable();
    table.text('source').nullable();
    table.integer('lineno').nullable();
    table.integer('colno').nullable();
    table.text('stack').nullable();
    table.text('url').nullable();
    table.text('user_agent').nullable();
    table.string('ip', 45).nullable();
    table.index(['created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('js_errors');
}
