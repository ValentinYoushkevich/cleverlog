import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useReportsStore = defineStore('reports', {
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
  },
});

