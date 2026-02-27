export async function up(knex) {
  await knex.schema.createTable('notification_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.boolean('global_enabled').notNullable().defaultTo(true);
    table.uuid('user_id').nullable().unique().references('id').inTable('users').onDelete('CASCADE');
    table.boolean('enabled').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('notification_settings');
}
