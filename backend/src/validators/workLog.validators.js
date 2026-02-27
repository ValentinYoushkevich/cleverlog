import { z } from 'zod';

export const createWorkLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат даты: YYYY-MM-DD'),
  project_id: z.uuid(),
  duration: z.string().min(1, 'Длительность обязательна'),
  comment: z.string().min(1, 'Комментарий обязателен'),
  task_number: z.string().min(1, 'Task Number обязателен'),
  custom_fields: z.record(z.uuid(), z.any()).optional(),
});

export const updateWorkLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  project_id: z.uuid().optional(),
  duration: z.string().min(1).optional(),
  comment: z.string().min(1).optional(),
  task_number: z.string().min(1).optional(),
  custom_fields: z.record(z.uuid(), z.any()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Нет полей для обновления',
});

export const workLogFiltersSchema = z.object({
  user_id: z.uuid().optional(),
  project_id: z.uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  task_number: z.string().optional(),
  comment: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
