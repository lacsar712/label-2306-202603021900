const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const memberRoutes = require('./routes/members');
const systemRoutes = require('./routes/system');
const ticketRoutes = require('./routes/tickets');
const campaignRoutes = require('./routes/campaigns');
const channelRoutes = require('./routes/channels');
const checkinRoutes = require('./routes/checkins');
const pointsExpiryRoutes = require('./routes/pointsExpiry');
const dashboardRoutes = require('./routes/dashboard');
const referralRoutes = require('./routes/referrals');
const templateRoutes = require('./routes/templates');
const blacklistRoutes = require('./routes/blacklist');
const logger = require('./utils/logger');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/points-expiry', pointsExpiryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/blacklist', blacklistRoutes);
// Compatibility for /api/stats which was at /api/stats in index.js
app.use('/api', systemRoutes); 

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`${err.message}\n${err.stack}`);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
