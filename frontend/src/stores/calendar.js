import http from '@/api/http.js';
import dayjs from 'dayjs';
import { defineStore } from 'pinia';

const getMonthRequest = (year, month) => http.get(`/calendar/${year}/${month}`);
const getMonthStatusRequest = (year, month) => http.get(`/month-closures/status/${year}/${month}`);
const closeMonthRequest = (year, month) => http.post('/month-closures', { year, month });
const openMonthRequest = (year, month) => http.delete(`/month-closures/${year}/${month}`);

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
          getMonthRequest(year, month),
          getMonthStatusRequest(year, month),
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
      await closeMonthRequest(year, month);
    },

    async openMonth(year, month) {
      await openMonthRequest(year, month);
    },
  },
});
