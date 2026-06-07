const prisma = require('./prisma');
const logger = require('./logger');

const DEFAULT_VALID_DAYS = 365;

const mapReasonToSourceType = (reason) => {
  const mapping = {
    'SIGNIN': 'SIGNIN',
    'POINTS_ADJUST': 'ADJUST',
    'EXCHANGE': 'CONSUMPTION',
    'CONSUMPTION': 'CONSUMPTION',
    'ACTIVITY': 'ACTIVITY',
    'CAMPAIGN': 'ACTIVITY',
  };
  return mapping[reason] || 'OTHER';
};

const getRuleBySourceType = async (sourceType) => {
  return await prisma.pointsExpiryRule.findFirst({
    where: { sourceType, isEnabled: true },
  });
};

const getAllEnabledRules = async () => {
  return await prisma.pointsExpiryRule.findMany({
    where: { isEnabled: true },
  });
};

const calculateExpireAt = async (sourceType, earnedAt = new Date()) => {
  const rule = await getRuleBySourceType(sourceType);
  const validDays = rule ? rule.validDays : DEFAULT_VALID_DAYS;
  const expireAt = new Date(earnedAt);
  expireAt.setDate(expireAt.getDate() + validDays);
  expireAt.setHours(23, 59, 59, 999);
  return { expireAt, ruleId: rule?.id || null };
};

const createPointsLedger = async (tx, { memberId, points, sourceType, earnedAt, campaignId, sourceLogId, reason }) => {
  if (points <= 0) return null;
  const resolvedSourceType = sourceType || mapReasonToSourceType(reason);
  const { expireAt, ruleId } = await calculateExpireAt(resolvedSourceType, earnedAt);
  return await tx.pointsLedger.create({
    data: {
      memberId,
      ruleId,
      sourceType: resolvedSourceType,
      originalPoints: points,
      remainingPoints: points,
      earnedAt: earnedAt || new Date(),
      expireAt,
      campaignId,
      sourceLogId,
      status: 'ACTIVE',
    },
  });
};

const consumePointsByFIFO = async (tx, memberId, pointsToConsume) => {
  if (pointsToConsume <= 0) return { consumed: 0, insufficient: false };

  const activeLedgers = await tx.pointsLedger.findMany({
    where: { memberId, status: 'ACTIVE', remainingPoints: { gt: 0 }, exempted: false },
    orderBy: { earnedAt: 'asc' },
  });

  let remainingToConsume = pointsToConsume;
  const updatedLedgers = [];

  for (const ledger of activeLedgers) {
    if (remainingToConsume <= 0) break;
    const deduct = Math.min(ledger.remainingPoints, remainingToConsume);
    const newRemaining = ledger.remainingPoints - deduct;
    await tx.pointsLedger.update({
      where: { id: ledger.id },
      data: {
        remainingPoints: newRemaining,
        status: newRemaining <= 0 ? 'CONSUMED' : 'ACTIVE',
      },
    });
    updatedLedgers.push({ id: ledger.id, deducted: deduct });
    remainingToConsume -= deduct;
  }

  const insufficient = remainingToConsume > 0;
  const actualConsumed = pointsToConsume - remainingToConsume;
  return { consumed: actualConsumed, insufficient, updatedLedgers };
};

