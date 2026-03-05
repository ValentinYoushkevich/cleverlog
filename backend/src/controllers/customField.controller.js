import { CustomFieldService } from '../services/customField.service.js';
import {
  addOptionSchema,
  attachToProjectSchema,
  createCustomFieldSchema,
  updateCustomFieldSchema,
  updateProjectFieldSchema,
} from '../validators/customField.validators.js';

export const CustomFieldController = {
  async list(req, res, next) {
    try {
      const includeDeleted = req.query.include_deleted === 'true';
      const fields = await CustomFieldService.list({ includeDeleted });
      return res.json(fields);
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const data = createCustomFieldSchema.parse(req.body);
      const field = await CustomFieldService.create({
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.status(201).json(field);
    } catch (err) {
      return next(err);
    }
  },

  async update(req, res, next) {
    try {
      const data = updateCustomFieldSchema.parse(req.body);
      const field = await CustomFieldService.update({
        id: req.params.id,
        ...data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(field);
    } catch (err) {
      return next(err);
    }
  },

  async softDelete(req, res, next) {
    try {
      const result = await CustomFieldService.softDelete({
        id: req.params.id,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async restore(req, res, next) {
    try {
      const result = await CustomFieldService.restore({
        id: req.params.id,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async getOptions(req, res, next) {
    try {
      const options = await CustomFieldService.getOptions(req.params.id);
      return res.json(options);
    } catch (err) {
      return next(err);
    }
  },

  async addOption(req, res, next) {
    try {
      const { label } = addOptionSchema.parse(req.body);
      const option = await CustomFieldService.addOption({
        id: req.params.id,
        label,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.status(201).json(option);
    } catch (err) {
      return next(err);
    }
  },

  async deprecateOption(req, res, next) {
    try {
      const result = await CustomFieldService.deprecateOption({
        fieldId: req.params.id,
        optionId: req.params.optionId,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async getProjectFields(req, res, next) {
    try {
      const fields = await CustomFieldService.getProjectFields(req.params.projectId);
      return res.json(fields);
    } catch (err) {
      return next(err);
    }
  },

  async attachToProject(req, res, next) {
    try {
      const data = attachToProjectSchema.parse(req.body);
      const result = await CustomFieldService.attachToProject({
        projectId: req.params.projectId,
        customFieldId: data.custom_field_id,
        is_required: data.is_required,
        is_enabled: data.is_enabled,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  },

  async updateProjectField(req, res, next) {
    try {
      const data = updateProjectFieldSchema.parse(req.body);
      const result = await CustomFieldService.updateProjectField({
        projectId: req.params.projectId,
        customFieldId: req.params.fieldId,
        data,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async detachFromProject(req, res, next) {
    try {
      const result = await CustomFieldService.detachFromProject({
        projectId: req.params.projectId,
        customFieldId: req.params.fieldId,
        actorId: req.user.id,
        actorRole: req.user.role,
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },
};
