import dayjs from 'dayjs';
import { CalendarRepository } from '../repositories/calendar.repository.js';
import { ReportRepository } from '../repositories/report.repository.js';
import { daysToHours } from '../utils/duration.js';
import { calcFact, calcUnloggedDays } from '../utils/reportHelpers.js';

const DEFAULT_NORM = 168;

function toDateKey(value) {
  return dayjs(value).format('YYYY-MM-DD');
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const groupKey = item[key];
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {});
}

function groupAndSum(arr, keyFn, valueKey) {
  const result = {};
  for (const item of arr) {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    result[key] = (result[key] || 0) + daysToHours(Number.parseFloat(item[valueKey]));
  }
  return result;
}

function sumDays(arr) {
  return daysToHours(arr.reduce((sum, item) => sum + Number.parseFloat(item.duration_days || 0), 0));
}

function isFullMonth(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) {
    return false;
  }

  const from = dayjs(dateFrom);
  const to = dayjs(dateTo);
  return from.date() === 1
    && to.date() === to.daysInMonth()
    && from.month() === to.month()
    && from.year() === to.year();
}

export const ReportService = {
  async userReport({
    userId,
    isAdmin,
    targetUserId,
    dateFrom,
    dateTo,
    projectId,
    type,
    taskNumber,
    comment,
  }) {
    // Для админа без фильтра по пользователю показываем отчёт по всем пользователям.
    const effectiveUserId = isAdmin ? targetUserId || null : userId;
    const workLogs = await ReportRepository.getWorkLogs({
      userId: effectiveUserId,
      projectId,
      dateFrom,
      dateTo,
    });
    const absences = await ReportRepository.getAbsences({
      userId: effectiveUserId,
      dateFrom,
      dateTo,
    });

    const filteredAbsences = type && type !== 'work'
      ? absences.filter((absence) => absence.type === type)
      : absences;
    const filteredWork = (!type || type === 'work') ? workLogs : [];

    const finalWork = filteredWork.filter((log) => {
      if (taskNumber && !log.task_number.toLowerCase().includes(taskNumber.toLowerCase())) {
        return false;
      }
      if (comment && !log.comment.toLowerCase().includes(comment.toLowerCase())) {
        return false;
      }
      return true;
    });

    const customValues = await ReportRepository.getCustomValues(finalWork.map((log) => log.id));
    const customByLog = groupBy(customValues, 'work_log_id');

    const rows = [
      ...finalWork.map((log) => ({
        user_name: `${log.last_name} ${log.first_name}`,
        type: 'work',
        date: toDateKey(log.date),
        project_name: log.project_name,
        task_number: log.task_number,
        duration_hours: daysToHours(log.duration_days),
        comment: log.comment,
        custom_fields: customByLog[log.id] || [],
      })),
      ...filteredAbsences.map((absence) => ({
        user_name: `${absence.last_name} ${absence.first_name}`,
        type: absence.type,
        date: toDateKey(absence.date),
        duration_hours: daysToHours(absence.duration_days),
        comment: absence.comment || '',
        project_name: null,
        task_number: null,
        custom_fields: [],
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const totalHours = rows.reduce((sum, row) => sum + row.duration_hours, 0);
    const byProject = groupAndSum(finalWork, 'project_name', 'duration_days');
    const byType = {
      work: sumDays(finalWork),
      vacation: sumDays(filteredAbsences.filter((absence) => absence.type === 'vacation')),
      sick_leave: sumDays(filteredAbsences.filter((absence) => absence.type === 'sick_leave')),
      day_off: sumDays(filteredAbsences.filter((absence) => absence.type === 'day_off')),
    };

    let normBlock = null;
    if (isFullMonth(dateFrom, dateTo)) {
      const [year, month] = dateFrom.split('-').map(Number);
      const normRow = await CalendarRepository.getNorm(year, month);
      const norm = normRow?.norm_hours ?? DEFAULT_NORM;
      const fact = calcFact(workLogs, absences);
      normBlock = {
        norm,
        fact,
        deviation: Math.round((fact - norm) * 100) / 100,
      };
    }

    return {
      rows,
      totals: {
        total_hours: totalHours,
        by_project: byProject,
        by_type: byType,
      },
      norm_block: normBlock,
    };
  },

  async projectReport({
    projectId,
    dateFrom,
    dateTo,
    userId,
    taskNumber,
    comment,
  }) {
    const workLogs = await ReportRepository.getWorkLogs({
      projectId,
      dateFrom,
      dateTo,
    });

    const filtered = workLogs.filter((log) => {
      if (userId && log.user_id !== userId) {
        return false;
      }
      if (taskNumber && !log.task_number.toLowerCase().includes(taskNumber.toLowerCase())) {
        return false;
      }
      if (comment && !log.comment.toLowerCase().includes(comment.toLowerCase())) {
        return false;
      }
      return true;
    });

    const customValues = await ReportRepository.getCustomValues(filtered.map((log) => log.id));
    const customByLog = groupBy(customValues, 'work_log_id');

    const rows = filtered.map((log) => ({
      user: `${log.last_name} ${log.first_name}`,
      position: log.position,
      date: toDateKey(log.date),
      project_name: log.project_name,
      task_number: log.task_number,
      duration_hours: daysToHours(log.duration_days),
      comment: log.comment,
      custom_fields: customByLog[log.id] || [],
    }));

    const totalHours = rows.reduce((sum, row) => sum + row.duration_hours, 0);
    const byUser = groupAndSum(filtered, (item) => `${item.last_name} ${item.first_name}`, 'duration_days');

    return {
      rows,
      totals: {
        total_hours: totalHours,
        by_user: byUser,
      },
    };
  },

  async monthlySummary({ year, month }) {
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');

    const users = await ReportRepository.getActiveUsers();
    const projects = await ReportRepository.getAllProjects();
    const workLogs = await ReportRepository.getWorkLogs({ dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ dateFrom, dateTo });

    const normRow = await CalendarRepository.getNorm(year, month);
    const norm = normRow?.norm_hours ?? DEFAULT_NORM;

    const rows = users.map((user) => {
      const userLogs = workLogs.filter((log) => log.user_id === user.id);
      const userAbsences = absences.filter((absence) => absence.user_id === user.id);

      const byProject = {};
      for (const project of projects) {
        const hours = daysToHours(
          userLogs
            .filter((log) => log.project_id === project.id)
            .reduce((sum, log) => sum + Number.parseFloat(log.duration_days), 0),
        );
        byProject[project.id] = hours;
      }

      const absenceHours = daysToHours(
        userAbsences.reduce((sum, absence) => sum + Number.parseFloat(absence.duration_days), 0),
      );
      const fact = calcFact(userLogs, userAbsences);

      return {
        user_id: user.id,
        user_name: `${user.last_name} ${user.first_name}`,
        by_project: byProject,
        absence_hours: absenceHours,
        fact_hours: fact,
        is_on_norm: Math.abs(fact - norm) < 0.01,
      };
    });

    const totals = {
      by_project: {},
      absence_hours: 0,
      fact_hours: 0,
    };

    for (const row of rows) {
      for (const [projectId, hours] of Object.entries(row.by_project)) {
        totals.by_project[projectId] = (totals.by_project[projectId] || 0) + hours;
      }
      totals.absence_hours += row.absence_hours;
      totals.fact_hours += row.fact_hours;
    }

    return {
      year,
      month,
      norm,
      projects,
      rows,
      totals,
    };
  },

  async unlogged({ year, month }) {
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');

    const users = await ReportRepository.getActiveUsers();
    const workLogs = await ReportRepository.getWorkLogs({ dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ dateFrom, dateTo });
    const overrides = await CalendarRepository.getOverrides(year, month);

    const result = [];
    for (const user of users) {
      const userLogs = workLogs.filter((log) => log.user_id === user.id);
      const userAbsences = absences.filter((absence) => absence.user_id === user.id);

      const loggedDates = new Set([
        ...userLogs.map((log) => toDateKey(log.date)),
        ...userAbsences.map((absence) => toDateKey(absence.date)),
      ]);

      const unloggedDays = calcUnloggedDays(year, month, loggedDates, overrides);
      if (unloggedDays.length > 0) {
        const fact = calcFact(userLogs, userAbsences);
        const lastLog = [...userLogs]
          .map((log) => ({ ...log, date: toDateKey(log.date) }))
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        result.push({
          user_id: user.id,
          user_name: `${user.last_name} ${user.first_name}`,
          unlogged_count: unloggedDays.length,
          unlogged_dates: unloggedDays.map((day) => day.date),
          fact_hours: fact,
          last_log_date: lastLog?.date || null,
        });
      }
    }

    return { count: result.length, users: result };
  },
};
