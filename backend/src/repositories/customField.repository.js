import db from '../config/knex.js';

export const CustomFieldRepository = {
  findAll: ({ includeDeleted = false } = {}) => {
    const query = db('custom_fields')
      .select('*')
      .orderBy('name');

    if (!includeDeleted) {
      query.whereNull('deleted_at');
    }

    return query;
  },

  findById: (id) => db('custom_fields').where({ id }).first(),

  async create(data) {
    const rows = await db('custom_fields')
      .insert(data)
      .returning('*');

    return rows[0];
  },

  async updateById(id, data) {
    const rows = await db('custom_fields')
      .where({ id })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');

    return rows[0] ?? null;
  },

  async isUsed(id) {
    const row = await db('work_log_custom_values')
      .where({ custom_field_id: id })
      .first();

    return !!row;
  },

  getOptions: (customFieldId) => db('custom_field_options')
    .where({ custom_field_id: customFieldId })
    .orderBy('sort_order')
    .select('*'),

  findOptionById: (id) => db('custom_field_options').where({ id }).first(),

  async addOption(data) {
    const rows = await db('custom_field_options')
      .insert(data)
      .returning('*');

    return rows[0];
  },

  deprecateOption: (id) => db('custom_field_options')
    .where({ id })
    .update({ is_deprecated: true, updated_at: db.fn.now() }),

  getProjectFields: (projectId) => db('project_custom_fields as pcf')
    .join('custom_fields as cf', 'cf.id', 'pcf.custom_field_id')
    .where('pcf.project_id', projectId)
    .whereNull('cf.deleted_at')
    .select('pcf.*', 'cf.name', 'cf.type'),

  findProjectField: (projectId, customFieldId) => db('project_custom_fields')
    .where({ project_id: projectId, custom_field_id: customFieldId })
    .first(),

  async attachToProject(data) {
    const rows = await db('project_custom_fields')
      .insert(data)
      .returning('*');

    return rows[0];
  },

  async updateProjectField(projectId, customFieldId, data) {
    const rows = await db('project_custom_fields')
      .where({ project_id: projectId, custom_field_id: customFieldId })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');

    return rows[0] ?? null;
  },

  detachFromProject: (projectId, customFieldId) => db('project_custom_fields')
    .where({ project_id: projectId, custom_field_id: customFieldId })
    .delete(),
};
