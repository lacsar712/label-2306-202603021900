import { defineStore } from 'pinia';
import templateApi from '../api/templates';

export const useTemplateStore = defineStore('template', {
  state: () => ({
    templates: [],
    loading: false,
    defaultVariables: [],
    sendRecords: [],
  }),
  actions: {
    async fetchTemplates(params) {
      this.loading = true;
      try {
        this.templates = await templateApi.list(params);
      } finally {
        this.loading = false;
      }
    },
    async fetchDefaultVariables() {
      try {
        this.defaultVariables = await templateApi.getDefaultVariables();
      } catch (e) {
        console.error(e);
      }
    },
    async fetchTemplate(id) {
      return await templateApi.get(id);
    },
    async fetchVersions(id) {
      return await templateApi.getVersions(id);
    },
    async createTemplate(data) {
      const result = await templateApi.create(data);
      await this.fetchTemplates();
      return result;
    },
    async updateTemplate(id, data) {
      const result = await templateApi.update(id, data);
      await this.fetchTemplates();
      return result;
    },
    async createVersion(id, data) {
      const result = await templateApi.createVersion(id, data);
      await this.fetchTemplates();
      return result;
    },
    async rollback(id, versionId) {
      const result = await templateApi.rollback(id, versionId);
      await this.fetchTemplates();
      return result;
    },
    async updateStatus(id, status) {
      const result = await templateApi.updateStatus(id, status);
      await this.fetchTemplates();
      return result;
    },
    async deleteTemplate(id) {
      await templateApi.remove(id);
      await this.fetchTemplates();
    },
    async previewTemplate(data) {
      return await templateApi.preview(data);
    },
    async sendNotification(data) {
      return await templateApi.send(data);
    },
    async fetchSendRecords(params) {
      this.sendRecords = await templateApi.getSendRecords(params);
      return this.sendRecords;
    },
  },
});
