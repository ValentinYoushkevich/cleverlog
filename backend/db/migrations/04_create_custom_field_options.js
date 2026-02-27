export async function up(knex) {
  await knex.schema.createTable('custom_field_options', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
    table.string('label').notNullable();
    table.boolean('is_deprecated').notNullable().defaultTo(false);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.index(['custom_field_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('custom_field_options');
}
