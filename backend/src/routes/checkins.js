const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const {
  SigninSchema,
  MakeupSigninSchema,
  SigninConfigSchema,
} = require('../validations/schemas');
const { applyCampaigns, saveParticipations, ACTION_TYPES } = require('../utils/campaignService');
const { checkAndBlock } = require('../utils/blacklistService');

const DEFAULT_CONFIG = {
  basePoints: 10,
  consecutiveBonusRules: [
    { days: 3, bonusPoints: 5 },
    { days: 7, bonusPoints: 10 },
    { days: 15, bonusPoints: 20 },
    { days: 30, bonusPoints: 50 },
  ],
  monthlyMakeupLimit: 3,
  makeupCostPoints: 50,
};

const getOrCreateConfig = async () => {
  let config = await prisma.signinConfig.findFirst();
  if (!config) {
    config = await prisma.signinConfig.create({
      data: {
        basePoints: DEFAULT_CONFIG.basePoints,
        consecutiveBonusRules: DEFAULT_CONFIG.consecutiveBonusRules,
        monthlyMakeupLimit: DEFAULT_CONFIG.monthlyMakeupLimit,
        makeupCostPoints: DEFAULT_CONFIG.makeupCostPoints,
      },
    });
  }
  return config;
};

const calculateConsecutiveDays = async (memberId, signinDate, tx) => {
  const dayBefore = new Date(signinDate);
  dayBefore.setDate(dayBefore.getDate() - 1);

  const lastSignin = await tx.memberSignin.findFirst({
    where: {
      memberId,
      signinDate: { lte: dayBefore },
    },
    orderBy: { signinDate: 'desc' },
  });

  if (!lastSignin) return 1;

  const diffTime = signinDate.getTime() - lastSignin.signinDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return lastSignin.consecutiveDays + 1;
  }
  return 1;
};

const calculateBasePoints = (consecutiveDays, config) => {
  const basePoints = config.basePoints || DEFAULT_CONFIG.basePoints;
  const rules = config.consecutiveBonusRules || DEFAULT_CONFIG.consecutiveBonusRules;

  let consecutiveBonus = 0;
  const sortedRules = [...rules].sort((a, b) => b.days - a.days);
  for (const rule of sortedRules) {
    if (consecutiveDays >= rule.days) {
      consecutiveBonus = rule.bonusPoints;
      break;
    }
  }

  return { basePoints, consecutiveBonus, totalPoints: basePoints + consecutiveBonus };
};

const getMonthDateRange = (year, month) => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
};

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const stripTime = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

