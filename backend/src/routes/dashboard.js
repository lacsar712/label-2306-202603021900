const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin, getAccessibleChannelIds } = require('../middleware/auth');
const { z } = require('zod');

const daysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDefaultComponents = () => [
  { type: 'STAT_CARD', title: '总会员数', x: 0, y: 0, width: 3, height: 3, visible: true, refreshInterval: 60, order: 0, config: { statType: 'TOTAL_MEMBERS' } },
  { type: 'STAT_CARD', title: '活跃会员', x: 3, y: 0, width: 3, height: 3, visible: true, refreshInterval: 60, order: 1, config: { statType: 'ACTIVE_MEMBERS' } },
  { type: 'STAT_CARD', title: '总积分', x: 6, y: 0, width: 3, height: 3, visible: true, refreshInterval: 60, order: 2, config: { statType: 'TOTAL_POINTS' } },
  { type: 'STAT_CARD', title: '今日签到', x: 9, y: 0, width: 3, height: 3, visible: true, refreshInterval: 60, order: 3, config: { statType: 'TODAY_SIGNINS' } },
  { type: 'CAMPAIGN_BANNER', title: '活动 Banner', x: 0, y: 3, width: 12, height: 2, visible: true, refreshInterval: 300, order: 4 },
  { type: 'CHANNEL_ALERTS', title: '渠道异常预警', x: 0, y: 5, width: 12, height: 3, visible: true, refreshInterval: 1800, order: 5 },
  { type: 'LEVEL_DISTRIBUTION', title: '等级分布', x: 0, y: 8, width: 6, height: 6, visible: true, refreshInterval: 300, order: 6 },
  { type: 'CHANNEL_PIE', title: '渠道分布', x: 6, y: 8, width: 3, height: 6, visible: true, refreshInterval: 300, order: 7 },
  { type: 'CHANNEL_TOP_LIST', title: 'TOP5 获客渠道', x: 9, y: 8, width: 3, height: 6, visible: true, refreshInterval: 300, order: 8 },
  { type: 'BIRTHDAY_REMINDER', title: '生日提醒', x: 0, y: 14, width: 4, height: 6, visible: true, refreshInterval: 3600, order: 9 },
  { type: 'CHECKIN_TREND', title: '签到趋势', x: 4, y: 14, width: 4, height: 6, visible: true, refreshInterval: 300, order: 10 },
  { type: 'TICKET_SLA', title: '工单 SLA 概览', x: 8, y: 14, width: 4, height: 6, visible: true, refreshInterval: 120, order: 11 },
  { type: 'POINTS_EXPIRY', title: '积分过期预警', x: 0, y: 20, width: 12, height: 5, visible: true, refreshInterval: 3600, order: 12 },
];

const buildMemberWhere = async (user, channelId) => {
  const accessibleIds = await getAccessibleChannelIds(user);
  const where = { sourceChannelId: { in: accessibleIds } };
  if (channelId) where.sourceChannelId = parseInt(channelId);
  return where;
};

