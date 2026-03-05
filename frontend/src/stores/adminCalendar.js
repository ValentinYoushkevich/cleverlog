import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useAdminCalendarStore = defineStore('adminCalendar', {
  actions: {
    async updateDay(date, day_type) {
      try {
        await http.patch(`/calendar/days/${date}`, { day_type });
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async updateNorm(year, month, norm_hours) {
      try {
        await http.put(`/calendar/norm/${year}/${month}`, { norm_hours });
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async getNorm(year, month) {
      try {
        const res = await http.get(`/calendar/norm/${year}/${month}`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
