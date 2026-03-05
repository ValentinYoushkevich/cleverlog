import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [],
    loading: false,
  }),

  actions: {
    async fetchList(params) {
      this.loading = true;
      try {
        const res = await http.get('/users', { params });
        this.users = res.data?.data ?? res.data ?? [];
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchById(id) {
      try {
        const res = await http.get(`/users/${id}`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async create(data) {
      try {
        const res = await http.post('/users', data);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async update(id, data) {
      try {
        await http.patch(`/users/${id}`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async resendInvite(id) {
      try {
        await http.post(`/users/${id}/resend-invite`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async regenerateInviteLink(id) {
      try {
        const res = await http.post(`/users/${id}/regenerate-link`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async regenerateEmailInvite(id) {
      try {
        const res = await http.post(`/users/${id}/regenerate-email-invite`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
