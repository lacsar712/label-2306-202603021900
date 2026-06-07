const logger = require('./logger');
const { processExpiredPoints, processReminders } = require('./pointsExpiryService');

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

let expiryTimer = null;
let reminderTimer = null;

const getMsUntilNextRun = (targetHour = 2, targetMinute = 0) => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, targetMinute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
};

const startExpiryScheduler = () => {
  if (expiryTimer) return;

  const runDaily = async () => {
    try {
      logger.info('Running daily points expiry task...');
      await processExpiredPoints();
    } catch (error) {
      logger.error('Error in daily points expiry task', { error: error.message, stack: error.stack });
    } finally {
      expiryTimer = setTimeout(runDaily, MS_PER_DAY);
    }
  };

  const initialDelay = getMsUntilNextRun(2, 0);
  logger.info(`Points expiry scheduler starting. First run in ${Math.round(initialDelay / 60000)} minutes.`);
  expiryTimer = setTimeout(runDaily, initialDelay);
};

const startReminderScheduler = () => {
  if (reminderTimer) return;

  const runHourly = async () => {
    try {
      logger.info('Running hourly points reminder task...');
      await processReminders();
    } catch (error) {
      logger.error('Error in hourly points reminder task', { error: error.message, stack: error.stack });
    } finally {
      reminderTimer = setTimeout(runHourly, MS_PER_HOUR);
    }
  };

  logger.info('Points reminder scheduler starting. First run immediately, then hourly.');
  reminderTimer = setTimeout(runHourly, 5000);
};

const startAllSchedulers = () => {
  startExpiryScheduler();
  startReminderScheduler();
  logger.info('All points expiry schedulers started.');
};

const stopAllSchedulers = () => {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
  logger.info('All points expiry schedulers stopped.');
};

module.exports = {
  startExpiryScheduler,
  startReminderScheduler,
  startAllSchedulers,
  stopAllSchedulers,
};
