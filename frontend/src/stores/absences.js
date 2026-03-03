import http from '@/api/http.js';
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
      } finally {
        this.loading = false;
      }
    },

    async create(data) {
      const res = await http.post('/absences', data);
      return res.data;
    },

    async update(id, data) {
      const res = await http.patch(`/absences/${id}`, data);
      return res.data;
    },

    async remove(id) {
      await http.delete(`/absences/${id}`);
    },

    async fetchUsers() {
      this.usersLoading = true;
      try {
        const res = await http.get('/users', { params: { status: 'active' } });
        this.users = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      } finally {
        this.usersLoading = false;
      }
    },
  },
});
