import dayjs from 'dayjs';
import db from '../config/knex.js';
import { WorkLogRepository } from '../repositories/workLog.repository.js';

export async function checkMonthClosed(req, res, next) {
  try {
    let date = req.body.date || req.workLogDate;

    if (!date && req.params.id) {
      const log = await WorkLogRepository.findById(req.params.id);
      if (log) {
        date = log.date;
      }
    }

    if (!date) {
      return next();
    }

    const parsedDate = dayjs(date);
    if (!parsedDate.isValid()) {
      return next();
    }

    const year = parsedDate.year();
    const month = parsedDate.month() + 1;
    const closure = await db('month_closures').where({ year, month }).first();

    if (closure) {
      return res.status(403).json({
        code: 'MONTH_CLOSED',
        message: 'Месяц закрыт. Редактирование запрещено',
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
}
