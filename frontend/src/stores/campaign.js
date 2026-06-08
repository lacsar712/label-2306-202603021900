import { defineStore } from 'pinia';
import campaignApi from '../api/campaigns';

export const useCampaignStore = defineStore('campaign', {
  state: () => ({
    campaigns: [],
    activeCampaigns: [],
    meta: { channels: [], tags: [] },
    loading: false,
  }),
  actions: {
    async fetchCampaigns(params) {
      this.loading = true;
      try {
        this.campaigns = await campaignApi.list(params);
      } finally {
        this.loading = false;
      }
    },
    async fetchActiveCampaigns() {
      try {
        this.activeCampaigns = await campaignApi.getActive();
      } catch (e) {
        console.error(e);
      }
    },
    async fetchMeta() {
      try {
        this.meta = await campaignApi.getMeta();
      } catch (e) {
        console.error(e);
      }
    },
    async createCampaign(data) {
      const result = await campaignApi.create(data);
      await this.fetchCampaigns();
      return result;
    },
    async updateCampaign(id, data) {
      const result = await campaignApi.update(id, data);
      await this.fetchCampaigns();
      return result;
    },
    async updateStatus(id, status) {
      const result = await campaignApi.updateStatus(id, status);
      await this.fetchCampaigns();
      await this.fetchActiveCampaigns();
      return result;
    },
    async toggleEnabled(id, enabled) {
      const result = await campaignApi.toggleEnabled(id, enabled);
      await this.fetchCampaigns();
      await this.fetchActiveCampaigns();
      return result;
    },
    async deleteCampaign(id) {
      await campaignApi.remove(id);
      await this.fetchCampaigns();
    },
  },
});
