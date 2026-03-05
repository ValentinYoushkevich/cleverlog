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

    async createProject(data) {
      try {
        await http.post('/projects', data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async updateProject(id, data) {
      try {
        await http.patch(`/projects/${id}`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async getProjectFields(projectId) {
      try {
        const res = await http.get(`/projects/${projectId}/custom-fields`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async attachFieldToProject(projectId, data) {
      try {
        await http.post(`/projects/${projectId}/custom-fields`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async updateProjectField(projectId, fieldId, data) {
      try {
        await http.patch(`/projects/${projectId}/custom-fields/${fieldId}`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async detachField(projectId, fieldId) {
      try {
        await http.delete(`/projects/${projectId}/custom-fields/${fieldId}`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
