const prisma = require('./prisma');
const logger = require('./logger');
const taskCore = require('./taskCore');
const taskHandlers = require('./taskHandlers');
const taskDependencies = require('./taskDependencies');
const taskNotifications = require('./taskNotifications');

const triggerDependentTasks = async (parentTaskId) => {
  const dependents = await prisma.taskDependency.findMany({
    where: { parentTaskId: parseInt(parentTaskId) },
    include: { childTask: true },
  });
  for (let i = 0; i < dependents.length; i++) {
    const dep = dependents[i];
    if (dep.childTask.status === 'RUNNING' && dep.childTask.isEnabled) {
      const met = await taskDependencies.checkDependenciesMet(dep.childTaskId);
      if (met) {
        logger.info('Dependency satisfied, auto-triggering task: ' + dep.childTask.name);
        await executeTask(dep.childTaskId, 'DEPENDENCY');
      }
    }
  }
};

const executeTask = async (taskId, triggeredBy) => {
  if (!triggeredBy) triggeredBy = 'SYSTEM';
  const task = await prisma.scheduledTask.findUnique({ where: { id: parseInt(taskId) } });
  if (!task) return null;
  if (!task.isEnabled || task.status === 'PAUSED') return null;
  if (task.status === 'EXECUTING') return null;

  const handler = taskHandlers.getHandler(task.handler);
  if (!handler) {
    logger.error('No handler registered for task: ' + task.name);
    return null;
  }

  await prisma.scheduledTask.update({
    where: { id: task.id },
    data: { status: 'EXECUTING' },
  });

  const log = await taskCore.createExecutionLog(task.id, {
    startedAt: new Date(),
    status: 'SUCCESS',
    triggeredBy: triggeredBy,
  });

  const startTime = Date.now();
  let timedOut = false;
  let timeoutId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new Error('Task timeout after ' + task.timeoutSeconds + 's'));
    }, task.timeoutSeconds * 1000);
  });

  try {
    const result = await Promise.race([handler(), timeoutPromise]);
    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;
    let processedCount = 0;
    if (result) {
      processedCount = result.processed || result.affectedMembers || result.count || 0;
    }
    let outputSummary = null;
    if (result) {
      outputSummary = JSON.stringify(result).slice(0, 1000);
    }

    await taskCore.updateExecutionLog(log.id, {
      finishedAt: new Date(),
      durationMs: duration,
      status: 'SUCCESS',
      processedCount: processedCount,
      outputSummary: outputSummary,
    });

    const nextAt = taskCore.calculateNextExecution(task.cronExpression);
    await prisma.scheduledTask.update({
      where: { id: task.id },
      data: {
        status: 'RUNNING',
        lastExecutionAt: new Date(),
        lastDurationMs: duration,
        consecutiveFailures: 0,
        nextExecutionAt: nextAt,
      },
    });

    await triggerDependentTasks(task.id);
    return { status: 'SUCCESS', duration: duration, result: result };
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    const status = timedOut ? 'TIMEOUT' : 'FAILED';
    const newConsecutive = task.consecutiveFailures + 1;

    let errContent = error.message;
    if (error.stack) {
      errContent = error.stack.slice(0, 4000);
    }

    await taskCore.updateExecutionLog(log.id, {
      finishedAt: new Date(),
      durationMs: duration,
      status: status,
      errorStack: errContent,
    });

    let newStatus = 'RUNNING';
    if (newConsecutive >= task.failureThreshold) {
      newStatus = 'ERROR';
    }
    const nextAt = taskCore.calculateNextExecution(task.cronExpression);
    const updatedTask = await prisma.scheduledTask.update({
      where: { id: task.id },
      data: {
        status: newStatus,
        lastExecutionAt: new Date(),
        lastDurationMs: duration,
        consecutiveFailures: newConsecutive,
        nextExecutionAt: nextAt,
      },
    });

    if (newConsecutive >= task.failureThreshold && newConsecutive % task.failureThreshold === 0) {
      await taskNotifications.sendUrgentNotification(updatedTask);
    }

    if (newConsecutive <= task.maxRetryCount) {
      setTimeout(() => {
        executeTask(task.id, 'RETRY');
      }, task.retryIntervalSeconds * 1000);
    }

    logger.error('Task ' + task.name + ' failed: ' + error.message);
    return { status: status, duration: duration, error: error.message };
  }
};

module.exports = {
  executeTask,
  triggerDependentTasks,
};
