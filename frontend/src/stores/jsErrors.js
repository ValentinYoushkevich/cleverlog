import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useJsErrorsStore = defineStore('jsErrors', {
  state: () => ({
    list: [],
    loading: false,
    totalRecords: 0,
  }),

  actions: {
    async fetchList(params = {}) {
      this.loading = true;
      try {
        const res = await http.get('/js-errors', { params });
        this.list = res.data?.data ?? res.data ?? [];
        this.totalRecords = res.data?.pagination?.total ?? this.list.length;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },
  },
});
