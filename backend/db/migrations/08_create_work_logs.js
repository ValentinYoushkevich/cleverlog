export async function up(knex) {
  await knex.schema.createTable('work_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('RESTRICT');
    table.date('date').notNullable();
    table.decimal('duration_days', 10, 4).notNullable();
    table.text('comment').notNullable();
    table.string('task_number').notNullable();
    table.timestamps(true, true);
    table.index(['user_id']);
    table.index(['project_id']);
    table.index(['date']);
    table.index(['user_id', 'date']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('work_logs');
}
