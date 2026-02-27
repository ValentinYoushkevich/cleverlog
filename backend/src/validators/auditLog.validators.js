import { z } from 'zod';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const auditLogFiltersSchema = z.object({
  actor_id: z.uuid().optional(),
  event_type: z.string().optional(),
  entity_type: z.string().optional(),
  date_from: z.string().regex(DATE_REGEX, 'Формат: YYYY-MM-DD').optional(),
  date_to: z.string().regex(DATE_REGEX, 'Формат: YYYY-MM-DD').optional(),
  ip: z.string().optional(),
  result: z.enum(['success', 'failure']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
