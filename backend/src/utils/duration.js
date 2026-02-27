function durationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'INVALID_DURATION';
  return error;
}

export function parseDurationToDays(input) {
  if (!input || typeof input !== 'string') {
    throw durationError('Неверный формат длительности');
  }

  const str = input.trim().toLowerCase();
  const dMatch = /(\d+(?:\.\d+)?)\s*d/.exec(str);
  const hMatch = /(\d+(?:\.\d+)?)\s*h/.exec(str);
  const mMatch = /(\d+(?:\.\d+)?)\s*m/.exec(str);

  const days = dMatch ? Number.parseFloat(dMatch[1]) : 0;
  const hours = hMatch ? Number.parseFloat(hMatch[1]) : 0;
  const minutes = mMatch ? Number.parseFloat(mMatch[1]) : 0;

  if (!dMatch && !hMatch && !mMatch) {
    throw durationError('Не удалось распознать длительность');
  }

  const totalDays = days + hours / 8 + minutes / 480;
  if (totalDays <= 0) {
    throw durationError('Длительность должна быть больше 0');
  }

  return Math.round(totalDays * 10000) / 10000;
}

export function daysToHours(days) {
  return Math.round(days * 8 * 100) / 100;
}
