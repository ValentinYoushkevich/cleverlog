import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useCustomFieldsStore = defineStore('customFields', {
  state: () => ({
    fields: [],
    loading: false,
  }),

  actions: {
    async fetchList(params = {}) {
      this.loading = true;
      try {
        const res = await http.get('/custom-fields', { params });
        this.fields = res.data ?? [];
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async create(data) {
      try {
        await http.post('/custom-fields', data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async update(id, data) {
      try {
        await http.patch(`/custom-fields/${id}`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async softDelete(id) {
      try {
        await http.delete(`/custom-fields/${id}`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async restore(id) {
      try {
        await http.post(`/custom-fields/${id}/restore`);
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

    async getOptions(id) {
      try {
        const res = await http.get(`/custom-fields/${id}/options`);
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async addOption(id, data) {
      try {
        await http.post(`/custom-fields/${id}/options`, data);
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async deprecateOption(id, optionId) {
      try {
        await http.delete(`/custom-fields/${id}/options/${optionId}`);
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
