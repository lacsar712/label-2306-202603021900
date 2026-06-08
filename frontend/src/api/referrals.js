import api from './axios';

export const fetchReferralOverview = () => api.get('/referrals/overview');

export const fetchReferralConfig = () => api.get('/referrals/config');
export const updateReferralConfig = (data) => api.put('/referrals/config', data);

export const searchReferrer = (params) => api.get('/referrals/search', { params });

export const bindReferral = (data) => api.post('/referrals/bind', data);
export const bindByCode = (data) => api.post('/referrals/bind-by-code', data);
export const bindByPhone = (data) => api.post('/referrals/bind-by-phone', data);
export const unbindReferral = (refereeId) => api.post(`/referrals/unbind/${refereeId}`);

export const fetchReferralTree = (memberId, depth) =>
  api.get(`/referrals/tree/${memberId}`, { params: depth ? { depth } : {} });

export const fetchReferralBinds = (params) => api.get('/referrals/binds', { params });
export const fetchReferralStats = (memberId) => api.get(`/referrals/stats/${memberId}`);

export const fetchLeaderboard = (params) => api.get('/referrals/leaderboard', { params });

export const fetchReferralCodes = (params) => api.get('/referrals/codes', { params });
export const fetchReferralCode = (id) => api.get(`/referrals/codes/${id}`);
export const createReferralCode = (data) => api.post('/referrals/codes', data);
export const updateReferralCode = (id, data) => api.put(`/referrals/codes/${id}`, data);
export const deleteReferralCode = (id) => api.delete(`/referrals/codes/${id}`);
export const ensurePersonalCode = (memberId) => api.post(`/referrals/codes/ensure-personal/${memberId}`);

export const fetchRewardRules = () => api.get('/referrals/reward-rules');
export const createRewardRule = (data) => api.post('/referrals/reward-rules', data);
export const updateRewardRule = (id, data) => api.put(`/referrals/reward-rules/${id}`, data);
export const deleteRewardRule = (id) => api.delete(`/referrals/reward-rules/${id}`);

export const fetchAnomalies = (params) => api.get('/referrals/anomalies', { params });
export const markAnomaly = (id, data) => api.put(`/referrals/anomalies/${id}/mark`, data);
