const cron = require('node-cron');
const prisma = require('./prisma');
const logger = require('./logger');
const taskService = require('./taskService');

const scheduledJobs = new Map();

const DEFAULT_TASKS = [
  {
    name: 'POINTS_EXPIRY',
    displayName: '积分过期处理',
    cronExpression: '0 2 * * *',
    description: '每日凌晨2点处理过期积分',
    module: 'POINTS',
    handler: 'POINTS_EXPIRY',
    timeoutSeconds: 600,
    maxRetryCount: 2,
    retryIntervalSeconds: 300,
    failureThreshold: 5,
  },
  {
    name: 'POINTS_REMINDER',
    displayName: '积分到期提醒',
    cronExpression: '0 * * * *',
    description: '每小时生成即将到期积分提醒',
    module: 'POINTS',
    handler: 'POINTS_REMINDER',
    timeoutSeconds: 300,
    maxRetryCount: 2,
    retryIntervalSeconds: 180,
    failureThreshold: 5,
  },
  {
    name: 'BLACKLIST_AUTO_RELEASE',
    displayName: '黑名单自动释放',
    cronExpression: '0 3 * * *',
    description: '每日凌晨3点自动释放到期黑名单',
    module: 'BLACKLIST',
    handler: 'BLACKLIST_AUTO_RELEASE',
    timeoutSeconds: 300,
    maxRetryCount: 2,
    retryIntervalSeconds: 180,
    failureThreshold: 5,
  },
  {
    name: 'DATA_SYNC',
    displayName: '数据同步任务',
    cronExpression: '0 */6 * * *',
    description: '每6小时执行一次数据同步',
    module: 'SYSTEM',
    handler: 'DATA_SYNC',
    timeoutSeconds: 600,
    maxRetryCount: 3,
    retryIntervalSeconds: 300,
    failureThreshold: 5,
  },
];

const ensureDefaultTasks = async () => {
  for (let i = 0; i < DEFAULT_TASKS.length; i++) {
    const taskDef = DEFAULT_TASKS[i];
    const existing = await prisma.scheduledTask.findUnique({ where: { name: taskDef.name } });
    if (!existing) {
      logger.info('Creating default task: ' + taskDef.name);
      await taskService.createTask(taskDef);
    }
  }
};

const scheduleTask = (task) => {
  if (scheduledJobs.has(task.id)) {
    scheduledJobs.get(task.id).stop();
    scheduledJobs.delete(task.id);
  }

  if (!task.isEnabled || task.status === 'PAUSED') {
    logger.info('Task ' + task.name + ' is disabled/paused, skipping scheduling.');
    return;
  }

  try {
    const job = cron.schedule(task.cronExpression, async () => {
      logger.info('Cron triggered task: ' + task.name);
      try {
        const met = await taskService.checkDependenciesMet(task.id);
        if (!met) {
          logger.info('Dependencies not met for task: ' + task.name + ', skipping.');
          return;
        }
        await taskService.executeTask(task.id, 'SYSTEM');
      } catch (error) {
        logger.error('Error executing scheduled task ' + task.name + ': ' + error.message);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai',
    });

    scheduledJobs.set(task.id, job);
    const nextRun = taskService.calculateNextExecution(task.cronExpression);
    logger.info('Task scheduled: ' + task.name + ' (cron: ' + task.cronExpression + ', next: ' + nextRun + ')');
  } catch (error) {
    logger.error('Failed to schedule task ' + task.name + ': ' + error.message);
  }
};

const scheduleAllTasks = async () => {
  try {
    await ensureDefaultTasks();
    const tasks = await prisma.scheduledTask.findMany();
    logger.info('Scheduling ' + tasks.length + ' tasks...');
    for (let i = 0; i < tasks.length; i++) {
      scheduleTask(tasks[i]);
    }
    logger.info('All tasks scheduled successfully.');
  } catch (error) {
    logger.error('Error scheduling tasks: ' + error.message);
  }
};

const rescheduleTask = async (taskId) => {
  const task = await prisma.scheduledTask.findUnique({ where: { id: parseInt(taskId) } });
  if (task) {
    scheduleTask(task);
  }
};

const stopTask = (taskId) => {
  const job = scheduledJobs.get(parseInt(taskId));
  if (job) {
    job.stop();
    scheduledJobs.delete(parseInt(taskId));
    logger.info('Stopped scheduled task id: ' + taskId);
  }
};

const stopAllTasks = () => {
  const keys = Array.from(scheduledJobs.keys());
  for (let i = 0; i < keys.length; i++) {
    const job = scheduledJobs.get(keys[i]);
    if (job) job.stop();
  }
  scheduledJobs.clear();
  logger.info('All scheduled tasks stopped.');
};

module.exports = {
  scheduleTask,
  scheduleAllTasks,
  rescheduleTask,
  stopTask,
  stopAllTasks,
  ensureDefaultTasks,
  scheduledJobs,
  DEFAULT_TASKS,
};
