const taskCore = require('./taskCore');
const taskHandlers = require('./taskHandlers');
const taskExecute = require('./taskExecute');
const taskDependencies = require('./taskDependencies');
const taskStats = require('./taskStats');
const taskNotifications = require('./taskNotifications');

module.exports = {
  registerHandler: taskHandlers.registerHandler,
  getHandler: taskHandlers.getHandler,
  listHandlers: taskHandlers.listHandlers,
  TASK_HANDLERS: taskHandlers.TASK_HANDLERS,

  calculateNextExecution: taskCore.calculateNextExecution,
  listTasks: taskCore.listTasks,
  getTaskById: taskCore.getTaskById,
  createTask: taskCore.createTask,
  updateTask: taskCore.updateTask,
  updateTaskCron: taskCore.updateTaskCron,
  pauseTask: taskCore.pauseTask,
  resumeTask: taskCore.resumeTask,
  createExecutionLog: taskCore.createExecutionLog,
  updateExecutionLog: taskCore.updateExecutionLog,
  getExecutionLogs: taskCore.getExecutionLogs,

  executeTask: taskExecute.executeTask,
  triggerDependentTasks: taskExecute.triggerDependentTasks,

  checkDependenciesMet: taskDependencies.checkDependenciesMet,
  listDependencies: taskDependencies.listDependencies,
  addDependency: taskDependencies.addDependency,
  removeDependency: taskDependencies.removeDependency,

  getDashboardStats: taskStats.getDashboardStats,

  sendUrgentNotification: taskNotifications.sendUrgentNotification,
  listNotifications: taskNotifications.listNotifications,
  markNotificationRead: taskNotifications.markNotificationRead,
};
