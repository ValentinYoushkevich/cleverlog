import logger from '../config/logger.js';
import { jsErrorSchema } from '../validators/jsError.validators.js';

export const JsErrorController = {
  async log(req, res, _next) {
    try {
      const data = jsErrorSchema.parse(req.body);

      logger.error('Frontend JS error', {
        ...data,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

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
};
