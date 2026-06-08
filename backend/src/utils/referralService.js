const prisma = require('./prisma');
const logger = require('./logger');

const generateReferralCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const getReferralConfig = async () => {
  let config = await prisma.referralConfig.findFirst();
  if (!config) {
    config = await prisma.referralConfig.create({
      data: {
        maxDepth: 5,
        enableCircularCheck: true,
        enableAnomalyDetection: true,
        bindExpireHours: 0,
      },
    });
  }
  return config;
};

const checkCircularReferral = async (referrerId, refereeId) => {
  if (referrerId === refereeId) return true;

  let currentId = referrerId;
  const visited = new Set();
  const config = await getReferralConfig();
  let depth = 0;

  while (currentId && depth < config.maxDepth) {
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    if (currentId === refereeId) return true;

    const member = await prisma.member.findUnique({
      where: { id: currentId },
      select: { referrerId: true },
    });
    if (!member || !member.referrerId) break;
    currentId = member.referrerId;
    depth++;
  }
  return false;
};

const calculateReferralLevel = async (referrerId) => {
  let level = 1;
  let currentId = referrerId;
  const config = await getReferralConfig();

  while (currentId && level < config.maxDepth) {
    const member = await prisma.member.findUnique({
      where: { id: currentId },
      select: { referrerId: true },
    });
    if (!member || !member.referrerId) break;
    currentId = member.referrerId;
    level++;
  }
  return level;
};

const getReferralTree = async (memberId, maxDepth = null) => {
  const config = await getReferralConfig();
  const depth = maxDepth || config.maxDepth;

  const buildTree = async (id, currentLevel = 1) => {
    if (currentLevel > depth) return null;

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        referrer: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!member) return null;

    const rewards = await prisma.referralReward.findMany({
      where: { referrerId: id },
      select: {
        stage: true,
        status: true,
        points: true,
        referee: { select: { id: true, name: true, phone: true } },
      },
    });

    const directCount = await prisma.member.count({ where: { referrerId: id } });
    const allDescendants = await getAllDescendantIds(id, depth);
    const indirectCount = allDescendants.length - directCount;

    const totalRewardPoints = rewards
      .filter((r) => r.status === 'DISTRIBUTED')
      .reduce((sum, r) => sum + r.points, 0);

    const children = await prisma.member.findMany({
      where: { referrerId: id },
      select: { id: true },
    });

    const childNodes = [];
    for (const child of children) {
      const subtree = await buildTree(child.id, currentLevel + 1);
      if (subtree) childNodes.push(subtree);
    }

    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
      level: member.level,
      joinDate: member.joinDate,
      referralLevel: currentLevel,
      directCount,
      indirectCount,
      totalRewardPoints,
      rewards,
      children: childNodes,
    };
  };

  return buildTree(memberId);
};

const getAllDescendantIds = async (memberId, maxDepth = 5) => {
  const ids = [];
  const queue = [{ id: memberId, level: 0 }];

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (level > 0) ids.push(id);
    if (level >= maxDepth) continue;

    const children = await prisma.member.findMany({
      where: { referrerId: id },
      select: { id: true },
    });
    for (const child of children) {
      queue.push({ id: child.id, level: level + 1 });
    }
  }
  return ids;
};

const detectAnomalies = async (referrerId, refereeId, level) => {
  const anomalies = [];

  if (referrerId === refereeId) {
    anomalies.push({
      referrerId,
      refereeId,
      type: 'SELF_REFERRAL',
      level,
      detail: { message: '自推荐：推荐人与被推荐人为同一人' },
    });
  }

  const config = await getReferralConfig();
  if (config.enableCircularCheck) {
    const isCircular = await checkCircularReferral(referrerId, refereeId);
    if (isCircular) {
      anomalies.push({
        referrerId,
        refereeId,
        type: 'CIRCULAR_REFERRAL',
        level,
        detail: { message: '循环推荐：存在循环引用关系' },
      });
    }
  }

  if (level > config.maxDepth) {
    anomalies.push({
      referrerId,
      refereeId,
      type: 'CROSS_LEVEL_TAMPER',
      level,
      detail: { message: `跨级篡改：层级 ${level} 超过最大限制 ${config.maxDepth}` },
    });
  }

  for (const anomaly of anomalies) {
    await prisma.referralAnomaly.create({ data: anomaly });
  }

  return anomalies;
};

