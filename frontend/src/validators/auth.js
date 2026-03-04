import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .regex(/[A-Z]/, 'Нужна заглавная буква')
  .regex(/[a-z]/, 'Нужна строчная буква')
  .regex(/\d/, 'Нужна цифра')
  .regex(/[^a-zA-Z\d]/, 'Нужен спецсимвол');

export const loginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export const registerSchema = z
  .object({
    email: z.string().email('Введите корректный email'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });
