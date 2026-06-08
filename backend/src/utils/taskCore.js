const prisma = require('./prisma');
const logger = require('./logger');

const parseCronField = (field) => {
  if (field === '*') return { type: 'any', value: null };
  if (field.length > 1 && field.charAt(0) === '*' && field.charAt(1) === '/') {
    return { type: 'step', value: parseInt(field.substring(2)) };
  }
  return { type: 'exact', value: parseInt(field) };
};

const calculateNextExecution = (cronExpression, fromDate = new Date()) => {
  try {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length < 5) return null;
    const minute = parts[0];
    const hour = parts[1];
    const dayOfMonth = parts[2];
    const month = parts[3];
    const dayOfWeek = parts[4];

    const m = parseCronField(minute);
    const h = parseCronField(hour);
    const dom = parseCronField(dayOfMonth);
    const mo = parseCronField(month);
    const dow = parseCronField(dayOfWeek);

    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);

    for (let i = 0; i < 366 * 24 * 60; i++) {
      let mm = false;
      if (m.type === 'any') mm = true;
      else if (m.type === 'step') mm = next.getMinutes() % m.value === 0;
      else mm = next.getMinutes() === m.value;

      let hh = false;
      if (h.type === 'any') hh = true;
      else if (h.type === 'step') hh = next.getHours() % h.value === 0;
      else hh = next.getHours() === h.value;

      let domm = false;
      if (dom.type === 'any') domm = true;
      else domm = next.getDate() === dom.value;

      let moo = false;
      if (mo.type === 'any') moo = true;
      else moo = next.getMonth() + 1 === mo.value;

      let doww = false;
      if (dow.type === 'any') doww = true;
      else if (dow.value === 7) doww = next.getDay() === 0;
      else doww = next.getDay() === dow.value;

      if (mm && hh && domm && moo && doww) return next;
      next.setMinutes(next.getMinutes() + 1);
    }
    return null;
  } catch (e) {
    logger.warn('Invalid cron expression: ' + cronExpression);
    return null;
  }
};

const listTasks = async (filters = {}) => {
  const where = {};
  if (filters.module) where.module = filters.module;
  if (filters.status) where.status = filters.status;
  const tasks = await prisma.scheduledTask.findMany({
    where: where,
    include: {
      dependenciesAsChild: { include: { parentTask: { select: { id: true, name: true, displayName: true } } } },
      dependenciesAsParent: { include: { childTask: { select: { id: true, name: true, displayName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return tasks;
};

const getTaskById = async (id) => {
  return await prisma.scheduledTask.findUnique({
    where: { id: parseInt(id) },
    include: {
      dependenciesAsChild: { include: { parentTask: { select: { id: true, name: true, displayName: true } } } },
      dependenciesAsParent: { include: { childTask: { select: { id: true, name: true, displayName: true } } } },
    },
  });
};

const createTask = async (data) => {
  const nextAt = calculateNextExecution(data.cronExpression);
  return await prisma.scheduledTask.create({
    data: {
      ...data,
      nextExecutionAt: nextAt,
    },
  });
};

const updateTask = async (id, data) => {
  const updateData = { ...data };
  if (data.cronExpression) {
    updateData.nextExecutionAt = calculateNextExecution(data.cronExpression);
  }
  return await prisma.scheduledTask.update({
    where: { id: parseInt(id) },
    data: updateData,
  });
};

const updateTaskCron = async (id, cronExpression) => {
  const nextAt = calculateNextExecution(cronExpression);
  return await prisma.scheduledTask.update({
    where: { id: parseInt(id) },
    data: { cronExpression: cronExpression, nextExecutionAt: nextAt },
  });
};

const pauseTask = async (id) => {
  return await prisma.scheduledTask.update({
    where: { id: parseInt(id) },
    data: { status: 'PAUSED', isEnabled: false },
  });
};

const resumeTask = async (id) => {
  const task = await prisma.scheduledTask.findUnique({ where: { id: parseInt(id) } });
  const nextAt = calculateNextExecution(task.cronExpression);
  return await prisma.scheduledTask.update({
    where: { id: parseInt(id) },
    data: { status: 'RUNNING', isEnabled: true, nextExecutionAt: nextAt },
  });
};

const createExecutionLog = async (taskId, data = {}) => {
  return await prisma.taskExecutionLog.create({
    data: {
      taskId: parseInt(taskId),
      ...data,
    },
  });
};

const updateExecutionLog = async (logId, data) => {
  return await prisma.taskExecutionLog.update({
    where: { id: parseInt(logId) },
    data: data,
  });
};

const getExecutionLogs = async (taskId, options = {}) => {
  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const status = options.status;
  const where = { taskId: parseInt(taskId) };
  if (status) where.status = status;
  const skip = (page - 1) * pageSize;
  const [logs, total] = await Promise.all([
    prisma.taskExecutionLog.findMany({
      where: where,
      orderBy: { createdAt: 'desc' },
      skip: skip,
      take: parseInt(pageSize),
    }),
    prisma.taskExecutionLog.count({ where: where }),
  ]);
  return { logs: logs, total: total, page: parseInt(page), pageSize: parseInt(pageSize) };
};

const checkDependenciesMet = async (taskId) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const dependencies = await prisma.taskDependency.findMany({
    where: { childTaskId: parseInt(taskId) },
    include: { parentTask: true },
  });

  for (let i = 0; i < dependencies.length; i++) {
    const dep = dependencies[i];
    const lastLog = await prisma.taskExecutionLog.findFirst({
      where: {
        taskId: dep.parentTaskId,
        status: 'SUCCESS',
        createdAt: { gte: startOfDay },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastLog) return false;
  }
  return true;
};

module.exports = {
  parseCronField,
  calculateNextExecution,
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskCron,
  pauseTask,
  resumeTask,
  createExecutionLog,
  updateExecutionLog,
  getExecutionLogs,
  checkDependenciesMet,
};
