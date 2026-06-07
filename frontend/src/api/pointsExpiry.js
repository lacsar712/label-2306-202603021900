import api from './axios';

export const getExpiryRules = () => api.get('/points-expiry/rules');
export const createExpiryRule = (data) => api.post('/points-expiry/rules', data);
export const updateExpiryRule = (id, data) => api.put(`/points-expiry/rules/${id}`, data);
export const deleteExpiryRule = (id) => api.delete(`/points-expiry/rules/${id}`);

export const getLedger = (params) => api.get('/points-expiry/ledger', { params });
export const getMemberPointsSummary = (memberId) => api.get(`/points-expiry/member/${memberId}/summary`);
export const getMemberLedgers = (memberId, params) => api.get(`/points-expiry/member/${memberId}/ledgers`, { params });

export const extendMemberPoints = (memberId, data) => api.post(`/points-expiry/member/${memberId}/extend`, data);
export const exemptMemberPoints = (memberId, data) => api.post(`/points-expiry/member/${memberId}/exempt`, data);

export const getExpiryDashboard = () => api.get('/points-expiry/dashboard');
export const runExpiryScan = () => api.post('/points-expiry/scan');
export const getExpiryExecutions = () => api.get('/points-expiry/executions');
