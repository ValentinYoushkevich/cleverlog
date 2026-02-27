export async function up(knex) {
  await knex.schema.createTable('calendar_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.integer('year').notNullable();
    table.integer('month').notNullable();
    table.decimal('norm_hours', 6, 2).notNullable().defaultTo(168);
    table.timestamps(true, true);
    table.unique(['year', 'month']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('calendar_settings');
}
