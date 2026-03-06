export async function up(knex) {
  await knex.schema.alterTable('audit_logs', (table) => {
    table.string('event_label').nullable();
    table.index(['event_label']);
  });

  // Backfill: set label to code for existing rows.
  await knex('audit_logs')
    .update({ event_label: knex.raw('event_type') })
    .whereNull('event_label');

  await knex.schema.alterTable('audit_logs', (table) => {
    table.string('event_label').notNullable().alter();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('audit_logs', (table) => {
    table.dropIndex(['event_label']);
    table.dropColumn('event_label');
  });
}
