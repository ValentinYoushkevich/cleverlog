import { z } from 'zod';

export const createCustomFieldSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  type: z.enum(['text', 'number', 'dropdown', 'checkbox']),
  options: z.array(z.string().min(1)).optional(),
});

export const updateCustomFieldSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['text', 'number', 'dropdown', 'checkbox']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Нет полей для обновления',
});

export const addOptionSchema = z.object({
  label: z.string().min(1, 'Значение обязательно'),
});

export const attachToProjectSchema = z.object({
  custom_field_id: z.uuid(),
  is_required: z.boolean().optional().default(false),
  is_enabled: z.boolean().optional().default(true),
});

export const updateProjectFieldSchema = z.object({
  is_required: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Нет полей для обновления',
});
