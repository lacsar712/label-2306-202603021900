require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { startAllSchedulers } = require('./utils/scheduler');
const port = process.env.PORT || 8000;

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  startAllSchedulers();
});
