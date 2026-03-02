import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({
    globalLoading: false,
    pageTitle: 'CleverLog',
  }),

  actions: {
    setLoading(val) {
      this.globalLoading = val;
    },

    setPageTitle(title) {
      this.pageTitle = title;
    },
  },
});
