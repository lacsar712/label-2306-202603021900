import api from './axios';

export const fetchTaskDashboard = () => api.get('/scheduled-tasks/dashboard');
export const fetchTasks = (params) => api.get('/scheduled-tasks', { params });
export const fetchTaskDetail = (id) => api.get(`/scheduled-tasks/${id}`);
export const fetchTaskHandlers = () => api.get('/scheduled-tasks/handlers');
export const createTask = (data) => api.post('/scheduled-tasks', data);
export const updateTask = (id, data) => api.put(`/scheduled-tasks/${id}`, data);
export const updateTaskCron = (id, cronExpression) => api.put(`/scheduled-tasks/${id}/cron`, { cronExpression });
export const triggerTask = (id) => api.post(`/scheduled-tasks/${id}/trigger`);
export const pauseTask = (id) => api.post(`/scheduled-tasks/${id}/pause`);
export const resumeTask = (id) => api.post(`/scheduled-tasks/${id}/resume`);
export const fetchTaskLogs = (id, params) => api.get(`/scheduled-tasks/${id}/logs`, { params });
export const fetchTaskDependencies = (id) => api.get(`/scheduled-tasks/${id}/dependencies`);
export const addDependency = (data) => api.post('/scheduled-tasks/dependencies', data);
export const removeDependency = (id) => api.delete(`/scheduled-tasks/dependencies/${id}`);
export const fetchNotifications = (params) => api.get('/scheduled-tasks/notifications', { params });
export const markNotificationRead = (id) => api.put(`/scheduled-tasks/notifications/${id}/read`);
