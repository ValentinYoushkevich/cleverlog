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

export async function isWorkingDay(date, db) {
  const override = await db('calendar_days').where({ date }).first();
  if (override) {
    return override.day_type === 'working';
  }

  return getDefaultDayType(date) === 'working';
}
