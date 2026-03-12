import { z } from 'zod';
import { ROLES } from '../constants/roles.js';

export const createUserSchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    // Email может быть пустым при invite_mode = 'link'
    email: z.string().optional(),
    role: z.enum([ROLES.USER, ROLES.ADMIN, ROLES.MANAGER]),
    position: z.string().optional(),
    department: z.string().min(1, 'Отдел обязателен'),
    hire_date: z.string().optional(),
    tags: z.array(z.string()).optional(),
    invite_mode: z.enum(['email', 'link']).optional(),
  })
  .superRefine((data, ctx) => {
    const mode = data.invite_mode ?? 'email';

    if (mode === 'email') {
      if (!data.email?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Email обязателен для отправки инвайта',
          path: ['email'],
        });
        return;
      }

      const emailCheck = z.string().email().safeParse(data.email);
      if (!emailCheck.success) {
        ctx.addIssue({
          code: 'custom',
          message: 'Введите корректный email',
          path: ['email'],
        });
      }
    }
  });

export const updateUserSchema = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    role: z.enum([ROLES.USER, ROLES.ADMIN, ROLES.MANAGER]).optional(),
    position: z.string().optional(),
    department: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    hire_date: z.string().optional(),
    dismissal_date: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Нет полей для обновления',
  });
