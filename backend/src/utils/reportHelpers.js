import dayjs from 'dayjs';
import { getDefaultDayType } from './calendar.js';
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
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const daysInMonth = start.daysInMonth();
  const overrideMap = Object.fromEntries(
    overrides.map((item) => [toDateKey(item.date), item.day_type]),
  );

  const result = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = start.date(day).format('YYYY-MM-DD');
    const dayType = overrideMap[date] ?? getDefaultDayType(date);
    if (dayType !== 'working') {
      continue;
    }
    if (!loggedDates.has(date)) {
      result.push({ date });
    }
  }

  return result;
}
