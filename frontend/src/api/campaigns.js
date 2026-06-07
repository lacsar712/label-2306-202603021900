import api from './axios';

export default {
  list(params) {
    return api.get('/campaigns', { params });
  },
  get(id) {
    return api.get(`/campaigns/${id}`);
  },
  getStats(id) {
    return api.get(`/campaigns/${id}/stats`);
  },
  getActive() {
    return api.get('/campaigns/active');
  },
  create(data) {
    return api.post('/campaigns', data);
  },
  update(id, data) {
    return api.put(`/campaigns/${id}`, data);
  },
  updateStatus(id, status) {
    return api.post(`/campaigns/${id}/status`, { status });
  },
  remove(id) {
    return api.delete(`/campaigns/${id}`);
  },
  signin(memberId) {
    return api.post('/members/signin', { memberId });
  },
  exchange(data) {
    return api.post('/members/exchange', data);
  },
  getSignins(memberId) {
    return api.get(`/members/${memberId}/signins`);
  },
  getPointsLogs(memberId) {
    return api.get(`/members/${memberId}/points-logs`);
  },
};
