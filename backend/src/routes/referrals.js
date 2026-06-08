const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const {
  ReferralBindSchema,
  ReferralBindByCodeSchema,
  ReferralBindByPhoneSchema,
  ReferralCodeSchema,
  ReferralCodeUpdateSchema,
  ReferralRewardRuleSchema,
  ReferralRewardRuleUpdateSchema,
  ReferralConfigSchema,
  ReferralAnomalyMarkSchema,
} = require('../validations/schemas');
const referralService = require('../utils/referralService');

const performBind = async (referrerId, refereeId, bindChannel, referralCodeId, bindSource) => {
  return await prisma.$transaction(async (tx) => {
    const config = await referralService.getReferralConfig();

    if (referrerId === refereeId) {
      throw Object.assign(new Error('不能绑定自己为推荐人'), { status: 400 });
    }

    if (config.enableCircularCheck) {
      const isCircular = await referralService.checkCircularReferral(referrerId, refereeId);
      if (isCircular) {
        throw Object.assign(new Error('存在循环推荐关系，无法绑定'), { status: 400 });
      }
    }

    const referee = await tx.member.findUnique({ where: { id: refereeId } });
    if (!referee) throw Object.assign(new Error('被推荐会员不存在'), { status: 404 });
    if (referee.referrerId) {
      throw Object.assign(new Error('该会员已绑定推荐人'), { status: 400 });
    }

    const referrer = await tx.member.findUnique({ where: { id: referrerId } });
    if (!referrer) throw Object.assign(new Error('推荐人不存在'), { status: 404 });

    const level = await referralService.calculateReferralLevel(referrerId);
    if (level > config.maxDepth) {
      throw Object.assign(new Error(`推荐层级超过最大限制 ${config.maxDepth}`), { status: 400 });
    }

    await tx.member.update({
      where: { id: refereeId },
      data: { referrerId },
    });

    const bind = await tx.referralBind.create({
      data: {
        referrerId,
        refereeId,
        level,
        bindChannel,
        referralCodeId,
        bindSource,
        expiresAt: config.bindExpireHours > 0
          ? new Date(Date.now() + config.bindExpireHours * 3600 * 1000)
          : null,
      },
    });

    await referralService.createReferralRewards(tx, referrerId, refereeId, level);
    await referralService.processRegisterReward(tx, refereeId);

    if (config.enableAnomalyDetection) {
      await referralService.detectAnomalies(referrerId, refereeId, level);
    }

    return bind;
  });
};

