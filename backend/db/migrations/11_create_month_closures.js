export async function up(knex) {
  await knex.schema.createTable('month_closures', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.integer('year').notNullable();
    table.integer('month').notNullable();
    table.uuid('closed_by').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.timestamp('closed_at').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);
    table.unique(['year', 'month']);
    table.index(['closed_by']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('month_closures');
}
