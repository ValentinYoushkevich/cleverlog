export async function up(knex) {
  await knex.schema.createTable('custom_fields', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.enum('type', ['text', 'number', 'dropdown', 'checkbox']).notNullable();
    table.timestamp('deleted_at').nullable();
    table.timestamps(true, true);
    table.index(['deleted_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('custom_fields');
}
