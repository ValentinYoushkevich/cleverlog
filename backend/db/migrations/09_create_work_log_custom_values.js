export async function up(knex) {
  await knex.schema.createTable('work_log_custom_values', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('work_log_id').notNullable().references('id').inTable('work_logs').onDelete('CASCADE');
    table.uuid('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('RESTRICT');
    table.text('value').nullable();
    table.timestamps(true, true);
    table.unique(['work_log_id', 'custom_field_id']);
    table.index(['work_log_id']);
    table.index(['custom_field_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('work_log_custom_values');
}
