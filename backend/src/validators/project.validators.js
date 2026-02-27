import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'on_hold', 'closed']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Нет полей для обновления',
});
