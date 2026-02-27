export async function up(knex) {
  await knex.schema.createTable('absences', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('type', ['vacation', 'sick_leave', 'day_off']).notNullable();
    table.date('date').notNullable();
    table.decimal('duration_days', 10, 4).notNullable().defaultTo(1);
    table.text('comment').nullable();
    table.timestamps(true, true);
    table.unique(['user_id', 'date']);
    table.index(['user_id']);
    table.index(['date']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('absences');
}
