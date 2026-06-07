const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin, getAccessibleChannelIds } = require('../middleware/auth');
const os = require('os');

const daysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Get member stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const memberWhere = { sourceChannelId: { in: accessibleIds } };

    const [total, active, levelStats, totalPoints, topChannels, channelAlerts] = await Promise.all([
      prisma.member.count({ where: memberWhere }),
      prisma.member.count({ where: { ...memberWhere, status: 'ACTIVE' } }),
      prisma.member.groupBy({
        by: ['level'],
        where: memberWhere,
        _count: true
      }),
      prisma.member.aggregate({
        where: memberWhere,
        _sum: { points: true }
      }),
      prisma.channel.findMany({
        where: { id: { in: accessibleIds }, isActive: true },
        include: { _count: { select: { members: true } } },
        orderBy: { members: { _count: 'desc' } },
        take: 5
      }),
      (async () => {
        const sevenDaysAgo = daysAgo(7);
        const fourteenDaysAgo = daysAgo(14);
        const channels = await prisma.channel.findMany({
          where: { id: { in: accessibleIds }, isActive: true },
          include: { members: { select: { joinDate: true } } }
        });
        const alerts = [];
        channels.forEach(ch => {
          const new7d = ch.members.filter(m => m.joinDate >= sevenDaysAgo).length;
          const prev7d = ch.members.filter(m => m.joinDate >= fourteenDaysAgo && m.joinDate < sevenDaysAgo).length;
          if (prev7d >= 5) {
            const change = prev7d > 0 ? Math.round(((new7d - prev7d) / prev7d) * 100) : 0;
            if (change <= -50) {
              alerts.push({
                channelId: ch.id,
                channelName: ch.name,
                type: 'decline',
                severity: change <= -70 ? 'high' : 'medium',
                message: `${ch.name} 近7日新增骤降 ${Math.abs(change)}%`,
                changePercent: change
              });
            }
          }
        });
        return alerts;
      })()
    ]);

    res.json({
      total,
      active,
      levelStats,
      totalPoints: totalPoints._sum.points || 0,
      topChannels: topChannels.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        memberCount: c._count.members
      })),
      channelAlerts
    });
  } catch (error) {
    logger.error('Error fetching stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// System Info (Protected - Admin only)
router.get('/info', authenticate, isAdmin, async (req, res) => {
  try {
    const info = {
      platform: os.platform(),
      release: os.release(),
      uptime: os.uptime(),
      totalMemory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      freeMemory: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      cpuCount: os.cpus().length,
      nodeVersion: process.version,
      dbStatus: 'Connected'
    };
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
