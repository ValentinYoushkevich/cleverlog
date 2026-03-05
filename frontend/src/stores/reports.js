import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useReportsStore = defineStore('reports', {
  state: () => ({
    monthlyRows: [],
    monthlyProjects: [],
    monthlyTotals: null,
    monthlyNorm: 168,
    monthlyLoading: false,
    monthlyExporting: false,
  }),

  actions: {
    async fetchUserReport(params) {
      try {
        const res = await http.get('/reports/user', { params });
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async exportUserReport(params) {
      try {
        const res = await http.get('/reports/user/export', {
          params,
          responseType: 'blob',
        });
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async fetchProjectReport(params) {
      try {
        const res = await http.get('/reports/project', { params });
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async exportProjectReport(params) {
      try {
        const res = await http.get('/reports/project/export', {
          params,
          responseType: 'blob',
        });
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async fetchMonthlySummary({ year, month }) {
      this.monthlyLoading = true;
      try {
        const res = await http.get('/reports/monthly-summary', { params: { year, month } });
        this.monthlyRows = res.data?.rows ?? [];
        this.monthlyProjects = res.data?.projects ?? [];
        this.monthlyTotals = res.data?.totals ?? null;
        this.monthlyNorm = res.data?.norm ?? 168;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.monthlyLoading = false;
      }
    },

    async exportMonthlySummary({ year, month }) {
      this.monthlyExporting = true;
      try {
        const res = await http.get('/reports/monthly-summary/export', {
          params: { year, month },
          responseType: 'blob',
        });
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.monthlyExporting = false;
      }
    },
  },
});
