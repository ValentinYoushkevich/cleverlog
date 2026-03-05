import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Введите корректный email'),
  first_name: z.string().min(1, 'Имя обязательно'),
  last_name: z.string().min(1, 'Фамилия обязательна'),
  position: z.string().optional(),
  role: z.enum(['admin', 'user']),
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  position: z.string().optional(),
  role: z.enum(['admin', 'user']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
