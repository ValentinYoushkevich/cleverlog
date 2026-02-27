import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const createAbsenceSchema = z.object({
  type: z.enum(['vacation', 'sick_leave', 'day_off']),
  date_from: z.string().regex(DATE_REGEX, 'Формат: YYYY-MM-DD'),
  date_to: z.string().regex(DATE_REGEX, 'Формат: YYYY-MM-DD'),
  comment: z.string().optional(),
}).refine((data) => data.date_from <= data.date_to, {
  message: 'date_from должна быть <= date_to',
  path: ['date_from'],
});

export const updateAbsenceSchema = z.object({
  type: z.enum(['vacation', 'sick_leave', 'day_off']).optional(),
  date: z.string().regex(DATE_REGEX, 'Формат: YYYY-MM-DD').optional(),
  duration: z.string().min(1).optional(),
  comment: z.string().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Нет полей для обновления',
});

export const absenceFiltersSchema = z.object({
  user_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  date_from: z.string().regex(DATE_REGEX, 'Формат: YYYY-MM-DD').optional(),
  date_to: z.string().regex(DATE_REGEX, 'Формат: YYYY-MM-DD').optional(),
  type: z.enum(['vacation', 'sick_leave', 'day_off']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
