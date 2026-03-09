import http from '@/api/http.js';

let getCurrentUser = null;

export async function setupErrorLogger() {
  // Делаем отложенный импорт, чтобы не создавать циклических зависимостей
  try {
    const { useAuthStore } = await import('@/stores/auth.js');
    const authStore = useAuthStore();
    getCurrentUser = () => authStore.user;
  } catch {
    getCurrentUser = () => null;
  }

  globalThis.addEventListener('error', (event) => {
    const payload = buildBasePayload({
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
    sendError(payload);
  });

  globalThis.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logAxiosError(reason);
  });
}

export function logAxiosError(error) {
  const isAxiosError = !!error && typeof error === 'object' && ('isAxiosError' in error || 'config' in error);

  const base = buildBasePayload({
    message: error?.message ?? String(error),
    stack: error?.stack,
  });

  if (isAxiosError && error.config) {
    const request = {
      url: error.config.url,
      method: error.config.method,
      body: safelyParseBody(error.config.data),
    };

    const response = error.response
      ? {
        status: error.response.status,
        body: error.response.data,
      }
      : undefined;

    base.request = request;
    if (response) {
      base.response = response;
    }
  }

  sendError(base);
}

function buildBasePayload(data) {
  const user = getCurrentUser ? getCurrentUser() : null;
  return {
    ...data,
    url: globalThis.location.href,
    userAgent: navigator.userAgent,
    user: user
      ? {
        id: user.id,
        email: user.email,
        name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || user.id,
      }
      : undefined,
  };
}

function safelyParseBody(body) {
  if (!body) { return undefined; }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

async function sendError(data) {
  try {
    await http.post('/log-js-error', data, { skipAuthRedirect: true });
  } catch {
    // Молча игнорируем — не ронять приложение при ошибке логирования
  }
}
