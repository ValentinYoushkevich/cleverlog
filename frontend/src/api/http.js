import axios from 'axios';

const axiosInstance = axios.create({
  // baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3100/api',
  baseURL: 'http://localhost:3100/api',
  withCredentials: true, // для HttpOnly cookie
});

let logAxiosErrorFn = null;

async function ensureErrorLoggerLoaded() {
  if (logAxiosErrorFn) { return; }
  try {
    const mod = await import('@/utils/errorLogger.js');
    logAxiosErrorFn = mod.logAxiosError ?? null;
  } catch {
    logAxiosErrorFn = null;
  }
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    try {
      const config = error.config ?? {};
      const skipLogging = config.skipJsErrorLogging || config.url === '/log-js-error';
      if (!skipLogging) {
        await ensureErrorLoggerLoaded();
        if (typeof logAxiosErrorFn === 'function') {
          logAxiosErrorFn(error);
        }
      }
    } catch {
      // не даём логированию уронить основной запрос
    }

    const status = error.response?.status;
    const skipAuthRedirect = Boolean(error.config?.skipAuthRedirect);

    if (status === 401 && !skipAuthRedirect) {
      globalThis.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
