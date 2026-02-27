import { z } from 'zod';

export const createUserSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.email(),
  role: z.enum(['user', 'admin']),
  position: z.string().optional(),
  hire_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  role: z.enum(['user', 'admin']).optional(),
  position: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  hire_date: z.string().optional(),
  dismissal_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Нет полей для обновления',
});
