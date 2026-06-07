import { defineStore } from 'pinia';
import {
  fetchChannels,
  fetchFlatChannels,
  fetchChannel,
  createChannel,
  updateChannel,
  deleteChannel,
  mergeChannels,
  fetchChannelStatsOverview,
  fetchChannelStatsTrend,
  fetchChannelStatsRetention,
  fetchChannelStatsSankey,
  fetchTopChannels,
  fetchChannelAlerts,
} from '../api/channels';

export const useChannelStore = defineStore('channel', {
  state: () => ({
    channels: [],
    flatChannels: [],
    statsOverview: [],
    statsTrend: { dates: [], trends: [] },
    statsRetention: [],
    statsSankey: { nodes: [], links: [] },
    topChannels: [],
    alerts: [],
    loading: false,
  }),
  actions: {
    async fetchChannels(params) {
      this.loading = true;
      try {
        this.channels = await fetchChannels(params);
      } finally {
        this.loading = false;
      }
    },
    async fetchFlatChannels() {
      try {
        this.flatChannels = await fetchFlatChannels();
      } catch (error) {
        console.error('Failed to fetch flat channels', error);
      }
    },
    async fetchChannel(id) {
      return await fetchChannel(id);
    },
    async createChannel(data) {
      const result = await createChannel(data);
      await this.fetchChannels();
      await this.fetchFlatChannels();
      return result;
    },
    async updateChannel(id, data) {
      const result = await updateChannel(id, data);
      await this.fetchChannels();
      await this.fetchFlatChannels();
      return result;
    },
    async deleteChannel(id) {
      await deleteChannel(id);
      await this.fetchChannels();
      await this.fetchFlatChannels();
    },
    async mergeChannels(sourceIds, targetId) {
      const result = await mergeChannels(sourceIds, targetId);
      await this.fetchChannels();
      await this.fetchFlatChannels();
      await this.fetchStatsOverview();
      return result;
    },
    async fetchStatsOverview() {
      try {
        this.statsOverview = await fetchChannelStatsOverview();
      } catch (error) {
        console.error('Failed to fetch channel stats overview', error);
      }
    },
    async fetchStatsTrend(days = 30) {
      try {
        this.statsTrend = await fetchChannelStatsTrend(days);
      } catch (error) {
        console.error('Failed to fetch channel stats trend', error);
      }
    },
    async fetchStatsRetention() {
      try {
        this.statsRetention = await fetchChannelStatsRetention();
      } catch (error) {
        console.error('Failed to fetch channel retention', error);
      }
    },
    async fetchStatsSankey() {
      try {
        this.statsSankey = await fetchChannelStatsSankey();
      } catch (error) {
        console.error('Failed to fetch channel sankey', error);
      }
    },
    async fetchTopChannels(limit = 5) {
      try {
        this.topChannels = await fetchTopChannels(limit);
      } catch (error) {
        console.error('Failed to fetch top channels', error);
      }
    },
    async fetchAlerts() {
      try {
        this.alerts = await fetchChannelAlerts();
      } catch (error) {
        console.error('Failed to fetch channel alerts', error);
      }
    },
  },
});
