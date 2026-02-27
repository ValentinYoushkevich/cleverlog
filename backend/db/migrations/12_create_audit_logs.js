export async function up(knex) {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    table.uuid('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('actor_role').nullable();
    table.string('event_type').notNullable();
    table.string('entity_type').nullable();
    table.uuid('entity_id').nullable();
    table.jsonb('before').nullable();
    table.jsonb('after').nullable();
    table.string('ip').nullable();
    table.string('result').notNullable().defaultTo('success');
    table.timestamps(true, true);
    table.index(['actor_id']);
    table.index(['event_type']);
    table.index(['entity_type']);
    table.index(['timestamp']);
    table.index(['result']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
}
