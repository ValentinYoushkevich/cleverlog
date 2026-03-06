import http from '@/api/http.js';
import router from '@/router/index.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

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
      if (!state.user) { return ''; }
      return `${state.user.first_name?.[0] ?? ''}${state.user.last_name?.[0] ?? ''}`.toUpperCase();
    },
  },

  actions: {
    async fetchMe() {
      try {
        const res = await http.get('/auth/me', { skipAuthRedirect: true });
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
        const res = await http.post('/auth/login', credentials, { skipAuthRedirect: true });
        this.user = res.data.user;
        await router.push({ name: 'calendar' });
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await http.post('/auth/logout');
      } catch (err) {
        showError(err);
        // Выход выполняем в любом случае
      } finally {
        this.user = null;
        await router.push({ name: 'login' });
      }
    },

    async updateProfile(data) {
      try {
        const res = await http.patch('/auth/profile', data);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async changePassword(data) {
      try {
        const res = await http.post('/auth/change-password', data);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
