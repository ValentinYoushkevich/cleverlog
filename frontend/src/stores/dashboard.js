import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    summary: null,
    loading: false,
    detailUsers: [],
    detailLoading: false,
  }),

  actions: {
    async fetchSummary({ year, month }) {
      this.loading = true;
      try {
        const res = await http.get('/dashboard', { params: { year, month } });
        this.summary = res.data;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchDetailList({ year, month, type }) {
      this.detailLoading = true;
      try {
        const res = await http.get('/dashboard/users', { params: { year, month, type } });
        this.detailUsers = res.data?.users ?? [];
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.detailLoading = false;
      }
    },
  },
});
