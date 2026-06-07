import api from './axios';

export const fetchDashboardConfig = () => api.get('/dashboard/config');
export const saveDashboardConfig = (data) => api.put('/dashboard/config', data);
export const resetDashboard = () => api.post('/dashboard/reset');
export const fetchDefaultTemplate = () => api.get('/dashboard/default-template');
export const saveDefaultTemplate = (data) => api.put('/dashboard/default-template', data);

export const fetchStatCard = (params) => api.get('/dashboard/data/stat-card', { params });
export const fetchLevelDistribution = (params) => api.get('/dashboard/data/level-distribution', { params });
export const fetchChannelPie = (params) => api.get('/dashboard/data/channel-pie', { params });
export const fetchBirthdayReminder = (params) => api.get('/dashboard/data/birthday-reminder', { params });
export const fetchCampaignBanner = (params) => api.get('/dashboard/data/campaign-banner', { params });
export const fetchCheckinTrend = (params) => api.get('/dashboard/data/checkin-trend', { params });
export const fetchTicketSLA = (params) => api.get('/dashboard/data/ticket-sla', { params });
export const fetchPointsExpiry = (params) => api.get('/dashboard/data/points-expiry', { params });
