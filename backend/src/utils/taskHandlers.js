const prisma = require('./prisma');
const logger = require('./logger');
const { processExpiredPoints, processReminders } = require('./pointsExpiryService');
const { processExpiredBlacklists } = require('./blacklistService');

const TASK_HANDLERS = {};

TASK_HANDLERS.POINTS_EXPIRY = async () => {
  return await processExpiredPoints();
};

TASK_HANDLERS.POINTS_REMINDER = async () => {
  return await processReminders();
};

TASK_HANDLERS.BLACKLIST_AUTO_RELEASE = async () => {
  return await processExpiredBlacklists();
};

TASK_HANDLERS.DATA_SYNC = async () => {
  return { synced: 0, message: 'Data sync placeholder' };
};

const registerHandler = (name, handler) => {
  TASK_HANDLERS[name] = handler;
};

const getHandler = (name) => TASK_HANDLERS[name];

const listHandlers = () => Object.keys(TASK_HANDLERS);

module.exports = {
  TASK_HANDLERS,
  registerHandler,
  getHandler,
  listHandlers,
};
