import { defineStore } from 'pinia';
import {
  fetchDashboardConfig, saveDashboardConfig, resetDashboard,
  fetchDefaultTemplate, saveDefaultTemplate,
} from '../api/dashboard';

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    config: null,
    components: [],
    loading: false,
    filters: {
      channelId: null,
    },
    componentData: {},
  }),
  actions: {
    async loadConfig() {
      this.loading = true;
      try {
        const data = await fetchDashboardConfig();
        this.config = data;
        this.components = data.components || [];
      } finally {
        this.loading = false;
      }
    },
    async saveConfig(components) {
      const data = await saveDashboardConfig({ components });
      this.config = data;
      this.components = data.components || [];
      return data;
    },
    async reset() {
      const data = await resetDashboard();
      this.config = data;
      this.components = data.components || [];
      return data;
    },
    async loadDefaultTemplate() {
      return await fetchDefaultTemplate();
    },
    async setDefaultTemplate(components) {
      return await saveDefaultTemplate({ components });
    },
    setFilter(key, value) {
      this.filters[key] = value;
    },
    clearFilters() {
      this.filters = { channelId: null };
    },
    setComponentData(key, data) {
      this.componentData[key] = data;
    },
  },
});
