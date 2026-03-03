import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [],
    loading: false,
  }),

  getters: {
    activeProjects: (state) => state.projects.filter((p) => p.status === 'active'),
  },

  actions: {
    async fetchProjects(params) {
      this.loading = true;
      try {
        const res = await http.get('/projects', { params });
        this.projects = res.data;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },
  },
});
