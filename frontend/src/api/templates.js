import api from './axios';

export default {
  list(params) {
    return api.get('/templates', { params });
  },
  get(id) {
    return api.get(`/templates/${id}`);
  },
  getVersions(id) {
    return api.get(`/templates/${id}/versions`);
  },
  getDefaultVariables() {
    return api.get('/templates/variables');
  },
  create(data) {
    return api.post('/templates', data);
  },
  update(id, data) {
    return api.put(`/templates/${id}`, data);
  },
  createVersion(id, data) {
    return api.post(`/templates/${id}/versions`, data);
  },
  rollback(id, versionId) {
    return api.post(`/templates/${id}/rollback`, { versionId });
  },
  updateStatus(id, status) {
    return api.post(`/templates/${id}/status`, { status });
  },
  remove(id) {
    return api.delete(`/templates/${id}`);
  },
  preview(data) {
    return api.post('/templates/preview', data);
  },
  send(data) {
    return api.post('/templates/send', data);
  },
  getSendRecords(params) {
    return api.get('/templates/send-records/list', { params });
  },
};
