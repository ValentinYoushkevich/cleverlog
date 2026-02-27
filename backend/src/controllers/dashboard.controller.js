import { DashboardService } from '../services/dashboard.service.js';

function getYearMonth(query) {
  const now = new Date();
  const year = Number(query.year) || now.getFullYear();
  const month = Number(query.month) || (now.getMonth() + 1);
  return { year, month };
}

export const DashboardController = {
  async getSummary(req, res, next) {
    try {
      const { year, month } = getYearMonth(req.query);
      const result = await DashboardService.getSummary({ year, month });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async getDetailList(req, res, next) {
    try {
      const { year, month } = getYearMonth(req.query);
      const { type } = req.query;

      if (!['undertime', 'overtime', 'unlogged'].includes(type)) {
        return res.status(400).json({
          code: 'INVALID_TYPE',
          message: 'type должен быть: undertime | overtime | unlogged',
        });
      }

      const result = await DashboardService.getDetailList({ year, month, type });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },
};
