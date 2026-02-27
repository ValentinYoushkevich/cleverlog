export async function up(knex) {
  await knex.schema.createTable('calendar_days', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.date('date').notNullable().unique();
    table.enum('day_type', ['working', 'weekend', 'holiday']).notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('calendar_days');
}
