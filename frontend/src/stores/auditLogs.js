import http from '@/api/http.js';
import { showError } from '@/utils/toast.js';
import { defineStore } from 'pinia';

export const useAuditLogsStore = defineStore('auditLogs', {
  state: () => ({
    logs: [],
    filterOptions: { event_types: [], entity_types: [] },
    loading: false,
    exporting: false,
    totalRecords: 0,
  }),

  actions: {
    async fetchFilterOptions() {
      try {
        const res = await http.get('/audit-logs/filter-options');
        const rawEvents = res.data?.event_types ?? [];
        this.filterOptions.event_types = Array.isArray(rawEvents)
          ? rawEvents
            .map((opt) => {
              if (opt === null) { return null; }
              if (typeof opt === 'string') { return { type: opt, name: opt }; }
              return {
                type: opt.type ?? opt.value ?? opt.event_type ?? '',
                name: opt.name ?? opt.label ?? opt.event_label ?? opt.type ?? opt.value ?? opt.event_type ?? '',
              };
            })
            .filter((x) => x?.type)
          : [];
        this.filterOptions.entity_types = Array.isArray(res.data?.entity_types)
          ? res.data.entity_types
          : [];
      } catch (err) {
        showError(err);
        throw err;
      }
    },

    async fetchList(params) {
      this.loading = true;
      try {
        const res = await http.get('/audit-logs', { params });
        this.logs = res.data?.data ?? res.data ?? [];
        this.totalRecords = res.data?.pagination?.total ?? this.logs.length;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async exportExcel(params) {
      this.exporting = true;
      try {
        const res = await http.get('/audit-logs/export', { params, responseType: 'blob' });
        return res.data;
      } catch (err) {
        showError(err);
        throw err;
      } finally {
        this.exporting = false;
      }
    },
  },
});
