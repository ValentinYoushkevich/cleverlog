import { z } from 'zod';

export const updateDaySchema = z.object({
  day_type: z.enum(['working', 'weekend', 'holiday']),
});

export const normSchema = z.object({
  norm_hours: z.number().positive('Норма должна быть положительной'),
});