router.get('/config', authenticate, async (req, res) => {
  try {
    let config = await prisma.dashboardConfig.findUnique({
      where: { userId: req.user.id },
      include: { components: { orderBy: { order: 'asc' } } },
    });

    if (!config) {
      const defaultTemplate = await prisma.dashboardConfig.findFirst({
        where: { isDefaultTemplate: true },
        include: { components: { orderBy: { order: 'asc' } } },
      });

      if (defaultTemplate) {
        config = await prisma.dashboardConfig.create({
          data: {
            userId: req.user.id,
            components: {
              create: defaultTemplate.components.map(c => ({
                type: c.type,
                title: c.title,
                x: c.x,
                y: c.y,
                width: c.width,
                height: c.height,
                visible: c.visible,
                refreshInterval: c.refreshInterval,
                timeRange: c.timeRange,
                config: c.config,
                order: c.order,
              })),
            },
          },
          include: { components: { orderBy: { order: 'asc' } } },
        });
      } else {
        config = await prisma.dashboardConfig.create({
          data: {
            userId: req.user.id,
            components: {
              create: getDefaultComponents(),
            },
          },
          include: { components: { orderBy: { order: 'asc' } } },
        });
      }
    }

    res.json(config);
  } catch (error) {
    logger.error('Error fetching dashboard config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const DashboardUpdateSchema = z.object({
  components: z.array(z.object({
    id: z.number().optional(),
    type: z.enum(['STAT_CARD', 'LEVEL_DISTRIBUTION', 'CHANNEL_PIE', 'CHANNEL_TOP_LIST', 'CHANNEL_ALERTS', 'BIRTHDAY_REMINDER', 'CAMPAIGN_BANNER', 'CHECKIN_TREND', 'TICKET_SLA', 'POINTS_EXPIRY']),
    title: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    visible: z.boolean(),
    refreshInterval: z.number().default(0),
    timeRange: z.string().nullable().optional(),
    config: z.any().nullable().optional(),
    order: z.number(),
  })),
});

router.put('/config', authenticate, async (req, res) => {
  try {
    const validated = DashboardUpdateSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      let config = await tx.dashboardConfig.findUnique({ where: { userId: req.user.id } });
      if (!config) {
        config = await tx.dashboardConfig.create({ data: { userId: req.user.id } });
      }
      await tx.dashboardComponent.deleteMany({ where: { dashboardConfigId: config.id } });
      await tx.dashboardComponent.createMany({
        data: validated.components.map(c => ({
          ...c,
          dashboardConfigId: config.id,
          config: c.config || null,
          timeRange: c.timeRange || null,
        })),
      });
    });

    const updatedConfig = await prisma.dashboardConfig.findUnique({
      where: { userId: req.user.id },
      include: { components: { orderBy: { order: 'asc' } } },
    });
    res.json(updatedConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating dashboard config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/reset', authenticate, async (req, res) => {
  try {
    await prisma.$transaction(async (tx) => {
      const config = await tx.dashboardConfig.findUnique({ where: { userId: req.user.id } });
      if (config) {
        await tx.dashboardComponent.deleteMany({ where: { dashboardConfigId: config.id } });
        await tx.dashboardConfig.delete({ where: { id: config.id } });
      }

      const defaultTemplate = await tx.dashboardConfig.findFirst({
        where: { isDefaultTemplate: true },
        include: { components: true },
      });

      const components = defaultTemplate
        ? defaultTemplate.components.map(c => ({
            type: c.type, title: c.title, x: c.x, y: c.y, width: c.width, height: c.height,
            visible: c.visible, refreshInterval: c.refreshInterval, timeRange: c.timeRange,
            config: c.config, order: c.order,
          }))
        : getDefaultComponents();

      await tx.dashboardConfig.create({
        data: { userId: req.user.id, components: { create: components } },
      });
    });

    const config = await prisma.dashboardConfig.findUnique({
      where: { userId: req.user.id },
      include: { components: { orderBy: { order: 'asc' } } },
    });
    res.json(config);
  } catch (error) {
    logger.error('Error resetting dashboard', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/default-template', authenticate, isAdmin, async (req, res) => {
  try {
    const template = await prisma.dashboardConfig.findFirst({
      where: { isDefaultTemplate: true },
      include: { components: { orderBy: { order: 'asc' } } },
    });
    res.json(template || { components: getDefaultComponents() });
  } catch (error) {
    logger.error('Error fetching default template', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/default-template', authenticate, isAdmin, async (req, res) => {
  try {
    const validated = DashboardUpdateSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      await tx.dashboardConfig.updateMany({ where: { isDefaultTemplate: true }, data: { isDefaultTemplate: false } });
      await tx.dashboardComponent.deleteMany({ where: { dashboardConfig: { isDefaultTemplate: true } } });
      const existing = await tx.dashboardConfig.findFirst({ where: { userId: req.user.id } });

      if (existing) {
        await tx.dashboardConfig.update({ where: { id: existing.id }, data: { isDefaultTemplate: true } });
        await tx.dashboardComponent.deleteMany({ where: { dashboardConfigId: existing.id } });
        await tx.dashboardComponent.createMany({
          data: validated.components.map(c => ({
            ...c, dashboardConfigId: existing.id, config: c.config || null, timeRange: c.timeRange || null,
          })),
        });
      } else {
        await tx.dashboardConfig.create({
          data: {
            userId: req.user.id, isDefaultTemplate: true,
            components: { create: validated.components.map(c => ({ ...c, config: c.config || null, timeRange: c.timeRange || null })) },
          },
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error saving default template', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/stat-card', authenticate, async (req, res) => {
  try {
    const { statType, channelId } = req.query;
    const memberWhere = await buildMemberWhere(req.user, channelId);

    let value = 0;
    let label = '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    switch (statType) {
      case 'TOTAL_MEMBERS':
        value = await prisma.member.count({ where: memberWhere });
        label = '总会员数'; break;
      case 'ACTIVE_MEMBERS':
        value = await prisma.member.count({ where: { ...memberWhere, status: 'ACTIVE' } });
        label = '活跃会员'; break;
      case 'TOTAL_POINTS': {
        const agg = await prisma.member.aggregate({ where: memberWhere, _sum: { points: true } });
        value = agg._sum.points || 0; label = '总积分'; break;
      }
      case 'TODAY_SIGNINS':
        value = await prisma.memberSignin.count({ where: { signinDate: { gte: today, lt: tomorrow } } });
        label = '今日签到'; break;
      case 'OPEN_TICKETS':
        value = await prisma.ticket.count({ where: { status: { notIn: ['CLOSED', 'REJECTED'] } } });
        label = '待处理工单'; break;
      case 'PENDING_REVIEW_CAMPAIGNS':
        value = await prisma.campaign.count({ where: { status: 'PENDING_REVIEW' } });
        label = '待审核活动'; break;
      default:
        value = await prisma.member.count({ where: memberWhere });
        label = '总会员数';
    }
    res.json({ value, label, statType });
  } catch (error) {
    logger.error('Error fetching stat card data', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/level-distribution', authenticate, async (req, res) => {
  try {
    const { channelId } = req.query;
    const memberWhere = await buildMemberWhere(req.user, channelId);
    const levelStats = await prisma.member.groupBy({ by: ['level'], where: memberWhere, _count: true });
    const total = await prisma.member.count({ where: memberWhere });
    res.json({ levelStats, total });
  } catch (error) {
    logger.error('Error fetching level distribution', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/channel-pie', authenticate, async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const channels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      include: { _count: { select: { members: true } } },
      orderBy: { members: { _count: 'desc' } },
    });
    const data = channels.map(c => ({ id: c.id, name: c.name, value: c._count.members }));
    res.json(data);
  } catch (error) {
    logger.error('Error fetching channel pie data', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/birthday-reminder', authenticate, async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const members = await prisma.member.findMany({
      where: { sourceChannelId: { in: accessibleIds }, status: 'ACTIVE' },
      take: 10,
      orderBy: { joinDate: 'desc' },
    });
    const today = new Date();
    const next30 = new Date(); next30.setDate(next30.getDate() + 30);
    const upcoming = members
      .filter(m => {
        if (!m.joinDate) return false;
        const bd = new Date(m.joinDate);
        bd.setFullYear(today.getFullYear());
        return bd >= today && bd <= next30;
      })
      .map(m => ({
        id: m.id, name: m.name, phone: m.phone,
        birthday: m.joinDate ? new Date(m.joinDate).toLocaleDateString() : null,
        level: m.level,
      }));
    res.json(upcoming);
  } catch (error) {
    logger.error('Error fetching birthday reminder', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/campaign-banner', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'ACTIVE', enabled: true, startTime: { lte: now }, endTime: { gte: now } },
      orderBy: { endTime: 'asc' },
    });
    res.json(campaigns);
  } catch (error) {
    logger.error('Error fetching campaign banner', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/checkin-trend', authenticate, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = parseInt(days);
    const startDate = daysAgo(daysNum - 1);
    const signins = await prisma.memberSignin.findMany({
      where: { signinDate: { gte: startDate } },
      orderBy: { signinDate: 'asc' },
    });
    const map = {};
    signins.forEach(s => {
      const key = s.signinDate.toISOString().split('T')[0];
      map[key] = (map[key] || 0) + 1;
    });
    const result = [];
    for (let i = 0; i < daysNum; i++) {
      const d = new Date(startDate); d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      result.push({ date: key, count: map[key] || 0 });
    }
    res.json(result);
  } catch (error) {
    logger.error('Error fetching checkin trend', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/ticket-sla', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const overdue = await prisma.ticket.count({
      where: { status: { notIn: ['CLOSED', 'REJECTED'] }, slaDeadline: { lt: now } },
    });
    const totalOpen = await prisma.ticket.count({
      where: { status: { notIn: ['CLOSED', 'REJECTED'] } },
    });
    const dueSoon = await prisma.ticket.count({
      where: {
        status: { notIn: ['CLOSED', 'REJECTED'] },
        slaDeadline: { gte: now, lte: new Date(now.getTime() + 24 * 3600 * 1000) },
      },
    });
    const byPriority = await prisma.ticket.groupBy({
      by: ['priority'],
      where: { status: { notIn: ['CLOSED', 'REJECTED'] } },
      _count: true,
    });
    res.json({ totalOpen, overdue, dueSoon, byPriority });
  } catch (error) {
    logger.error('Error fetching ticket SLA', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/points-expiry', authenticate, async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today); in7Days.setDate(in7Days.getDate() + 7); in7Days.setHours(23, 59, 59, 999);
    const in30Days = new Date(today); in30Days.setDate(in30Days.getDate() + 30); in30Days.setHours(23, 59, 59, 999);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const memberWhere = { sourceChannelId: { in: accessibleIds } };

    const ledgerBaseWhere = {
      status: 'ACTIVE',
      remainingPoints: { gt: 0 },
      exempted: false,
      member: memberWhere,
    };

    const [expiring7d, expiring30d, expiringThisMonth, executionHistory] = await Promise.all([
      prisma.pointsLedger.aggregate({
        where: { ...ledgerBaseWhere, expireAt: { gte: today, lte: in7Days } },
        _sum: { remainingPoints: true },
      }),
      prisma.pointsLedger.aggregate({
        where: { ...ledgerBaseWhere, expireAt: { gte: today, lte: in30Days } },
        _sum: { remainingPoints: true },
      }),
      prisma.pointsLedger.findMany({
        where: { ...ledgerBaseWhere, expireAt: { gte: today, lte: endOfMonth } },
        include: { member: { select: { id: true, name: true, phone: true } } },
        orderBy: { expireAt: 'asc' },
        take: 50,
      }),
      prisma.pointsExpiryExecution.findMany({
        orderBy: { executionDate: 'desc' },
        take: 7,
      }),
    ]);

    const affectedMemberIds = new Set();
    let totalThisMonth = 0;
    expiringThisMonth.forEach(l => {
      affectedMemberIds.add(l.memberId);
      totalThisMonth += l.remainingPoints;
    });

    const topMembers = expiringThisMonth.slice(0, 10).map(l => ({
      memberId: l.memberId,
      memberName: l.member.name,
      memberPhone: l.member.phone,
      points: l.remainingPoints,
      expireAt: l.expireAt,
    }));

    res.json({
      expiring7Days: expiring7d._sum.remainingPoints || 0,
      expiring30Days: expiring30d._sum.remainingPoints || 0,
      expiringThisMonth: totalThisMonth,
      affectedMembersThisMonth: affectedMemberIds.size,
      topMembers,
      executionHistory: executionHistory.map(e => ({
        id: e.id,
        executionDate: e.executionDate,
        handledType: e.handledType,
        totalExpiredPoints: e.totalExpiredPoints,
        totalFrozenPoints: e.totalFrozenPoints,
        affectedMembers: e.affectedMembers,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching points expiry', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/channel-top-list', authenticate, async (req, res) => {
  try {
    const { limit = 5, channelId } = req.query;
    let accessibleIds = await getAccessibleChannelIds(req.user);
    if (channelId) accessibleIds = accessibleIds.filter(id => id === parseInt(channelId));

    const channels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      include: {
        _count: { select: { members: true } },
      },
      take: parseInt(limit),
      orderBy: { members: { _count: 'desc' } },
    });

    const total = await prisma.member.count({
      where: { sourceChannelId: { in: accessibleIds } },
    });

    const data = channels.map(c => ({
      id: c.id,
      name: c.name,
      memberCount: c._count.members,
      percent: total > 0 ? Math.round((c._count.members / total) * 100) : 0,
    }));

    res.json(data);
  } catch (error) {
    logger.error('Error fetching channel top list', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/data/channel-alerts', authenticate, async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const activeChannels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      select: { id: true, name: true },
    });

    const alerts = [];

    for (const ch of activeChannels) {
      const [current7d, previous7d] = await Promise.all([
        prisma.member.count({
          where: {
            sourceChannelId: ch.id,
            joinDate: { gte: sevenDaysAgo, lt: today },
          },
        }),
        prisma.member.count({
          where: {
            sourceChannelId: ch.id,
            joinDate: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          },
        }),
      ]);

      const base = Math.max(previous7d, 3);
      const changePercent = previous7d > 0 ? Math.round(((current7d - previous7d) / previous7d) * 100) : 0;

      if (current7d > 0 && previous7d === 0) continue;
      if (changePercent <= -50 && current7d < previous7d) {
        alerts.push({
          channelId: ch.id,
          channelName: ch.name,
          type: 'DROP',
          current7d,
          previous7d,
          changePercent,
          message: `近7日新增 ${current7d}，较上一周期 ${previous7d} 下降 ${Math.abs(changePercent)}%`,
        });
      } else if (changePercent >= 100 && current7d > previous7d && previous7d >= 3) {
        alerts.push({
          channelId: ch.id,
          channelName: ch.name,
          type: 'SPIKE',
          current7d,
          previous7d,
          changePercent,
          message: `近7日新增 ${current7d}，较上一周期 ${previous7d} 激增 ${changePercent}%`,
        });
      }
    }

    alerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    res.json(alerts);
  } catch (error) {
    logger.error('Error fetching channel alerts', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
