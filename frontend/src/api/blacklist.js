import api from './axios';

export const fetchBlacklist = (params) => api.get('/blacklist', { params });

export const checkBlacklist = (params) => api.get('/blacklist/check', { params });

export const fetchBlacklistStats = () => api.get('/blacklist/stats');

export const fetchAuditLogs = (params) => api.get('/blacklist/audit-logs', { params });

export const fetchBlacklistConfig = () => api.get('/blacklist/config');

export const updateBlacklistConfig = (data) => api.put('/blacklist/config', data);

export const addBlacklist = (data) => api.post('/blacklist', data);

export const batchAddBlacklist = (data) => api.post('/blacklist/batch', data);

export const importBlacklistCSV = (data) => api.post('/blacklist/import/csv', data);

export const approveBlacklist = (id, data) => api.post(`/blacklist/${id}/approve`, data);

export const releaseBlacklist = (id, data) => api.post(`/blacklist/${id}/release`, data);

export const batchReleaseBlacklist = (data) => api.post('/blacklist/batch/release', data);

export const deleteBlacklist = (id) => api.delete(`/blacklist/${id}`);

export const exportBlacklist = (params) => {
  const query = new URLSearchParams(params || {}).toString();
  const token = localStorage.getItem('token');
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  const url = `${baseURL}/blacklist/export${query ? '?' + query : ''}${token ? (query ? '&' : '?') + 'token=' + token : ''}`;
  window.open(url, '_blank');
};
