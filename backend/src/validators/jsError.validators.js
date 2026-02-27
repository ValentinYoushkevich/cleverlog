import { z } from 'zod';

export const jsErrorSchema = z.object({
  message: z.string().min(1),
  source: z.string().optional(),
  lineno: z.number().int().optional(),
  colno: z.number().int().optional(),
  stack: z.string().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
});
