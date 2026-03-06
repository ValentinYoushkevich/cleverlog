import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useMonthClosuresStore = defineStore('monthClosures', {
  actions: {
    async close(year, month) {
      try {
        await http.post('/month-closures', { year, month });
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async open(year, month) {
      try {
        await http.delete(`/month-closures/${year}/${month}`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async fetchStatus(year, month) {
      try {
        const res = await http.get(`/month-closures/status/${year}/${month}`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
