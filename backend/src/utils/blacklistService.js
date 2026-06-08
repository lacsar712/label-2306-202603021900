const prisma = require('./prisma');
const logger = require('./logger');

const checkBlacklisted = async (memberIdOrPhone, actionType, tx = prisma) => {
  const where = { status: 'ACTIVE' };
  if (typeof memberIdOrPhone === 'number') {
    where.memberId = memberIdOrPhone;
  } else {
    where.phone = memberIdOrPhone;
  }

  const blacklist = await tx.blacklist.findFirst({ where });
  return blacklist || null;
};

const checkAndBlock = async (memberId, phone, actionType, operatorId, actionDetail, tx = prisma) => {
  const blacklist = await checkBlacklisted(memberId || phone, actionType, tx);
  if (blacklist) {
    await tx.blacklistAuditLog.create({
      data: {
        blacklistId: blacklist.id,
        memberId,
        phone,
        actionType,
        actionDetail,
        blocked: true,
        operatorId,
      },
    });
    return {
      blocked: true,
      blacklist,
      message: `该会员已被列入黑名单，原因：${blacklist.reason}`,
    };
  }
  return { blocked: false };
};

const releaseBlacklist = async (blacklistId, releaseReason, releasedBy, restoreOnRelease, tx = prisma) => {
  const blacklist = await tx.blacklist.findUnique({ where: { id: blacklistId } });
  if (!blacklist) {
    throw new Error('Blacklist record not found');
  }
  if (blacklist.status !== 'ACTIVE') {
    throw new Error(`Cannot release blacklist in status: ${blacklist.status}`);
  }

  const shouldRestore = restoreOnRelease !== undefined ? restoreOnRelease : blacklist.restoreOnRelease;

  const updated = await tx.blacklist.update({
    where: { id: blacklistId },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
      releasedBy,
      releaseReason,
    },
  });

  if (shouldRestore && blacklist.memberId) {
    const member = await tx.member.findUnique({ where: { id: blacklist.memberId } });
    if (member && member.status === 'SUSPENDED') {
      await tx.member.update({
        where: { id: blacklist.memberId },
        data: { status: 'ACTIVE' },
      });
    }
  }

  return updated;
};

const getOrCreateConfig = async () => {
  let config = await prisma.blacklistConfig.findFirst();
  if (!config) {
    config = await prisma.blacklistConfig.create({
      data: {
        autoReleaseEnabled: true,
        restoreOnAutoRelease: true,
      },
    });
  }
  return config;
};

const processExpiredBlacklists = async () => {
  const config = await getOrCreateConfig();
  if (!config.autoReleaseEnabled) {
    logger.info('Auto release is disabled, skipping.');
    return { processed: 0 };
  }

  const now = new Date();
  const expired = await prisma.blacklist.findMany({
    where: {
      status: 'ACTIVE',
      expectedReleaseAt: { lte: now },
    },
  });

  let processed = 0;
  for (const bl of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        await releaseBlacklist(
          bl.id,
          '到期自动解除',
          null,
          config.restoreOnAutoRelease,
          tx
        );
      });
      processed++;
    } catch (error) {
      logger.error(`Failed to auto-release blacklist ${bl.id}`, { error: error.message });
    }
  }

  logger.info(`Auto-released ${processed} expired blacklist records.`);
  return { processed };
};

const getBlacklistStats = async () => {
  const [total, active, byCategory, allRecords] = await Promise.all([
    prisma.blacklist.count(),
    prisma.blacklist.count({ where: { status: 'ACTIVE' } }),
    prisma.blacklist.groupBy({
      by: ['category'],
      _count: true,
    }),
    prisma.blacklist.findMany({
      where: { status: { in: ['ACTIVE', 'RELEASED', 'PENDING_APPROVAL', 'REJECTED'] } },
      select: {
        id: true,
        memberId: true,
        phone: true,
        memberName: true,
        category: true,
        reason: true,
        addedAt: true,
        releasedAt: true,
        status: true,
        expectedReleaseAt: true,
      },
      orderBy: { addedAt: 'desc' },
    }),
  ]);

  const categoryStats = byCategory.map((g) => ({
    category: g.category,
    count: g._count,
    percentage: total > 0 ? ((g._count / total) * 100).toFixed(2) : 0,
  }));

  const completedRecords = allRecords.filter((r) => r.releasedAt && r.addedAt);
  const avgDurationMs = completedRecords.length > 0
    ? completedRecords.reduce((sum, r) => sum + (new Date(r.releasedAt) - new Date(r.addedAt)), 0) / completedRecords.length
    : 0;
  const avgDurationDays = (avgDurationMs / (1000 * 60 * 60 * 24)).toFixed(2);

  const memberGroups = {};
  for (const r of allRecords) {
    const key = r.memberId || r.phone;
    if (!memberGroups[key]) {
      memberGroups[key] = {
        key,
        memberId: r.memberId,
        phone: r.phone,
        memberName: r.memberName,
        count: 0,
        records: [],
      };
    }
    memberGroups[key].count++;
    memberGroups[key].records.push({
      id: r.id,
      category: r.category,
      reason: r.reason,
      addedAt: r.addedAt,
      releasedAt: r.releasedAt,
      status: r.status,
      expectedReleaseAt: r.expectedReleaseAt,
    });
  }

  const repeatOffenderList = Object.values(memberGroups)
    .filter((m) => m.count > 1)
    .sort((a, b) => b.count - a.count)
    .map((m) => ({
      ...m,
      lastAddedAt: m.records.length > 0 ? m.records[0].addedAt : null,
      currentActive: m.records.some((r) => r.status === 'ACTIVE' || r.status === 'PENDING_APPROVAL'),
    }));

  const pendingApproval = await prisma.blacklist.count({ where: { status: 'PENDING_APPROVAL' } });

  return {
    total,
    active,
    pendingApproval,
    released: allRecords.filter((r) => r.status === 'RELEASED').length,
    categoryStats,
    avgDurationDays: parseFloat(avgDurationDays),
    repeatOffenders: repeatOffenderList.length,
    repeatOffenderList,
  };
};

module.exports = {
  checkBlacklisted,
  checkAndBlock,
  releaseBlacklist,
  getOrCreateConfig,
  processExpiredBlacklists,
  getBlacklistStats,
};
