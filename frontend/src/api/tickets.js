import api from './axios';

export const ticketApi = {
  list(params) {
    return api.get('/tickets', { params });
  },

  get(id) {
    return api.get(`/tickets/${id}`);
  },

  create(data) {
    return api.post('/tickets', data);
  },

  update(id, data) {
    return api.put(`/tickets/${id}`, data);
  },

  reply(id, data) {
    return api.post(`/tickets/${id}/replies`, data);
  },

  assign(id, assigneeId) {
    return api.post(`/tickets/${id}/assign`, { assigneeId });
  },

  escalate(id) {
    return api.post(`/tickets/${id}/escalate`);
  },

  addCollaborators(id, userIds) {
    return api.post(`/tickets/${id}/collaborators`, { userIds });
  },

  removeCollaborator(ticketId, userId) {
    return api.delete(`/tickets/${ticketId}/collaborators/${userId}`);
  },

  stats() {
    return api.get('/tickets/stats');
  },

  listAssignmentRules() {
    return api.get('/tickets/assignment-rules/list');
  },

  saveAssignmentRule(data) {
    return api.post('/tickets/assignment-rules', data);
  },

  getMemberTicketSummary(memberId) {
    return api.get(`/members/${memberId}/tickets-summary`);
  },

  getMemberTickets(memberId, params) {
    return api.get(`/members/${memberId}/tickets`, { params });
  },
};

export const TICKET_CATEGORY = {
  CONSULTATION: { label: '咨询', value: 'CONSULTATION', type: 'info' },
  COMPLAINT: { label: '投诉', value: 'COMPLAINT', type: 'danger' },
  SUGGESTION: { label: '建议', value: 'SUGGESTION', type: 'success' },
  AFTERSALE: { label: '售后', value: 'AFTERSALE', type: 'warning' },
};

export const TICKET_PRIORITY = {
  LOW: { label: '低', value: 'LOW', type: 'info', color: '#94a3b8' },
  MEDIUM: { label: '中', value: 'MEDIUM', type: 'primary', color: '#3b82f6' },
  HIGH: { label: '高', value: 'HIGH', type: 'warning', color: '#f59e0b' },
  URGENT: { label: '紧急', value: 'URGENT', type: 'danger', color: '#ef4444' },
};

export const TICKET_STATUS = {
  PENDING_ASSIGN: { label: '待分配', value: 'PENDING_ASSIGN', type: 'info' },
  PENDING_PROCESS: { label: '待处理', value: 'PENDING_PROCESS', type: 'warning' },
  PROCESSING: { label: '处理中', value: 'PROCESSING', type: 'primary' },
  PENDING_REVIEW: { label: '待回访', value: 'PENDING_REVIEW', type: 'success' },
  CLOSED: { label: '已关闭', value: 'CLOSED', type: 'info' },
  REJECTED: { label: '已驳回', value: 'REJECTED', type: 'danger' },
};

export const CLOSED_STATUSES = ['CLOSED', 'REJECTED'];
