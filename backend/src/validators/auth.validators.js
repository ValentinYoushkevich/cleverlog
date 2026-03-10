import { z } from 'zod';
import { PASSWORD_REGEX } from '../constants/auth.js';

const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .regex(PASSWORD_REGEX, 'Пароль должен содержать заглавную, строчную, цифру и спецсимвол');

export const registerSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordSchema,
});

export const updateProfileSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  position: z.string().min(1).nullable().optional(),
});
