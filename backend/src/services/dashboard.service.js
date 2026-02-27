import dayjs from 'dayjs';
import { CalendarRepository } from '../repositories/calendar.repository.js';
import { ReportRepository } from '../repositories/report.repository.js';
import { daysToHours } from '../utils/duration.js';
import { calcFact, calcUnloggedDays } from '../utils/reportHelpers.js';

const DEFAULT_NORM = 168;

function toDateKey(value) {
  return dayjs(value).format('YYYY-MM-DD');
}

function buildUserCard({ user, userLogs, userAbsences, year, month, norm, overrides }) {
  const fact = calcFact(userLogs, userAbsences);
  const deviation = Math.round((fact - norm) * 100) / 100;

  const projHours = {};
  for (const log of userLogs) {
    projHours[log.project_name] = (projHours[log.project_name] || 0) + Number.parseFloat(log.duration_days) * 8;
  }

  const top2 = Object.entries(projHours)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }));

  const loggedDates = new Set([
    ...userLogs.map((log) => toDateKey(log.date)),
    ...userAbsences.map((absence) => toDateKey(absence.date)),
  ]);
  const unloggedDays = calcUnloggedDays(year, month, loggedDates, overrides);
  const lastLog = [...userLogs]
    .map((log) => ({ ...log, date: toDateKey(log.date) }))
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    user_id: user.id,
    user_name: `${user.last_name} ${user.first_name}`,
    fact_hours: fact,
    absence_hours: daysToHours(userAbsences.reduce((sum, absence) => sum + Number.parseFloat(absence.duration_days), 0)),
    deviation,
    top2_projects: top2,
    unlogged_count: unloggedDays.length,
    unlogged_dates: unloggedDays.map((item) => item.date),
    last_log_date: lastLog?.date || null,
  };
}

export const DashboardService = {
  async getSummary({ year, month }) {
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');

    const users = await ReportRepository.getActiveUsers();
    const projects = await ReportRepository.getAllProjects();
    const workLogs = await ReportRepository.getWorkLogs({ dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ dateFrom, dateTo });
    const overrides = await CalendarRepository.getOverrides(year, month);
    const normRow = await CalendarRepository.getNorm(year, month);
    const norm = normRow?.norm_hours ?? DEFAULT_NORM;

    const hoursByProject = {};
    for (const project of projects) {
      const hours = daysToHours(
        workLogs
          .filter((log) => log.project_id === project.id)
          .reduce((sum, log) => sum + Number.parseFloat(log.duration_days), 0),
      );
      if (hours > 0) {
        hoursByProject[project.id] = { name: project.name, hours };
      }
    }

    const usersByProject = {};
    for (const project of projects) {
      const uniqueUsers = new Set(
        workLogs
          .filter((log) => log.project_id === project.id)
          .map((log) => log.user_id),
      );
      if (uniqueUsers.size > 0) {
        usersByProject[project.id] = { name: project.name, user_count: uniqueUsers.size };
      }
    }

    let undertimeCount = 0;
    let overtimeCount = 0;
    let unloggedCount = 0;

    for (const user of users) {
      const userLogs = workLogs.filter((log) => log.user_id === user.id);
      const userAbsences = absences.filter((absence) => absence.user_id === user.id);
      const card = buildUserCard({
        user,
        userLogs,
        userAbsences,
        year,
        month,
        norm,
        overrides,
      });

      if (card.deviation < 0) {
        undertimeCount += 1;
      }
      if (card.deviation > 0) {
        overtimeCount += 1;
      }
      if (card.unlogged_count > 0) {
        unloggedCount += 1;
      }
    }

    return {
      year,
      month,
      norm,
      charts: {
        hours_by_project: Object.values(hoursByProject),
        users_by_project: Object.values(usersByProject),
      },
      cards: {
        undertime_count: undertimeCount,
        overtime_count: overtimeCount,
        unlogged_count: unloggedCount,
      },
    };
  },

  async getDetailList({ year, month, type }) {
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');

    const users = await ReportRepository.getActiveUsers();
    const workLogs = await ReportRepository.getWorkLogs({ dateFrom, dateTo });
    const absences = await ReportRepository.getAbsences({ dateFrom, dateTo });
    const overrides = await CalendarRepository.getOverrides(year, month);
    const normRow = await CalendarRepository.getNorm(year, month);
    const norm = normRow?.norm_hours ?? DEFAULT_NORM;

    const result = [];
    for (const user of users) {
      const userLogs = workLogs.filter((log) => log.user_id === user.id);
      const userAbsences = absences.filter((absence) => absence.user_id === user.id);
      const card = buildUserCard({
        user,
        userLogs,
        userAbsences,
        year,
        month,
        norm,
        overrides,
      });

      if (type === 'undertime' && card.deviation < 0) {
        result.push(card);
      }
      if (type === 'overtime' && card.deviation > 0) {
        result.push(card);
      }
      if (type === 'unlogged' && card.unlogged_count > 0) {
        result.push(card);
      }
    }

    return { type, year, month, count: result.length, users: result };
  },
};