const getMemberPointsSummary = async (memberId) => {
  const now = new Date();
  const thirtyDaysLater = new Date(now);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const [member, activeSum, frozenSum, expiringSoon, expiredList] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId }, select: { points: true, frozenPoints: true } }),
    prisma.pointsLedger.aggregate({
      where: { memberId, status: 'ACTIVE', remainingPoints: { gt: 0 }, exempted: false },
      _sum: { remainingPoints: true },
    }),
    prisma.pointsLedger.aggregate({
      where: { memberId, status: 'FROZEN', remainingPoints: { gt: 0 } },
      _sum: { remainingPoints: true },
    }),
    prisma.pointsLedger.findMany({
      where: {
        memberId,
        status: 'ACTIVE',
        remainingPoints: { gt: 0 },
        exempted: false,
        expireAt: { lte: thirtyDaysLater, gte: now },
      },
      orderBy: { expireAt: 'asc' },
      include: { rule: { select: { id: true, name: true } } },
    }),
    prisma.pointsLedger.findMany({
      where: {
        memberId,
        status: { in: ['EXPIRED', 'FROZEN'] },
      },
      orderBy: { expireAt: 'desc' },
      take: 20,
      include: { rule: { select: { id: true, name: true } } },
    }),
  ]);

  const expiringSoonPoints = expiringSoon.reduce((sum, l) => sum + l.remainingPoints, 0);

  return {
    effectivePoints: activeSum._sum.remainingPoints || 0,
    frozenPoints: frozenSum._sum.remainingPoints || 0,
    memberPoints: member?.points || 0,
    memberFrozenPoints: member?.frozenPoints || 0,
    expiringSoon: {
      totalPoints: expiringSoonPoints,
      ledgers: expiringSoon,
    },
    expiredLedgers: expiredList,
  };
};

const getMemberLedgers = async (memberId, filters = {}) => {
  const where = { memberId };
  if (filters.status) where.status = filters.status;
  if (filters.expiringSoon === 'true') {
    const now = new Date();
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    where.expireAt = { lte: thirtyDaysLater, gte: now };
    where.status = 'ACTIVE';
  }
  if (filters.expired === 'true') {
    where.status = { in: ['EXPIRED', 'FROZEN'] };
  }
  return await prisma.pointsLedger.findMany({
    where,
    orderBy: { expireAt: 'asc' },
    include: { rule: { select: { id: true, name: true } } },
  });
};

const getDashboardStats = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [expiringThisMonth, executions] = await Promise.all([
    prisma.pointsLedger.findMany({
      where: {
        status: 'ACTIVE',
        remainingPoints: { gt: 0 },
        exempted: false,
        expireAt: { gte: now, lte: endOfMonth },
      },
      include: { member: { select: { id: true, name: true, phone: true } } },
      orderBy: { expireAt: 'asc' },
    }),
    prisma.pointsExpiryExecution.findMany({
      orderBy: { executionDate: 'desc' },
      take: 30,
    }),
  ]);

  const memberSet = new Set();
  let totalExpiringPoints = 0;
  expiringThisMonth.forEach((l) => {
    memberSet.add(l.memberId);
    totalExpiringPoints += l.remainingPoints;
  });

  return {
    expiringThisMonth: {
      totalPoints: totalExpiringPoints,
      affectedMembers: memberSet.size,
      ledgers: expiringThisMonth.slice(0, 50),
    },
    executionHistory: executions,
  };
};

const processExpiredPoints = async () => {
  logger.info('Starting points expiry processing...');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const rules = await getAllEnabledRules();
  const handleTypeMap = {};
  rules.forEach((r) => {
    handleTypeMap[r.id] = r.handleType;
  });

  const expiredLedgers = await prisma.pointsLedger.findMany({
    where: {
      status: 'ACTIVE',
      remainingPoints: { gt: 0 },
      exempted: false,
      expireAt: { lt: now },
    },
    orderBy: { earnedAt: 'asc' },
    include: { member: { select: { id: true, points: true, frozenPoints: true } } },
  });

  if (expiredLedgers.length === 0) {
    logger.info('No expired points found.');
    return { processed: 0 };
  }

  const byHandleType = { CLEAR_ALL: [], FIFO_DEDUCT: [], TRANSFER_FROZEN: [] };
  expiredLedgers.forEach((l) => {
    const handleType = l.ruleId ? handleTypeMap[l.ruleId] || 'CLEAR_ALL' : 'CLEAR_ALL';
    byHandleType[handleType].push(l);
  });

  const results = {};

  if (byHandleType.CLEAR_ALL.length > 0) {
    results.CLEAR_ALL = await handleClearAll(byHandleType.CLEAR_ALL, today);
  }

  if (byHandleType.TRANSFER_FROZEN.length > 0) {
    results.TRANSFER_FROZEN = await handleTransferFrozen(byHandleType.TRANSFER_FROZEN, today);
  }

  if (byHandleType.FIFO_DEDUCT.length > 0) {
    results.FIFO_DEDUCT = await handleFIFODeduct(byHandleType.FIFO_DEDUCT, today);
  }

  logger.info(`Points expiry processing complete.`, results);
  return results;
};

