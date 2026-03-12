import { z } from 'zod';

import { ROLES } from '../constants/roles.js';

export const createUserSchema = z.object({
  email: z.string().email('Введите корректный email'),
  first_name: z.string().min(1, 'Имя обязательно'),
  last_name: z.string().min(1, 'Фамилия обязательна'),
  position: z.string().optional(),
  role: z.enum(Object.values(ROLES)),
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  position: z.string().optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
