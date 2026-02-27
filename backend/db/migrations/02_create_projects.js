export async function up(knex) {
  await knex.schema.createTable('projects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.enum('status', ['active', 'on_hold', 'closed']).notNullable().defaultTo('active');
    table.timestamp('deleted_at').nullable();
    table.timestamps(true, true);
    table.index(['status']);
    table.index(['deleted_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('projects');
}