const handleClearAll = async (ledgers, today) => {
  const memberPointsDelta = {};
  let totalPoints = 0;
  const affectedMemberIds = new Set();

  for (const ledger of ledgers) {
    if (!memberPointsDelta[ledger.memberId]) memberPointsDelta[ledger.memberId] = 0;
    memberPointsDelta[ledger.memberId] -= ledger.remainingPoints;
    totalPoints += ledger.remainingPoints;
    affectedMemberIds.add(ledger.memberId);
  }

  await prisma.$transaction(async (tx) => {
    for (const ledger of ledgers) {
      await tx.pointsLedger.update({
        where: { id: ledger.id },
        data: { status: 'EXPIRED', remainingPoints: 0 },
      });
    }

    for (const [memberId, delta] of Object.entries(memberPointsDelta)) {
      await tx.member.update({
        where: { id: parseInt(memberId) },
        data: { points: { increment: delta } },
      });
      await tx.memberPointsLog.create({
        data: {
          memberId: parseInt(memberId),
          changePoints: delta,
          balanceAfter: (ledgers.find(l => l.memberId === parseInt(memberId))?.member?.points || 0) + delta,
          reason: 'POINTS_EXPIRED',
        },
      });
    }

    await tx.pointsExpiryExecution.upsert({
      where: { executionDate_handledType: { executionDate: today, handledType: 'CLEAR_ALL' } },
      update: {
        totalExpiredPoints: { increment: totalPoints },
        affectedMembers: affectedMemberIds.size,
      },
      create: {
        executionDate: today,
        handledType: 'CLEAR_ALL',
        totalExpiredPoints: totalPoints,
        affectedMembers: affectedMemberIds.size,
      },
    });
  });

  return { totalPoints, affectedMembers: affectedMemberIds.size, ledgerCount: ledgers.length };
};

const handleTransferFrozen = async (ledgers, today) => {
  const memberDelta = {};
  let totalPoints = 0;
  const affectedMemberIds = new Set();

  for (const ledger of ledgers) {
    if (!memberDelta[ledger.memberId]) memberDelta[ledger.memberId] = { points: 0, frozen: 0 };
    memberDelta[ledger.memberId].points -= ledger.remainingPoints;
    memberDelta[ledger.memberId].frozen += ledger.remainingPoints;
    totalPoints += ledger.remainingPoints;
    affectedMemberIds.add(ledger.memberId);
  }

  await prisma.$transaction(async (tx) => {
    for (const ledger of ledgers) {
      await tx.pointsLedger.update({
        where: { id: ledger.id },
        data: { status: 'FROZEN', remainingPoints: ledger.remainingPoints },
      });
    }

    for (const [memberId, delta] of Object.entries(memberDelta)) {
      await tx.member.update({
        where: { id: parseInt(memberId) },
        data: {
          points: { increment: delta.points },
          frozenPoints: { increment: delta.frozen },
        },
      });
      await tx.memberPointsLog.create({
        data: {
          memberId: parseInt(memberId),
          changePoints: delta.points,
          balanceAfter: (ledgers.find(l => l.memberId === parseInt(memberId))?.member?.points || 0) + delta.points,
          reason: 'POINTS_FROZEN',
        },
      });
    }

    await tx.pointsExpiryExecution.upsert({
      where: { executionDate_handledType: { executionDate: today, handledType: 'TRANSFER_FROZEN' } },
      update: {
        totalExpiredPoints: { increment: totalPoints },
        totalFrozenPoints: { increment: totalPoints },
        affectedMembers: affectedMemberIds.size,
      },
      create: {
        executionDate: today,
        handledType: 'TRANSFER_FROZEN',
        totalExpiredPoints: totalPoints,
        totalFrozenPoints: totalPoints,
        affectedMembers: affectedMemberIds.size,
      },
    });
  });

  return { totalPoints, affectedMembers: affectedMemberIds.size, ledgerCount: ledgers.length };
};

