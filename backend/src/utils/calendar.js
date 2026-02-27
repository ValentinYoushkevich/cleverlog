import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';

dayjs.extend(isoWeek);

export function getDefaultDayType(date) {
  const dow = dayjs(date).isoWeekday();
  return dow >= 6 ? 'weekend' : 'working';
}

export function getWorkingDays(year, month, overrides = []) {
  const overrideMap = Object.fromEntries(
    overrides.map((override) => [dayjs(override.date).format('YYYY-MM-DD'), override.day_type]),
  );
  const days = [];
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const total = start.daysInMonth();

  for (let d = 1; d <= total; d += 1) {
    const date = start.date(d);
    const dateStr = date.format('YYYY-MM-DD');
    const type = overrideMap[dateStr] ?? getDefaultDayType(dateStr);
    days.push({ date: dateStr, day_type: type });
  }

  return days;
}

/**
 * Возвращает последний рабочий день месяца с учетом calendar_days overrides.
 */
export async function getLastWorkingDay(year, month, dbInstance) {
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('YYYY-MM-DD');
  const end = dayjs(start).endOf('month').format('YYYY-MM-DD');

  const overrides = await dbInstance('calendar_days')
    .whereBetween('date', [start, end])
    .select('date', 'day_type');

  const days = getWorkingDays(year, month, overrides);
  const workingDays = days.filter((day) => day.day_type === 'working');
  return workingDays.length ? workingDays.at(-1).date : null;
}

export async function isWorkingDay(date, db) {
  const override = await db('calendar_days').where({ date }).first();
  if (override) {
    return override.day_type === 'working';
  }

  return getDefaultDayType(date) === 'working';
}
