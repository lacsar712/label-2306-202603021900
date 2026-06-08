import { defineStore } from 'pinia';
import * as referralApi from '../api/referrals';

export const useReferralStore = defineStore('referral', {
  state: () => ({
    overview: null,
    config: null,
    binds: [],
    codes: [],
    rewardRules: [],
    anomalies: [],
    leaderboard: [],
    treeData: null,
    stats: null,
    loading: false,
  }),
  actions: {
    async fetchOverview() {
      this.overview = await referralApi.fetchReferralOverview();
      return this.overview;
    },

    async fetchConfig() {
      this.config = await referralApi.fetchReferralConfig();
      return this.config;
    },

    async updateConfig(data) {
      this.config = await referralApi.updateReferralConfig(data);
      return this.config;
    },

    async searchReferrer(params) {
      return await referralApi.searchReferrer(params);
    },

    async bindReferral(data) {
      const result = await referralApi.bindReferral(data);
      await this.fetchBinds();
      return result;
    },

    async bindByCode(data) {
      const result = await referralApi.bindByCode(data);
      await this.fetchBinds();
      return result;
    },

    async bindByPhone(data) {
      const result = await referralApi.bindByPhone(data);
      await this.fetchBinds();
      return result;
    },

    async unbindReferral(refereeId) {
      await referralApi.unbindReferral(refereeId);
      await this.fetchBinds();
    },

    async fetchTree(memberId, depth) {
      this.loading = true;
      try {
        this.treeData = await referralApi.fetchReferralTree(memberId, depth);
        return this.treeData;
      } finally {
        this.loading = false;
      }
    },

    async fetchBinds(params) {
      this.loading = true;
      try {
        this.binds = await referralApi.fetchReferralBinds(params);
        return this.binds;
      } finally {
        this.loading = false;
      }
    },

    async fetchStats(memberId) {
      this.stats = await referralApi.fetchReferralStats(memberId);
      return this.stats;
    },

    async fetchLeaderboard(params) {
      this.loading = true;
      try {
        this.leaderboard = await referralApi.fetchLeaderboard(params);
        return this.leaderboard;
      } finally {
        this.loading = false;
      }
    },

    async fetchCodes(params) {
      this.loading = true;
      try {
        this.codes = await referralApi.fetchReferralCodes(params);
        return this.codes;
      } finally {
        this.loading = false;
      }
    },

    async createCode(data) {
      const result = await referralApi.createReferralCode(data);
      await this.fetchCodes();
      return result;
    },

    async updateCode(id, data) {
      const result = await referralApi.updateReferralCode(id, data);
      await this.fetchCodes();
      return result;
    },

    async deleteCode(id) {
      await referralApi.deleteReferralCode(id);
      await this.fetchCodes();
    },

    async ensurePersonalCode(memberId) {
      return await referralApi.ensurePersonalCode(memberId);
    },

    async fetchRewardRules() {
      this.rewardRules = await referralApi.fetchRewardRules();
      return this.rewardRules;
    },

    async createRewardRule(data) {
      const result = await referralApi.createRewardRule(data);
      await this.fetchRewardRules();
      return result;
    },

    async updateRewardRule(id, data) {
      const result = await referralApi.updateRewardRule(id, data);
      await this.fetchRewardRules();
      return result;
    },

    async deleteRewardRule(id) {
      await referralApi.deleteRewardRule(id);
      await this.fetchRewardRules();
    },

    async fetchAnomalies(params) {
      this.loading = true;
      try {
        this.anomalies = await referralApi.fetchAnomalies(params);
        return this.anomalies;
      } finally {
        this.loading = false;
      }
    },

    async markAnomaly(id, data) {
      const result = await referralApi.markAnomaly(id, data);
      await this.fetchAnomalies();
      return result;
    },
  },
});
