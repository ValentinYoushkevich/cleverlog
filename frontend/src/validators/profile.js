import { z } from 'zod';

export const profileSchema = z.object({
  first_name: z.string().min(1, 'Имя обязательно'),
  last_name: z.string().min(1, 'Фамилия обязательна'),
  position: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Введите текущий пароль'),
    new_password: z
      .string()
      .min(8, 'Минимум 8 символов')
      .regex(/[A-Z]/, 'Нужна заглавная буква')
      .regex(/[a-z]/, 'Нужна строчная буква')
      .regex(/\d/, 'Нужна цифра')
      .regex(/[^a-zA-Z\d]/, 'Нужен спецсимвол'),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Пароли не совпадают',
    path: ['confirm_password'],
  });
