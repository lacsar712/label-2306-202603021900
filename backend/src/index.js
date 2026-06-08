require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { scheduleAllTasks } = require('./utils/taskScheduler');
const port = process.env.PORT || 8000;

app.listen(port, async () => {
  logger.info(`Server running on port ${port}`);
  await scheduleAllTasks();
});
