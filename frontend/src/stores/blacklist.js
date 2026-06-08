import { defineStore } from 'pinia';
import * as blacklistApi from '../api/blacklist';

export const useBlacklistStore = defineStore('blacklist', {
  state: () => ({
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    stats: null,
    auditLogs: [],
    auditLogsTotal: 0,
    config: null,
  }),
  actions: {
    async fetchList(params) {
      this.loading = true;
      try {
        const data = await blacklistApi.fetchBlacklist({
          page: this.page,
          pageSize: this.pageSize,
          ...params,
        });
        this.list = data.list;
        this.total = data.total;
        return data;
      } finally {
        this.loading = false;
      }
    },
    async fetchStats() {
      try {
        this.stats = await blacklistApi.fetchBlacklistStats();
        return this.stats;
      } catch (error) {
        console.error('Failed to fetch blacklist stats', error);
      }
    },
    async fetchAuditLogs(params) {
      try {
        const data = await blacklistApi.fetchAuditLogs(params);
        this.auditLogs = data.list;
        this.auditLogsTotal = data.total;
        return data;
      } catch (error) {
        console.error('Failed to fetch audit logs', error);
      }
    },
    async fetchConfig() {
      try {
        this.config = await blacklistApi.fetchBlacklistConfig();
        return this.config;
      } catch (error) {
        console.error('Failed to fetch blacklist config', error);
      }
    },
    async updateConfig(data) {
      this.config = await blacklistApi.updateBlacklistConfig(data);
      return this.config;
    },
    async addBlacklist(data) {
      const result = await blacklistApi.addBlacklist(data);
      await this.fetchList();
      await this.fetchStats();
      return result;
    },
    async batchAddBlacklist(data) {
      const result = await blacklistApi.batchAddBlacklist(data);
      await this.fetchList();
      await this.fetchStats();
      return result;
    },
    async importCSV(data) {
      const result = await blacklistApi.importBlacklistCSV(data);
      await this.fetchList();
      await this.fetchStats();
      return result;
    },
    async approveBlacklist(id, data) {
      const result = await blacklistApi.approveBlacklist(id, data);
      await this.fetchList();
      await this.fetchStats();
      return result;
    },
    async releaseBlacklist(id, data) {
      const result = await blacklistApi.releaseBlacklist(id, data);
      await this.fetchList();
      await this.fetchStats();
      return result;
    },
    async batchReleaseBlacklist(data) {
      const result = await blacklistApi.batchReleaseBlacklist(data);
      await this.fetchList();
      await this.fetchStats();
      return result;
    },
    async deleteBlacklist(id) {
      await blacklistApi.deleteBlacklist(id);
      await this.fetchList();
      await this.fetchStats();
    },
    exportBlacklist(params) {
      blacklistApi.exportBlacklist(params);
    },
  },
});
