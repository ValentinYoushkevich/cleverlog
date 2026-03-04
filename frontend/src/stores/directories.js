import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useDirectoriesStore = defineStore('directories', {
  state: () => ({
    departments: [],
    loadingDepartments: false,
  }),

  actions: {
    async fetchDepartments() {
      if (this.departments.length) return;
      this.loadingDepartments = true;
      try {
        const res = await http.get('/directories/departments');
        this.departments = res.data?.items ?? [];
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loadingDepartments = false;
      }
    },
  },
});

