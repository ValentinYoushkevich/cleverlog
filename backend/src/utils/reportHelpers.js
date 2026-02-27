import dayjs from 'dayjs';
import { getWorkingDays } from './calendar.js';
import { daysToHours } from './duration.js';

function toDateKey(value) {
  return dayjs(value).format('YYYY-MM-DD');
}

export function calcFact(workLogs = [], absences = []) {
  const logDays = workLogs.reduce((sum, log) => sum + Number.parseFloat(log.duration_days || 0), 0);
  const absenceDays = absences.reduce((sum, absence) => sum + Number.parseFloat(absence.duration_days || 0), 0);
  return Math.round(daysToHours(logDays + absenceDays) * 100) / 100;
}

export function calcUnloggedDays(year, month, loggedDates = new Set(), overrides = []) {
  const days = getWorkingDays(year, month, overrides);
  const today = dayjs().format('YYYY-MM-DD');

  return days.filter((day) => day.day_type === 'working'
    && day.date <= today
    && !loggedDates.has(toDateKey(day.date)));
}
