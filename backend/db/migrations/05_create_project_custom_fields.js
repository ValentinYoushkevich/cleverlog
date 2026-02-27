export async function up(knex) {
  await knex.schema.createTable('project_custom_fields', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
    table.boolean('is_required').notNullable().defaultTo(false);
    table.boolean('is_enabled').notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.unique(['project_id', 'custom_field_id']);
    table.index(['project_id']);
    table.index(['custom_field_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('project_custom_fields');
}
