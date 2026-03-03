import http from '@/api/http.js';
import { defineStore } from 'pinia';

export const useReportsStore = defineStore('reports', {
  actions: {
    async fetchUserReport(params) {
      const res = await http.get('/reports/user', { params });
      return res.data;
    },

    async exportUserReport(params) {
      const res = await http.get('/reports/user/export', {
        params,
        responseType: 'blob',
      });
      return res.data;
    },
  },
});

