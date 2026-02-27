import { ZodError } from 'zod';
import logger from '../config/logger.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Некорректные данные',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (err?.status) {
    logger.warn('Request failed', {
      status: err.status,
      code: err.code,
      message: err.message,
    });

    return res.status(err.status).json({
      code: err.code || 'REQUEST_ERROR',
      message: err.message || 'Ошибка запроса',
    });
  }

  logger.error('Unhandled error', {
    message: err?.message,
  });

  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Внутренняя ошибка сервера',
  });
}
