import http from '@/api/http.js';
import router from '@/router/index.js';
import { defineStore } from 'pinia';

const loginRequest = (data) => http.post('/auth/login', data);
const logoutRequest = () => http.post('/auth/logout');
const meRequest = () => http.get('/auth/me', { skipAuthRedirect: true });

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isAdmin: (state) => state.user?.role === 'admin',
    userName: (state) => (state.user ? `${state.user.last_name} ${state.user.first_name}` : ''),
    userInitials: (state) => {
      if (!state.user) return '';
      return `${state.user.first_name?.[0] ?? ''}${state.user.last_name?.[0] ?? ''}`.toUpperCase();
    },
  },

  actions: {
    async fetchMe() {
      try {
        const res = await meRequest();
        this.user = res.data;
        return true;
      } catch {
        this.user = null;
        return false;
      }
    },

    async login(credentials) {
      this.loading = true;
      try {
        const res = await loginRequest(credentials);
        this.user = res.data.user;
        await router.push({ name: 'calendar' });
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await logoutRequest();
      } finally {
        this.user = null;
        await router.push({ name: 'login' });
      }
    },
  },
});
