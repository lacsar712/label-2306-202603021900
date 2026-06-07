const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin, getAccessibleChannelIds, requireChannelAccess } = require('../middleware/auth');
const { ChannelSchema, ChannelUpdateSchema, ChannelMergeSchema } = require('../validations/schemas');
const { z } = require('zod');

const buildChannelTree = (channels) => {
  const map = new Map();
  const roots = [];
  channels.forEach(c => {
    map.set(c.id, { ...c, children: [] });
  });
  channels.forEach(c => {
    const node = map.get(c.id);
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

const daysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
};

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { tree = 'true', parentId, isActive } = req.query;
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const where = { id: { in: accessibleIds } };
    if (parentId) where.parentId = parseInt(parentId);
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const channels = await prisma.channel.findMany({
      where,
      include: {
        manager: { select: { id: true, username: true } },
        _count: { select: { members: true } }
      },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]
    });

    if (tree === 'true') {
      res.json(buildChannelTree(channels));
    } else {
      res.json(channels);
    }
  } catch (error) {
    logger.error('Error fetching channels', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/flat', async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const channels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      select: { id: true, name: true, code: true, level: true, parentId: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }]
    });
    res.json(channels);
  } catch (error) {
    logger.error('Error fetching flat channels', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', requireChannelAccess, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, username: true } },
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, code: true } },
        _count: { select: { members: true } }
      }
    });
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json(channel);
  } catch (error) {
    logger.error('Error fetching channel', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', isAdmin, async (req, res) => {
  try {
    const data = ChannelSchema.parse(req.body);
    if (data.parentId) {
      const parent = await prisma.channel.findUnique({ where: { id: data.parentId } });
      if (!parent) return res.status(400).json({ error: 'Parent channel not found' });
      data.level = parent.level + 1;
    } else {
      data.level = 1;
    }
    const channel = await prisma.channel.create({ data });
    res.status(201).json(channel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Channel code already exists' });
    }
    logger.error('Error creating channel', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = ChannelUpdateSchema.parse(req.body);
    if (data.parentId) {
      if (data.parentId === id) {
        return res.status(400).json({ error: 'Cannot set parent to self' });
      }
      const parent = await prisma.channel.findUnique({ where: { id: data.parentId } });
      if (!parent) return res.status(400).json({ error: 'Parent channel not found' });
      data.level = parent.level + 1;
    } else if (data.parentId === null) {
      data.level = 1;
    }
    const channel = await prisma.channel.update({ where: { id }, data });
    res.json(channel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Channel code already exists' });
    }
    logger.error('Error updating channel', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const children = await prisma.channel.count({ where: { parentId: id } });
    if (children > 0) {
      return res.status(400).json({ error: 'Cannot delete channel with children' });
    }
    const membersCount = await prisma.member.count({ where: { sourceChannelId: id } });
    if (membersCount > 0) {
      return res.status(400).json({ error: 'Cannot delete channel with associated members. Merge channels instead.' });
    }
    await prisma.channel.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting channel', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/merge', isAdmin, async (req, res) => {
  try {
    const { sourceIds, targetId } = ChannelMergeSchema.parse(req.body);
    if (sourceIds.includes(targetId)) {
      return res.status(400).json({ error: 'Target channel cannot be in source list' });
    }
    const target = await prisma.channel.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: 'Target channel not found' });

    await prisma.$transaction(async (tx) => {
      await tx.member.updateMany({
        where: { sourceChannelId: { in: sourceIds } },
        data: { sourceChannelId: targetId }
      });
      await tx.channel.deleteMany({ where: { id: { in: sourceIds } } });
    });

    res.json({ success: true, mergedCount: sourceIds.length, targetId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error merging channels', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/members', requireChannelAccess, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where: { sourceChannelId: id },
        skip,
        take: parseInt(pageSize),
        orderBy: { joinDate: 'desc' }
      }),
      prisma.member.count({ where: { sourceChannelId: id } })
    ]);
    res.json({ members, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    logger.error('Error fetching channel members', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/overview', async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const thirtyDaysAgo = daysAgo(30);
    const ninetyDaysAgo = daysAgo(90);
    const sevenDaysAgo = daysAgo(7);
    const fourteenDaysAgo = daysAgo(14);

    const channels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      include: {
        _count: { select: { members: true } },
        members: {
          select: {
            points: true,
            status: true,
            level: true,
            joinDate: true,
            signins: { select: { id: true } }
          }
        }
      }
    });

    const channelStats = channels.map(ch => {
      const members = ch.members;
      const totalMembers = members.length;
      const new30d = members.filter(m => m.joinDate >= thirtyDaysAgo).length;
      const new90d = members.filter(m => m.joinDate >= ninetyDaysAgo).length;
      const new7d = members.filter(m => m.joinDate >= sevenDaysAgo).length;
      const prev7d = members.filter(m => m.joinDate >= fourteenDaysAgo && m.joinDate < sevenDaysAgo).length;

      const avgPoints = totalMembers > 0
        ? Math.round(members.reduce((s, m) => s + m.points, 0) / totalMembers)
        : 0;
      const activeCount = members.filter(m => m.status === 'ACTIVE').length;
      const activeRate = totalMembers > 0 ? Math.round((activeCount / totalMembers) * 100) : 0;

      const highLevelCount = members.filter(m => ['GOLD', 'PLATINUM'].includes(m.level)).length;
      const conversionRate = totalMembers > 0 ? Math.round((highLevelCount / totalMembers) * 100) : 0;
      const activeConversion = activeCount > 0 ? Math.round((highLevelCount / activeCount) * 100) : 0;

      const change7d = prev7d > 0 ? Math.round(((new7d - prev7d) / prev7d) * 100) : (new7d > 0 ? 100 : 0);

      return {
        id: ch.id,
        name: ch.name,
        code: ch.code,
        level: ch.level,
        parentId: ch.parentId,
        totalMembers,
        new30d,
        new90d,
        new7d,
        prev7d,
        change7d,
        avgPoints,
        activeRate,
        conversionRate,
        activeConversion,
        budget: ch.budget,
        roi: ch.budget && totalMembers > 0 ? +(totalMembers / ch.budget).toFixed(2) : null
      };
    });

    res.json(channelStats);
  } catch (error) {
    logger.error('Error fetching channel stats overview', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/trend', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const startDate = daysAgo(parseInt(days));

    const members = await prisma.member.findMany({
      where: {
        sourceChannelId: { in: accessibleIds },
        joinDate: { gte: startDate }
      },
      select: {
        sourceChannelId: true,
        joinDate: true,
        sourceChannel: { select: { id: true, name: true } }
      }
    });

    const trendMap = new Map();
    members.forEach(m => {
      const date = m.joinDate.toISOString().split('T')[0];
      const chId = m.sourceChannelId;
      if (!trendMap.has(chId)) {
        trendMap.set(chId, { channelId: chId, channelName: m.sourceChannel?.name || 'Unknown', data: {} });
      }
      trendMap.get(chId).data[date] = (trendMap.get(chId).data[date] || 0) + 1;
    });

    const dates = [];
    for (let i = parseInt(days) - 1; i >= 0; i--) {
      dates.push(daysAgo(i).toISOString().split('T')[0]);
    }

    const trends = Array.from(trendMap.values()).map(t => ({
      channelId: t.channelId,
      channelName: t.channelName,
      daily: dates.map(d => ({ date: d, count: t.data[d] || 0 }))
    }));

    res.json({ dates, trends });
  } catch (error) {
    logger.error('Error fetching channel trend stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/retention', async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const now = new Date();
    const thirtyDaysAgo = daysAgo(30);

    const channels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      include: {
        members: {
          select: {
            id: true,
            joinDate: true,
            signins: { select: { signinDate: true } }
          }
        }
      }
    });

    const retentionData = channels.map(ch => {
      const newMembers30d = ch.members.filter(m => m.joinDate >= thirtyDaysAgo);
      const retained = newMembers30d.filter(m => m.signins.length > 0);
      return {
        id: ch.id,
        name: ch.name,
        totalNew30d: newMembers30d.length,
        retainedCount: retained.length,
        retentionRate: newMembers30d.length > 0
          ? Math.round((retained.length / newMembers30d.length) * 100)
          : 0
      };
    });

    res.json(retentionData);
  } catch (error) {
    logger.error('Error fetching channel retention', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/sankey', async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const allChannels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      select: { id: true, name: true, level: true, parentId: true }
    });

    const channelMap = new Map(allChannels.map(c => [c.id, c]));

    const memberChannels = await prisma.member.groupBy({
      by: ['sourceChannelId'],
      where: { sourceChannelId: { in: accessibleIds } },
      _count: true
    });

    const nodes = [];
    const links = [];
    const nodeIndexMap = new Map();

    allChannels.forEach(c => {
      nodeIndexMap.set(c.id, nodes.length);
      nodes.push({ name: c.name, level: c.level });
    });

    memberChannels.forEach(mc => {
      if (!mc.sourceChannelId) return;
      let currentId = mc.sourceChannelId;
      while (channelMap.has(currentId)) {
        const ch = channelMap.get(currentId);
        if (ch.parentId && channelMap.has(ch.parentId)) {
          links.push({
            source: nodeIndexMap.get(ch.parentId),
            target: nodeIndexMap.get(ch.id),
            value: mc._count
          });
        }
        currentId = ch.parentId;
      }
    });

    res.json({ nodes, links });
  } catch (error) {
    logger.error('Error fetching channel sankey data', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/top', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const accessibleIds = await getAccessibleChannelIds(req.user);

    const channels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      include: { _count: { select: { members: true } } },
      orderBy: { members: { _count: 'desc' } },
      take: parseInt(limit)
    });

    res.json(channels.map(c => ({
      id: c.id,
      name: c.name,
      code: c.code,
      memberCount: c._count.members
    })));
  } catch (error) {
    logger.error('Error fetching top channels', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/alerts', async (req, res) => {
  try {
    const accessibleIds = await getAccessibleChannelIds(req.user);
    const sevenDaysAgo = daysAgo(7);
    const fourteenDaysAgo = daysAgo(14);

    const channels = await prisma.channel.findMany({
      where: { id: { in: accessibleIds }, isActive: true },
      include: {
        members: { select: { joinDate: true } }
      }
    });

    const alerts = [];
    channels.forEach(ch => {
      const new7d = ch.members.filter(m => m.joinDate >= sevenDaysAgo).length;
      const prev7d = ch.members.filter(m => m.joinDate >= fourteenDaysAgo && m.joinDate < sevenDaysAgo).length;

      if (prev7d >= 5) {
        const change = prev7d > 0 ? ((new7d - prev7d) / prev7d) * 100 : 0;
        if (change <= -50) {
          alerts.push({
            channelId: ch.id,
            channelName: ch.name,
            type: 'decline',
            severity: change <= -70 ? 'high' : 'medium',
            message: `近7日新增骤降 ${Math.abs(Math.round(change))}%（${prev7d} → ${new7d}）`,
            new7d,
            prev7d,
            changePercent: Math.round(change)
          });
        } else if (change >= 100) {
          alerts.push({
            channelId: ch.id,
            channelName: ch.name,
            type: 'surge',
            severity: 'info',
            message: `近7日新增激增 ${Math.round(change)}%（${prev7d} → ${new7d}）`,
            new7d,
            prev7d,
            changePercent: Math.round(change)
          });
        }
      }
    });

    res.json(alerts);
  } catch (error) {
    logger.error('Error fetching channel alerts', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