router.get('/config', authenticate, async (req, res) => {
  try {
    const config = await referralService.getReferralConfig();
    res.json(config);
  } catch (error) {
    logger.error('Error fetching referral config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/config', authenticate, async (req, res) => {
  try {
    const validatedData = ReferralConfigSchema.parse(req.body);
    const existing = await prisma.referralConfig.findFirst();
    const config = existing
      ? await prisma.referralConfig.update({ where: { id: existing.id }, data: validatedData })
      : await prisma.referralConfig.create({ data: validatedData });
    res.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating referral config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/search', authenticate, async (req, res) => {
  try {
    const { phone, code } = req.query;
    const results = [];

    if (phone) {
      const members = await prisma.member.findMany({
        where: { phone: { contains: phone } },
        take: 20,
        select: { id: true, name: true, phone: true, level: true },
      });
      for (const m of members) {
        const personalCode = await prisma.referralCode.findFirst({
          where: { memberId: m.id, type: 'PERSONAL' },
        });
        results.push({ ...m, referralCode: personalCode?.code });
      }
    }

    if (code) {
      const referralCode = await prisma.referralCode.findFirst({
        where: { code: { contains: code.toUpperCase() }, isActive: true },
        include: { member: { select: { id: true, name: true, phone: true, level: true } } },
      });
      if (referralCode && referralCode.member) {
        results.push({
          ...referralCode.member,
          referralCode: referralCode.code,
          codeType: referralCode.type,
        });
      }
    }

    const unique = [];
    const seen = new Set();
    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        unique.push(r);
      }
    }

    res.json(unique);
  } catch (error) {
    logger.error('Error searching referrer', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/bind', authenticate, async (req, res) => {
  try {
    const { referrerId, refereeId, bindChannel, referralCodeId, bindSource } = ReferralBindSchema.parse(req.body);
    const result = await performBind(referrerId, refereeId, bindChannel, referralCodeId, bindSource);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '该推荐关系已存在' });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error binding referral', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/bind-by-code', authenticate, async (req, res) => {
  try {
    const { refereeId, referralCode, bindChannel, bindSource } = ReferralBindByCodeSchema.parse(req.body);

    const codeRecord = await prisma.referralCode.findUnique({
      where: { code: referralCode.toUpperCase() },
    });

    if (!codeRecord || !codeRecord.isActive) {
      return res.status(400).json({ error: '推荐码无效或已停用' });
    }
    if (codeRecord.expiresAt && new Date() > codeRecord.expiresAt) {
      return res.status(400).json({ error: '推荐码已过期' });
    }
    if (codeRecord.maxUses > 0 && codeRecord.usedCount >= codeRecord.maxUses) {
      return res.status(400).json({ error: '推荐码使用次数已达上限' });
    }
    if (!codeRecord.memberId) {
      return res.status(400).json({ error: '推荐码未关联推荐人' });
    }

    await prisma.referralCode.update({
      where: { id: codeRecord.id },
      data: { usedCount: { increment: 1 } },
    });

    const result = await performBind(
      codeRecord.memberId,
      refereeId,
      bindChannel || 'REFERRAL_CODE',
      codeRecord.id,
      bindSource || codeRecord.type
    );

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error binding referral by code', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/bind-by-phone', authenticate, async (req, res) => {
  try {
    const { refereeId, referrerPhone, bindChannel, bindSource } = ReferralBindByPhoneSchema.parse(req.body);

    const referrer = await prisma.member.findUnique({ where: { phone: referrerPhone } });
    if (!referrer) {
      return res.status(404).json({ error: '推荐人手机号不存在' });
    }

    const result = await performBind(
      referrer.id,
      refereeId,
      bindChannel || 'PHONE_SEARCH',
      null,
      bindSource || 'PHONE'
    );

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error binding referral by phone', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/unbind/:refereeId', authenticate, async (req, res) => {
  try {
    const refereeId = parseInt(req.params.refereeId);

    const referee = await prisma.member.findUnique({ where: { id: refereeId } });
    if (!referee) return res.status(404).json({ error: '会员不存在' });

    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: refereeId },
        data: { referrerId: null },
      });

      await tx.referralBind.updateMany({
        where: { refereeId, isActive: true },
        data: { isActive: false },
      });

      await tx.referralReward.updateMany({
        where: { refereeId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledReason: 'UNBIND' },
      });
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Error unbinding referral', { id: req.params.refereeId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/tree/:memberId', authenticate, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const depth = req.query.depth ? parseInt(req.query.depth) : null;
    const tree = await referralService.getReferralTree(memberId, depth);
    if (!tree) return res.status(404).json({ error: '会员不存在' });
    res.json(tree);
  } catch (error) {
    logger.error('Error fetching referral tree', { id: req.params.memberId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/binds', authenticate, async (req, res) => {
  try {
    const { referrerId, refereeId, isActive } = req.query;
    const where = {};
    if (referrerId) where.referrerId = parseInt(referrerId);
    if (refereeId) where.refereeId = parseInt(refereeId);
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const binds = await prisma.referralBind.findMany({
      where,
      include: {
        referrer: { select: { id: true, name: true, phone: true, level: true } },
        referee: { select: { id: true, name: true, phone: true, level: true, joinDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = [];
    for (const bind of binds) {
      const rewards = await prisma.referralReward.findMany({
        where: { referrerId: bind.referrerId, refereeId: bind.refereeId },
        select: { stage: true, status: true, points: true, distributedAt: true },
      });
      enriched.push({ ...bind, rewards });
    }

    res.json(enriched);
  } catch (error) {
    logger.error('Error fetching referral binds', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats/:memberId', authenticate, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const stats = await referralService.getReferralStats(memberId);
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching referral stats', { id: req.params.memberId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const data = await referralService.getLeaderboard(startDate, endDate, limit ? parseInt(limit) : 50);
    res.json(data);
  } catch (error) {
    logger.error('Error fetching referral leaderboard', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/codes', authenticate, async (req, res) => {
  try {
    const { memberId, type, isActive } = req.query;
    const where = {};
    if (memberId) where.memberId = parseInt(memberId);
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const codes = await prisma.referralCode.findMany({
      where,
      include: { member: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(codes);
  } catch (error) {
    logger.error('Error fetching referral codes', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/codes', authenticate, async (req, res) => {
  try {
    const validatedData = ReferralCodeSchema.parse(req.body);
    validatedData.code = validatedData.code.toUpperCase();

    if (validatedData.type === 'PERSONAL' && validatedData.memberId) {
      const existing = await prisma.referralCode.findFirst({
        where: { memberId: validatedData.memberId, type: 'PERSONAL' },
      });
      if (existing) {
        return res.status(400).json({ error: '该会员已有个人推荐码' });
      }
    }

    const code = await prisma.referralCode.create({ data: validatedData });
    res.status(201).json(code);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '推荐码已存在' });
    }
    logger.error('Error creating referral code', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/codes/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const code = await prisma.referralCode.findUnique({
      where: { id },
      include: { member: { select: { id: true, name: true, phone: true } } },
    });
    if (!code) return res.status(404).json({ error: '推荐码不存在' });
    res.json(code);
  } catch (error) {
    logger.error('Error fetching referral code', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/codes/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const validatedData = ReferralCodeUpdateSchema.parse(req.body);
    if (validatedData.code) validatedData.code = validatedData.code.toUpperCase();

    const code = await prisma.referralCode.update({
      where: { id },
      data: validatedData,
    });
    res.json(code);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: '推荐码不存在' });
    }
    logger.error('Error updating referral code', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/codes/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.referralCode.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting referral code', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/codes/ensure-personal/:memberId', authenticate, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const code = await referralService.ensurePersonalReferralCode(memberId);
    res.json(code);
  } catch (error) {
    logger.error('Error ensuring personal referral code', { id: req.params.memberId, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/reward-rules', authenticate, async (req, res) => {
  try {
    const rules = await prisma.referralRewardRule.findMany({ orderBy: { stage: 'asc' } });
    res.json(rules);
  } catch (error) {
    logger.error('Error fetching referral reward rules', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/reward-rules', authenticate, async (req, res) => {
  try {
    const validatedData = ReferralRewardRuleSchema.parse(req.body);
    const rule = await prisma.referralRewardRule.create({ data: validatedData });
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '该阶段的奖励规则已存在' });
    }
    logger.error('Error creating referral reward rule', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/reward-rules/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const validatedData = ReferralRewardRuleUpdateSchema.parse(req.body);
    const rule = await prisma.referralRewardRule.update({
      where: { id },
      data: validatedData,
    });
    res.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: '奖励规则不存在' });
    }
    logger.error('Error updating referral reward rule', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/reward-rules/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.referralRewardRule.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting referral reward rule', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/anomalies', authenticate, async (req, res) => {
  try {
    const { isMarked, type } = req.query;
    const data = await referralService.getAnomalies({
      isMarked: isMarked !== undefined ? isMarked === 'true' : undefined,
      type,
    });
    res.json(data);
  } catch (error) {
    logger.error('Error fetching referral anomalies', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/anomalies/:id/mark', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { isMarked } = ReferralAnomalyMarkSchema.parse(req.body);
    const anomaly = await prisma.referralAnomaly.update({
      where: { id },
      data: {
        isMarked,
        markedAt: isMarked ? new Date() : null,
      },
    });
    res.json(anomaly);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error marking referral anomaly', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/overview', authenticate, async (req, res) => {
  try {
    const totalBinds = await prisma.referralBind.count({ where: { isActive: true } });
    const totalReferrers = await prisma.member.findMany({
      where: { referrals: { some: {} } },
      select: { id: true },
    });
    const pendingRewards = await prisma.referralReward.count({ where: { status: 'PENDING' } });
    const distributedPoints = await prisma.referralReward.aggregate({
      where: { status: 'DISTRIBUTED' },
      _sum: { points: true },
    });
    const anomalyCount = await prisma.referralAnomaly.count({ where: { isMarked: false } });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newThisMonth = await prisma.referralBind.count({
      where: { isActive: true, createdAt: { gte: startOfMonth } },
    });

    res.json({
      totalBinds,
      totalReferrers: totalReferrers.length,
      pendingRewards,
      distributedPoints: distributedPoints._sum.points || 0,
      anomalyCount,
      newThisMonth,
    });
  } catch (error) {
    logger.error('Error fetching referral overview', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
