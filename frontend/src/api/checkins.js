import api from './axios';

export const getSigninConfig = () => api.get('/checkins/config');
export const updateSigninConfig = (data) => api.put('/checkins/config', data);
export const signin = (memberId) => api.post('/checkins', { memberId });
export const makeupSignin = (memberId, signinDate) => api.post('/checkins/makeup', { memberId, signinDate });
export const getMemberCalendar = (memberId, year, month) =>
  api.get(`/checkins/member/${memberId}/calendar`, { params: { year, month } });
export const getMemberSigninHistory = (memberId, page, pageSize) =>
  api.get(`/checkins/member/${memberId}/history`, { params: { page, pageSize } });
export const getSigninStats = (params) => api.get('/checkins/stats', { params });
export const exportSigninRecords = (params) => {
  const query = new URLSearchParams(params || {}).toString();
  const token = localStorage.getItem('token');
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  return window.open(`${baseURL}/checkins/export${query ? '?' + query : ''}${query ? '&' : '?'}token=${token}`, '_blank');
};
