const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set!');
}

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

const getUserManagedChannelIds = async (userId) => {
  const channels = await prisma.channel.findMany({
    where: { managerId: userId },
    select: { id: true }
  });
  return channels.map(c => c.id);
};

const getAccessibleChannelIds = async (user) => {
  if (user.role === 'ADMIN') {
    const allChannels = await prisma.channel.findMany({ select: { id: true } });
    return allChannels.map(c => c.id);
  }
  return await getUserManagedChannelIds(user.id);
};

const requireChannelAccess = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      return next();
    }
    const channelId = parseInt(req.params.id) || parseInt(req.query.channelId);
    if (channelId) {
      const managedIds = await getUserManagedChannelIds(req.user.id);
      if (!managedIds.includes(channelId)) {
        return res.status(403).json({ error: 'Forbidden: No access to this channel' });
      }
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const applyChannelFilter = async (req, where = {}) => {
  if (req.user.role === 'ADMIN') return where;
  const managedIds = await getUserManagedChannelIds(req.user.id);
  return {
    ...where,
    sourceChannelId: { in: managedIds }
  };
};

module.exports = {
  authenticate,
  isAdmin,
  getUserManagedChannelIds,
  getAccessibleChannelIds,
  requireChannelAccess,
  applyChannelFilter,
};