router.get('/config', authenticate, async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (error) {
    logger.error('Error fetching signin config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/config', authenticate, async (req, res) => {
  try {
    const validatedData = SigninConfigSchema.parse(req.body);
    const config = await getOrCreateConfig();

    const updated = await prisma.signinConfig.update({
      where: { id: config.id },
      data: {
        basePoints: validatedData.basePoints,
        consecutiveBonusRules: validatedData.consecutiveBonusRules,
        monthlyMakeupLimit: validatedData.monthlyMakeupLimit,
        makeupCostPoints: validatedData.makeupCostPoints,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating signin config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { memberId } = SigninSchema.parse(req.body);
    const today = stripTime(new Date());
    const config = await getOrCreateConfig();

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: '会员不存在' });

    const blockCheck = await checkAndBlock(memberId, member.phone, 'SIGNIN', req.user.id, '签到管理签到');
    if (blockCheck.blocked) {
      return res.status(403).json({ error: blockCheck.message });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.memberSignin.findFirst({
        where: { memberId, signinDate: today },
      });
      if (existing) throw Object.assign(new Error('今日已签到'), { status: 400 });

      const memberTx = await tx.member.findUnique({ where: { id: memberId } });
      if (!memberTx) throw Object.assign(new Error('会员不存在'), { status: 404 });

      const consecutiveDays = await calculateConsecutiveDays(memberId, today, tx);
      const { basePoints, consecutiveBonus, totalPoints } = calculateBasePoints(consecutiveDays, config);

      const applied = await applyCampaigns(ACTION_TYPES.SIGNIN, memberId, totalPoints);

      const signin = await tx.memberSignin.create({
        data: {
          memberId,
          signinDate: today,
          points: applied.finalValue,
          consecutiveDays,
          isMakeup: false,
          makeupCostPoints: 0,
        },
      });

      await tx.member.update({
        where: { id: memberId },
        data: { points: { increment: applied.finalValue } },
      });

      await tx.memberPointsLog.create({
        data: {
          memberId,
          changePoints: applied.finalValue,
          balanceAfter: memberTx.points + applied.finalValue,
          reason: 'SIGNIN',
          campaignId: applied.participations.length > 0 ? applied.participations[0].campaignId : null,
        },
      });

      await saveParticipations(applied.participations, tx);

      return {
        signin,
        basePoints,
        consecutiveBonus,
        campaignBonus: applied.totalBonus,
        finalPoints: applied.finalValue,
        consecutiveDays,
        campaignsHit: applied.participations.map((p) => p.ruleHitDetail),
      };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error during signin', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/makeup', authenticate, async (req, res) => {
  try {
    const { memberId, signinDate } = MakeupSigninSchema.parse(req.body);
    const targetDate = stripTime(new Date(signinDate));
    const today = stripTime(new Date());
    const config = await getOrCreateConfig();

    if (targetDate >= today) {
      return res.status(400).json({ error: '只能补签过去的日期' });
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: '会员不存在' });

    const blockCheck = await checkAndBlock(memberId, member.phone, 'SIGNIN', req.user.id, `补签: ${signinDate}`);
    if (blockCheck.blocked) {
      return res.status(403).json({ error: blockCheck.message });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.memberSignin.findFirst({
        where: { memberId, signinDate: targetDate },
      });
      if (existing) throw Object.assign(new Error('该日期已签到'), { status: 400 });

      const memberTx = await tx.member.findUnique({ where: { id: memberId } });
      if (!memberTx) throw Object.assign(new Error('会员不存在'), { status: 404 });

      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
      const makeupCountThisMonth = await tx.memberSignin.count({
        where: {
          memberId,
          isMakeup: true,
          signinDate: { gte: monthStart, lte: monthEnd },
        },
      });

      if (makeupCountThisMonth >= config.monthlyMakeupLimit) {
        throw Object.assign(new Error(`本月补签次数已达上限 (${config.monthlyMakeupLimit}次)`), { status: 400 });
      }

      if (memberTx.points < config.makeupCostPoints) {
        throw Object.assign(new Error(`积分不足，补签需要 ${config.makeupCostPoints} 积分`), { status: 400 });
      }

      const consecutiveDays = await calculateConsecutiveDays(memberId, targetDate, tx);
      const { basePoints, consecutiveBonus, totalPoints } = calculateBasePoints(consecutiveDays, config);
      const netPoints = totalPoints - config.makeupCostPoints;

      const signin = await tx.memberSignin.create({
        data: {
          memberId,
          signinDate: targetDate,
          points: totalPoints,
          consecutiveDays,
          isMakeup: true,
          makeupCostPoints: config.makeupCostPoints,
        },
      });

      await tx.member.update({
        where: { id: memberId },
        data: { points: { increment: netPoints } },
      });

      await tx.memberPointsLog.create({
        data: {
          memberId,
          changePoints: totalPoints,
          balanceAfter: memberTx.points + netPoints + config.makeupCostPoints - totalPoints + totalPoints,
          reason: 'SIGNIN_MAKEUP',
        },
      });

      await tx.memberPointsLog.create({
        data: {
          memberId,
          changePoints: -config.makeupCostPoints,
          balanceAfter: memberTx.points + netPoints,
          reason: 'SIGNIN_MAKEUP_COST',
        },
      });

      return {
        signin,
        basePoints,
        consecutiveBonus,
        earnedPoints: totalPoints,
        costPoints: config.makeupCostPoints,
        netPoints,
        consecutiveDays,
      };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error during makeup signin', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/member/:memberId/calendar', authenticate, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const { year, month } = req.query;

    const now = new Date();
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const targetMonth = month ? parseInt(month) : now.getMonth();

    const { start, end } = getMonthDateRange(targetYear, targetMonth);

    const signins = await prisma.memberSignin.findMany({
      where: {
        memberId,
        signinDate: { gte: start, lte: end },
      },
      orderBy: { signinDate: 'asc' },
    });

    const daysInMonth = getDaysInMonth(targetYear, targetMonth);
    const calendar = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(targetYear, targetMonth, day);
      const signin = signins.find(
        (s) => s.signinDate.getFullYear() === date.getFullYear() &&
               s.signinDate.getMonth() === date.getMonth() &&
               s.signinDate.getDate() === date.getDate()
      );

      calendar.push({
        date: date.toISOString().slice(0, 10),
        day,
        status: signin
          ? (signin.isMakeup ? 'makeup' : 'signed')
          : (date < stripTime(new Date()) ? 'missed' : 'future'),
        points: signin?.points || 0,
        consecutiveDays: signin?.consecutiveDays || 0,
        isMakeup: signin?.isMakeup || false,
        makeupCostPoints: signin?.makeupCostPoints || 0,
      });
    }

    const latestSignin = signins.length > 0 ? signins[signins.length - 1] : null;
    const currentStreak = latestSignin ? latestSignin.consecutiveDays : 0;

    res.json({
      year: targetYear,
      month: targetMonth,
      calendar,
      currentStreak,
      totalSigned: signins.filter((s) => !s.isMakeup).length,
      totalMakeup: signins.filter((s) => s.isMakeup).length,
    });
  } catch (error) {
    logger.error('Error fetching signin calendar', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/member/:memberId/history', authenticate, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const { page = 1, pageSize = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const [signins, total] = await Promise.all([
      prisma.memberSignin.findMany({
        where: { memberId },
        orderBy: { signinDate: 'desc' },
        skip,
        take: parseInt(pageSize),
      }),
      prisma.memberSignin.count({ where: { memberId } }),
    ]);

    res.json({
      list: signins,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (error) {
    logger.error('Error fetching signin history', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, memberId } = req.query;

    const where = {};
    if (startDate) where.signinDate = { ...where.signinDate, gte: new Date(startDate) };
    if (endDate) where.signinDate = { ...where.signinDate, lte: new Date(endDate) };
    if (memberId) where.memberId = parseInt(memberId);

    const signins = await prisma.memberSignin.findMany({
      where,
      include: { member: { select: { id: true, name: true, phone: true } } },
      orderBy: { signinDate: 'desc' },
    });

    const totalSignins = signins.length;
    const normalSignins = signins.filter((s) => !s.isMakeup).length;
    const makeupSignins = signins.filter((s) => s.isMakeup).length;
    const totalPoints = signins.reduce((sum, s) => sum + s.points, 0);
    const uniqueMembers = new Set(signins.map((s) => s.memberId)).size;

    const streakDistribution = {};
    for (const s of signins) {
      const streak = s.consecutiveDays;
      let bucket;
      if (streak >= 30) bucket = '30+';
      else if (streak >= 15) bucket = '15-29';
      else if (streak >= 7) bucket = '7-14';
      else if (streak >= 3) bucket = '3-6';
      else bucket = '1-2';
      streakDistribution[bucket] = (streakDistribution[bucket] || 0) + 1;
    }

    const dailyStats = {};
    for (const s of signins) {
      const day = s.signinDate.toISOString().slice(0, 10);
      if (!dailyStats[day]) {
        dailyStats[day] = { date: day, count: 0, makeup: 0, points: 0 };
      }
      dailyStats[day].count += 1;
      if (s.isMakeup) dailyStats[day].makeup += 1;
      dailyStats[day].points += s.points;
    }

    const allMembers = memberId
      ? await prisma.member.count({ where: { id: parseInt(memberId) } })
      : await prisma.member.count();
    const signinRate = allMembers > 0 ? ((uniqueMembers / allMembers) * 100).toFixed(2) : 0;

    res.json({
      totalSignins,
      normalSignins,
      makeupSignins,
      totalPoints,
      uniqueMembers,
      totalMembers: allMembers,
      signinRate: parseFloat(signinRate),
      streakDistribution,
      dailyTrend: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      list: signins,
    });
  } catch (error) {
    logger.error('Error fetching signin stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/export', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, memberId } = req.query;

    const where = {};
    if (startDate) where.signinDate = { ...where.signinDate, gte: new Date(startDate) };
    if (endDate) where.signinDate = { ...where.signinDate, lte: new Date(endDate) };
    if (memberId) where.memberId = parseInt(memberId);

    const signins = await prisma.memberSignin.findMany({
      where,
      include: { member: { select: { id: true, name: true, phone: true, level: true } } },
      orderBy: { signinDate: 'desc' },
    });

    const headers = ['会员ID', '会员姓名', '手机号', '会员等级', '签到日期', '获得积分', '连续签到天数', '是否补签', '补签消耗积分', '签到时间'];
    const rows = signins.map((s) => [
      s.member.id,
      s.member.name,
      s.member.phone,
      s.member.level,
      s.signinDate.toISOString().slice(0, 10),
      s.points,
      s.consecutiveDays,
      s.isMakeup ? '是' : '否',
      s.makeupCostPoints,
      s.createdAt.toISOString().replace('T', ' ').slice(0, 19),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
    ].join('\n');

    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="signin_records_${Date.now()}.csv"`);
    res.send(bom + csvContent);
  } catch (error) {
    logger.error('Error exporting signin records', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
