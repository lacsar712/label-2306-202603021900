import { defineStore } from 'pinia';
import { ticketApi } from '../api/tickets';

export const useTicketStore = defineStore('ticket', {
  state: () => ({
    tickets: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
    loading: false,
    stats: null,
    assignmentRules: [],
  }),
  actions: {
    async fetchTickets(params) {
      this.loading = true;
      try {
        const data = await ticketApi.list(params);
        this.tickets = data.data;
        this.total = data.total;
        this.page = data.page;
        this.pageSize = data.pageSize;
        this.totalPages = data.totalPages;
      } finally {
        this.loading = false;
      }
    },

    async fetchStats() {
      this.stats = await ticketApi.stats();
      return this.stats;
    },

    async fetchAssignmentRules() {
      this.assignmentRules = await ticketApi.listAssignmentRules();
      return this.assignmentRules;
    },

    async createTicket(data) {
      const result = await ticketApi.create(data);
      return result;
    },

    async updateTicket(id, data) {
      const result = await ticketApi.update(id, data);
      return result;
    },

    async replyTicket(id, data) {
      return ticketApi.reply(id, data);
    },

    async assignTicket(id, assigneeId) {
      return ticketApi.assign(id, assigneeId);
    },

    async escalateTicket(id) {
      return ticketApi.escalate(id);
    },

    async addCollaborators(id, userIds) {
      return ticketApi.addCollaborators(id, userIds);
    },

    async removeCollaborator(ticketId, userId) {
      return ticketApi.removeCollaborator(ticketId, userId);
    },

    async saveAssignmentRule(data) {
      const result = await ticketApi.saveAssignmentRule(data);
      await this.fetchAssignmentRules();
      return result;
    },
  },
});
