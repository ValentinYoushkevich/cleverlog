import http from '@/api/http.js';
import { defineStore } from 'pinia';

const listProjectsRequest = (params) => http.get('/projects', { params });

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
        const res = await listProjectsRequest(params);
        this.projects = res.data;
      } finally {
        this.loading = false;
      }
    },
  },
});
