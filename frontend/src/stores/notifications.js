import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    globalEnabled: true,
    loading: false,
  }),

  actions: {
    async fetchSettings() {
      this.loading = true;
      try {
        const res = await http.get('/notifications/settings');
        this.globalEnabled = res.data?.global_enabled ?? true;
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async updateGlobal(enabled) {
      try {
        await http.patch('/notifications/settings', { enabled });
        this.globalEnabled = enabled;
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async updateUser(userId, enabled) {
      try {
        await http.patch(`/notifications/users/${userId}`, { enabled });
      } catch (err) {
        showError(err);
        throw err;
      }
    },
  },
});
