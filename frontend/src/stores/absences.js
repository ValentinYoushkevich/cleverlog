import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useAbsencesStore = defineStore('absences', {
  state: () => ({
    list: [],
    loading: false,
    users: [],
    usersLoading: false,
  }),

  actions: {
    async fetchList(params = {}) {
      this.loading = true;
      try {
        const res = await http.get('/absences', { params });
        this.list = res.data?.data ?? res.data ?? [];
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async create(data) {
      try {
        const res = await http.post('/absences', data);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async update(id, data) {
      try {
        const res = await http.patch(`/absences/${id}`, data);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async remove(id) {
      try {
        await http.delete(`/absences/${id}`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async fetchUsers() {
      this.usersLoading = true;
      try {
        const res = await http.get('/users', { params: { status: 'active' } });
        this.users = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.usersLoading = false;
      }
    },
  },
});
