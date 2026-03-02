import http from '@/api/http.js';
import dayjs from 'dayjs';
import { defineStore } from 'pinia';

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    currentYear: dayjs().year(),
    currentMonth: dayjs().month() + 1,
    normHours: 168,
    days: [],
    isClosed: false,
    loading: false,
  }),

  getters: {
    monthLabel: (state) => dayjs(`${state.currentYear}-${state.currentMonth}-01`).format('MMMM YYYY'),
  },

  actions: {
    async fetchMonth(year, month) {
      this.loading = true;
      try {
        const [calRes, statusRes] = await Promise.all([
          http.get(`/calendar/${year}/${month}`),
          http.get(`/month-closures/status/${year}/${month}`),
        ]);

        this.currentYear = year;
        this.currentMonth = month;
        this.normHours = calRes.data.norm_hours;
        this.days = calRes.data.days;
        this.isClosed = statusRes.data.closed;
      } finally {
        this.loading = false;
      }
    },

    async prevMonth() {
      const d = dayjs(`${this.currentYear}-${this.currentMonth}-01`).subtract(1, 'month');
      await this.fetchMonth(d.year(), d.month() + 1);
    },

    async nextMonth() {
      const d = dayjs(`${this.currentYear}-${this.currentMonth}-01`).add(1, 'month');
      await this.fetchMonth(d.year(), d.month() + 1);
    },

    async closeMonth(year, month) {
      await http.post('/month-closures', { year, month });
    },

    async openMonth(year, month) {
      await http.delete(`/month-closures/${year}/${month}`);
    },
  },
});
