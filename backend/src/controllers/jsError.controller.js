import logger from '../config/logger.js';
import { JsErrorRepository } from '../repositories/jsError.repository.js';
import { jsErrorSchema } from '../validators/jsError.validators.js';

export const JsErrorController = {
  async log(req, res, _next) {
    try {
      const data = jsErrorSchema.parse(req.body);
      const payload = { ...data, ip: req.ip };

      logger.error('Frontend JS error', {
        ...payload,
        timestamp: new Date().toISOString(),
      });

      await JsErrorRepository.create(payload);

      return res.status(200).json({ received: true });
    } catch (error_) {
      logger.warn('Invalid JS error payload', {
        body: req.body,
        ip: req.ip,
        error: error_?.message,
      });

      return res.status(200).json({ received: false });
    }
  },

  async list(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      const result = await JsErrorRepository.findAll({ page, limit, url: url || undefined });
      return res.json({
        data: result.data,
        pagination: {
          total: result.total,
          page,
          limit,
          total_pages: Math.ceil(result.total / limit) || 1,
        },
      });
    } catch (err) {
      return next(err);
    }
  },
};
