import api from './axios';

export const fetchChannels = (params = {}) => api.get('/channels', { params });

export const fetchFlatChannels = () => api.get('/channels/flat');

export const fetchChannel = (id) => api.get(`/channels/${id}`);

export const createChannel = (data) => api.post('/channels', data);

export const updateChannel = (id, data) => api.put(`/channels/${id}`, data);

export const deleteChannel = (id) => api.delete(`/channels/${id}`);

export const mergeChannels = (sourceIds, targetId) =>
  api.post('/channels/merge', { sourceIds, targetId });

export const fetchChannelMembers = (id, params = {}) =>
  api.get(`/channels/${id}/members`, { params });

export const fetchChannelStatsOverview = () => api.get('/channels/stats/overview');

export const fetchChannelStatsTrend = (days = 30) =>
  api.get('/channels/stats/trend', { params: { days } });

export const fetchChannelStatsRetention = () => api.get('/channels/stats/retention');

export const fetchChannelStatsSankey = () => api.get('/channels/stats/sankey');

export const fetchTopChannels = (limit = 5) =>
  api.get('/channels/stats/top', { params: { limit } });

export const fetchChannelAlerts = () => api.get('/channels/stats/alerts');
