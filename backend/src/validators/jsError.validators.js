import { z } from 'zod';

const userSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
}).optional();

const httpRequestSchema = z.object({
  url: z.string().optional(),
  method: z.string().optional(),
  body: z.unknown().optional(),
}).optional();

const httpResponseSchema = z.object({
  status: z.number().int().optional(),
  body: z.unknown().optional(),
}).optional();

export const jsErrorSchema = z.object({
  message: z.string().min(1),
  source: z.string().optional(),
  lineno: z.number().int().optional(),
  colno: z.number().int().optional(),
  stack: z.string().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  user: userSchema,
  request: httpRequestSchema,
  response: httpResponseSchema,
});
