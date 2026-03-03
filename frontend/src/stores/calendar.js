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
    workLogs: [],
    absences: [],
    dataLoading: false,
  }),

  getters: {
    monthLabel: (state) => dayjs(`${state.currentYear}-${state.currentMonth}-01`).format('MMMM YYYY'),

    dayMap: (state) => {
      const map = {};
      for (const log of state.workLogs) {
        const dateKey = dayjs(log.date).format('YYYY-MM-DD');
        if (!map[dateKey]) map[dateKey] = { workLogs: [], absences: [], totalHours: 0 };
        map[dateKey].workLogs.push(log);
        map[dateKey].totalHours += log.duration_hours ?? 0;
      }
      for (const abs of state.absences) {
        const dateKey = dayjs(abs.date).format('YYYY-MM-DD');
        if (!map[dateKey]) map[dateKey] = { workLogs: [], absences: [], totalHours: 0 };
        map[dateKey].absences.push(abs);
        map[dateKey].totalHours += abs.duration_hours ?? 0;
      }
      return map;
    },

    factHours: (state) =>
      [...state.workLogs, ...state.absences].reduce(
        (sum, item) => sum + (item.duration_hours ?? 0),
        0,
      ),
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

    async fetchMonthData(year, month) {
      this.dataLoading = true;
      const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const dateTo = dayjs(dateFrom).endOf('month').format('YYYY-MM-DD');
      try {
        const [wlRes, absRes] = await Promise.all([
          http.get('/work-logs', {
            params: { date_from: dateFrom, date_to: dateTo, limit: 200 },
          }),
          http.get('/absences', {
            params: { date_from: dateFrom, date_to: dateTo, limit: 200 },
          }),
        ]);
        this.workLogs = wlRes.data?.data ?? wlRes.data ?? [];
        this.absences = absRes.data?.data ?? absRes.data ?? [];
      } finally {
        this.dataLoading = false;
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