const ensurePersonalReferralCode = async (memberId) => {
  let code = await prisma.referralCode.findFirst({
    where: { memberId, type: 'PERSONAL' },
  });

  if (!code) {
    let uniqueCode;
    let attempts = 0;
    do {
      uniqueCode = generateReferralCode(8);
      const existing = await prisma.referralCode.findUnique({
        where: { code: uniqueCode },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    code = await prisma.referralCode.create({
      data: {
        code: uniqueCode,
        type: 'PERSONAL',
        memberId,
        bonusPoints: 0,
        refereeBonus: 0,
      },
    });
  }

  return code;
};

const createReferralRewards = async (tx, referrerId, refereeId, level) => {
  const rules = await tx.referralRewardRule.findMany({ where: { isEnabled: true } });
  const rewards = [];

  for (const rule of rules) {
    let points = rule.points;
    if (rule.levelMultipliers && typeof rule.levelMultipliers === 'object') {
      const multiplier = rule.levelMultipliers[level] || rule.levelMultipliers['default'] || 1;
      points = Math.floor(points * multiplier);
    }

    rewards.push(
      await tx.referralReward.create({
        data: {
          referrerId,
          refereeId,
          stage: rule.stage,
          status: 'PENDING',
          points,
          targetValue: rule.targetValue,
          achievedValue: rule.stage === 'REGISTER' ? 1 : 0,
          ruleSnapshot: {
            ruleId: rule.id,
            ruleName: rule.name,
            basePoints: rule.points,
            level,
            finalPoints: points,
          },
        },
      })
    );
  }

  return rewards;
};

const processRegisterReward = async (tx, refereeId) => {
  const reward = await tx.referralReward.findFirst({
    where: { refereeId, stage: 'REGISTER', status: 'PENDING' },
  });
  if (!reward) return null;

  const updated = await tx.referralReward.update({
    where: { id: reward.id },
    data: {
      status: 'DISTRIBUTED',
      achievedValue: 1,
      distributedAt: new Date(),
    },
  });

  if (reward.points > 0) {
    await tx.member.update({
      where: { id: reward.referrerId },
      data: { points: { increment: reward.points } },
    });

    await tx.memberPointsLog.create({
      data: {
        memberId: reward.referrerId,
        changePoints: reward.points,
        balanceAfter: 0,
        reason: `REFERRAL_REGISTER_${reward.refereeId}`,
      },
    });
  }

  return updated;
};

const getReferralStats = async (memberId) => {
  const config = await getReferralConfig();

  const directCount = await prisma.member.count({ where: { referrerId: memberId } });
  const allDescendants = await getAllDescendantIds(memberId, config.maxDepth);
  const indirectCount = allDescendants.length - directCount;

  const rewards = await prisma.referralReward.findMany({
    where: { referrerId: memberId },
    select: { status: true, points: true, stage: true, createdAt: true },
  });

  const totalRewardPoints = rewards
    .filter((r) => r.status === 'DISTRIBUTED')
    .reduce((sum, r) => sum + r.points, 0);

  const pendingRewardPoints = rewards
    .filter((r) => r.status === 'PENDING')
    .reduce((sum, r) => sum + r.points, 0);

  const convertedCount = rewards.filter((r) =>
    r.stage === 'FIRST_ORDER' && r.status === 'DISTRIBUTED'
  ).length;
  const conversionRate = directCount > 0 ? convertedCount / directCount : 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const newThisMonth = await prisma.member.count({
    where: {
      referrerId: memberId,
      joinDate: { gte: startOfMonth },
    },
  });

  const stageBreakdown = {
    REGISTER: { pending: 0, distributed: 0, cancelled: 0, total: 0 },
    FIRST_ORDER: { pending: 0, distributed: 0, cancelled: 0, total: 0 },
    CONSUMPTION_TARGET: { pending: 0, distributed: 0, cancelled: 0, total: 0 },
  };

  for (const r of rewards) {
    stageBreakdown[r.stage][r.status.toLowerCase()]++;
    stageBreakdown[r.stage].total++;
  }

  return {
    memberId,
    directCount,
    indirectCount,
    totalDownline: allDescendants.length,
    totalRewardPoints,
    pendingRewardPoints,
    conversionRate: Math.round(conversionRate * 10000) / 100,
    convertedCount,
    newThisMonth,
    stageBreakdown,
  };
};

const getLeaderboard = async (startDate, endDate, limit = 50) => {
  const where = {};
  if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
  if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

  const binds = await prisma.referralBind.findMany({
    where: { isActive: true, ...where },
    select: { referrerId: true, refereeId: true, createdAt: true },
  });

  const referrerMap = new Map();
  for (const bind of binds) {
    if (!referrerMap.has(bind.referrerId)) {
      referrerMap.set(bind.referrerId, { directCount: 0, refereeIds: [] });
    }
    const data = referrerMap.get(bind.referrerId);
    data.directCount++;
    data.refereeIds.push(bind.refereeId);
  }

  const leaderboard = [];
  for (const [referrerId, data] of referrerMap.entries()) {
    const member = await prisma.member.findUnique({
      where: { id: referrerId },
      select: { id: true, name: true, phone: true, level: true },
    });
    if (!member) continue;

    const stats = await getReferralStats(referrerId);
    leaderboard.push({
      ...member,
      directCount: data.directCount,
      indirectCount: stats.indirectCount,
      totalRewardPoints: stats.totalRewardPoints,
      conversionRate: stats.conversionRate,
      newThisMonth: stats.newThisMonth,
    });
  }

  leaderboard.sort((a, b) => b.totalRewardPoints - a.totalRewardPoints || b.directCount - a.directCount);
  return leaderboard.slice(0, limit);
};

const getAnomalies = async (params = {}) => {
  const where = {};
  if (params.isMarked !== undefined) where.isMarked = params.isMarked;
  if (params.type) where.type = params.type;

  return await prisma.referralAnomaly.findMany({
    where,
    include: {
      referrer: { select: { id: true, name: true, phone: true } },
      referee: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

module.exports = {
  generateReferralCode,
  getReferralConfig,
  checkCircularReferral,
  calculateReferralLevel,
  getReferralTree,
  getAllDescendantIds,
  detectAnomalies,
  ensurePersonalReferralCode,
  createReferralRewards,
  processRegisterReward,
  getReferralStats,
  getLeaderboard,
  getAnomalies,
};
