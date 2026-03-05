import { ExportService } from '../services/export.service.js';
import { ReportService } from '../services/report.service.js';

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

export const ReportController = {
  async userReport(req, res, next) {
    try {
      const result = await ReportService.userReport({
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        targetUserId: req.query.user_id,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
        projectId: req.query.project_id,
        type: req.query.type,
        taskNumber: req.query.task_number,
        comment: req.query.comment,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async exportUser(req, res, next) {
    try {
      const workbook = await ExportService.exportUser({
        userId: req.user.id,
        isAdmin: req.user.role === 'admin',
        targetUserId: req.query.user_id,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
      });
      await sendWorkbook(res, workbook, 'report_user');
      return undefined;
    } catch (err) {
      return next(err);
    }
  },

  async projectReport(req, res, next) {
    try {
      const result = await ReportService.projectReport({
        projectId: req.query.project_id,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
        userId: req.query.user_id,
        taskNumber: req.query.task_number,
        comment: req.query.comment,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async exportProject(req, res, next) {
    try {
      const workbook = await ExportService.exportProject({
        projectId: req.query.project_id,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
      });
      await sendWorkbook(res, workbook, 'report_project');
      return undefined;
    } catch (err) {
      return next(err);
    }
  },

  async monthlySummary(req, res, next) {
    try {
      const result = await ReportService.monthlySummary({
        year: Number(req.query.year),
        month: Number(req.query.month),
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async exportMonthlySummary(req, res, next) {
    try {
      const workbook = await ExportService.exportMonthlySummary({
        year: Number(req.query.year),
        month: Number(req.query.month),
      });
      await sendWorkbook(res, workbook, 'report_monthly_summary');
      return undefined;
    } catch (err) {
      return next(err);
    }
  },

  async unlogged(req, res, next) {
    try {
      const result = await ReportService.unlogged({
        year: Number(req.query.year),
        month: Number(req.query.month),
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },

  async exportUnlogged(req, res, next) {
    try {
      const workbook = await ExportService.exportUnlogged({
        year: Number(req.query.year),
        month: Number(req.query.month),
      });
      await sendWorkbook(res, workbook, 'report_unlogged');
      return undefined;
    } catch (err) {
      return next(err);
    }
  },
};
