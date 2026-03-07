import http from '@/api/http.js';

export function setupErrorLogger() {
  globalThis.addEventListener('error', (event) => {
    sendError({
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      url: globalThis.location.href,
      userAgent: navigator.userAgent,
    });
  });

  globalThis.addEventListener('unhandledrejection', (event) => {
    sendError({
      message: event.reason?.message ?? String(event.reason),
      stack: event.reason?.stack,
      url: globalThis.location.href,
      userAgent: navigator.userAgent,
    });
  });
}

async function sendError(data) {
  try {
    await http.post('/log-js-error', data);
  } catch {
    // Молча игнорируем — не ронять приложение при ошибке логирования
  }
}
