const prisma = require('./prisma');
const logger = require('./logger');

const sendUrgentNotification = async (task) => {
  const displayName = task.displayName || task.name;
  await prisma.systemNotification.create({
    data: {
      title: '任务异常告警: ' + displayName,
      content: '任务 "' + displayName + '" 连续失败 ' + task.consecutiveFailures + ' 次，请及时检查。',
      level: 'URGENT',
      category: 'SCHEDULED_TASK',
      relatedId: task.id,
    },
  });
  logger.warn('Urgent notification sent for task: ' + task.name);
};

const listNotifications = async (options) => {
  if (!options) options = {};
  const where = {};
  if (options.level) where.level = options.level;
  if (options.status) where.status = options.status;
  return await prisma.systemNotification.findMany({
    where: where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
};

const markNotificationRead = async (id) => {
  return await prisma.systemNotification.update({
    where: { id: parseInt(id) },
    data: { status: 'READ', readAt: new Date() },
  });
};

module.exports = {
  sendUrgentNotification,
  listNotifications,
  markNotificationRead,
};
