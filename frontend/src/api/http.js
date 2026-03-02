import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3100/api',
  withCredentials: true, // для HttpOnly cookie
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const skipAuthRedirect = Boolean(error.config?.skipAuthRedirect);

    if (status === 401 && !skipAuthRedirect) {
      globalThis.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