const handleFIFODeduct = async (ledgers, today) => {
  return await handleClearAll(ledgers, today);
};

const processReminders = async () => {
  logger.info('Starting points reminder processing...');
  const now = new Date();
  const rules = await getAllEnabledRules();

  const allReminderDays = new Set();
  rules.forEach((r) => {
    if (Array.isArray(r.reminderDays)) {
      r.reminderDays.forEach((d) => allReminderDays.add(d));
    }
  });

  if (allReminderDays.size === 0) {
    logger.info('No reminder days configured.');
    return { processed: 0 };
  }

  const reminders = [];
  for (const days of allReminderDays) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    targetDate.setHours(23, 59, 59, 999);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    const ledgers = await prisma.pointsLedger.findMany({
      where: {
        status: 'ACTIVE',
        remainingPoints: { gt: 0 },
        exempted: false,
        expireAt: { gte: dayStart, lte: targetDate },
      },
    });

    for (const ledger of ledgers) {
      const existing = await prisma.pointsReminderLog.findFirst({
        where: { ledgerId: ledger.id, reminderDays: days },
      });
      if (!existing) {
        reminders.push({
          memberId: ledger.memberId,
          ledgerId: ledger.id,
          reminderDays: days,
          pointsAmount: ledger.remainingPoints,
          expireAt: ledger.expireAt,
        });
      }
    }
  }

  if (reminders.length > 0) {
    await prisma.pointsReminderLog.createMany({ data: reminders });
  }

  logger.info(`Points reminder processing complete. Generated ${reminders.length} reminders.`);
  return { generated: reminders.length };
};

const extendPoints = async (memberId, ledgerIds, extendDays, remark, operatorId) => {
  const where = ledgerIds && ledgerIds.length > 0
    ? { memberId, id: { in: ledgerIds }, status: 'ACTIVE', remainingPoints: { gt: 0 } }
    : { memberId, status: 'ACTIVE', remainingPoints: { gt: 0 } };

  const ledgers = await prisma.pointsLedger.findMany({ where });
  if (ledgers.length === 0) return { extended: 0 };

  await prisma.$transaction(async (tx) => {
    for (const ledger of ledgers) {
      const newExpireAt = new Date(ledger.expireAt);
      newExpireAt.setDate(newExpireAt.getDate() + extendDays);
      await tx.pointsLedger.update({
        where: { id: ledger.id },
        data: {
          expireAt: newExpireAt,
          extendedDays: ledger.extendedDays + extendDays,
          remark: remark || ledger.remark,
        },
      });
    }
  });

  return { extended: ledgers.length, extendDays };
};

const exemptPoints = async (memberId, ledgerIds, remark) => {
  const where = ledgerIds && ledgerIds.length > 0
    ? { memberId, id: { in: ledgerIds }, status: 'ACTIVE', exempted: false }
    : { memberId, status: 'ACTIVE', exempted: false };

  const ledgers = await prisma.pointsLedger.findMany({ where });
  if (ledgers.length === 0) return { exempted: 0 };

  const totalExemptPoints = ledgers.reduce((sum, l) => sum + l.remainingPoints, 0);

  await prisma.$transaction(async (tx) => {
    for (const ledger of ledgers) {
      await tx.pointsLedger.update({
        where: { id: ledger.id },
        data: { exempted: true, status: 'EXEMPTED', remark: remark || ledger.remark },
      });
    }

    await tx.member.update({
      where: { id: memberId },
      data: { points: { increment: totalExemptPoints } },
    });

    await tx.memberPointsLog.create({
      data: {
        memberId,
        changePoints: totalExemptPoints,
        reason: 'POINTS_EXEMPTED',
      },
    });
  });

  return { exempted: ledgers.length, totalExemptPoints };
};

module.exports = {
  createPointsLedger,
  consumePointsByFIFO,
  getMemberPointsSummary,
  getMemberLedgers,
  getDashboardStats,
  processExpiredPoints,
  processReminders,
  extendPoints,
  exemptPoints,
  mapReasonToSourceType,
  calculateExpireAt,
};
