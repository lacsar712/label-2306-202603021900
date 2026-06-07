const prisma = require('./prisma');
const logger = require('./logger');

const ACTION_TYPES = {
  POINTS_ADJUST: 'POINTS_ADJUST',
  SIGNIN: 'SIGNIN',
  EXCHANGE: 'EXCHANGE',
};

const TYPE_ACTION_MAP = {
  DOUBLE_POINTS: [ACTION_TYPES.POINTS_ADJUST],
  SPEND_GIFT_POINTS: [ACTION_TYPES.POINTS_ADJUST],
  LEVEL_BONUS: [ACTION_TYPES.POINTS_ADJUST, ACTION_TYPES.SIGNIN],
  SIGNIN_DOUBLE: [ACTION_TYPES.SIGNIN],
  EXCHANGE_DISCOUNT: [ACTION_TYPES.EXCHANGE],
};

const isMemberEligible = (campaign, member) => {
  if (campaign.applicableLevels && campaign.applicableLevels.length > 0) {
    if (!campaign.applicableLevels.includes(member.level)) return false;
  }
  return true;
};

const isWithinTime = (campaign, now = new Date()) => {
  const start = new Date(campaign.startTime);
  const end = new Date(campaign.endTime);
  return now >= start && now <= end;
};

const hasReachedParticipationLimit = async (campaign, memberId) => {
  if (!campaign.participationLimit || campaign.participationLimit <= 0) return false;
  const count = await prisma.campaignParticipation.count({
    where: { campaignId: campaign.id, memberId },
  });
  return count >= campaign.participationLimit;
};

const findActiveCampaigns = async (actionType, member) => {
  const now = new Date();
  const matchingTypes = Object.entries(TYPE_ACTION_MAP)
    .filter(([, actions]) => actions.includes(actionType))
    .map(([type]) => type);

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: 'ACTIVE',
      enabled: true,
      type: { in: matchingTypes },
      startTime: { lte: now },
      endTime: { gte: now },
    },
    orderBy: { priority: 'desc' },
  });

  const eligible = [];
  for (const c of campaigns) {
    if (!isMemberEligible(c, member)) continue;
    if (await hasReachedParticipationLimit(c, member.id)) continue;
    eligible.push(c);
  }

  const result = [];
  const usedGroups = new Set();
  for (const c of eligible) {
    if (c.mutualExclusionGroup) {
      if (usedGroups.has(c.mutualExclusionGroup)) continue;
      usedGroups.add(c.mutualExclusionGroup);
    }
    result.push(c);
  }
  return result;
};

const computeBonus = (campaign, actionType, originalValue, member) => {
  const params = campaign.ruleParams || {};
  let bonus = 0;
  const hitDetail = { campaignId: campaign.id, campaignName: campaign.name, type: campaign.type };

  switch (campaign.type) {
    case 'DOUBLE_POINTS': {
      const multiplier = params.multiplier || 2;
      bonus = Math.floor(originalValue * (multiplier - 1));
      hitDetail.multiplier = multiplier;
      break;
    }
    case 'SPEND_GIFT_POINTS': {
      const threshold = params.threshold || 100;
      const giftPoints = params.giftPoints || 50;
      if (originalValue >= threshold) {
        bonus = giftPoints;
        hitDetail.threshold = threshold;
        hitDetail.giftPoints = giftPoints;
      }
      break;
    }
    case 'LEVEL_BONUS': {
      const levelBonus = params.levelBonus || {};
      const bonusPct = levelBonus[member.level] || 0;
      bonus = Math.floor(originalValue * (bonusPct / 100));
      hitDetail.level = member.level;
      hitDetail.bonusPct = bonusPct;
      break;
    }
    case 'SIGNIN_DOUBLE': {
      const multiplier = params.multiplier || 2;
      bonus = Math.floor(originalValue * (multiplier - 1));
      hitDetail.multiplier = multiplier;
      break;
    }
    case 'EXCHANGE_DISCOUNT': {
      const discountPct = params.discountPct || 10;
      bonus = Math.floor(originalValue * (discountPct / 100));
      hitDetail.discountPct = discountPct;
      break;
    }
  }

  return { bonus, hitDetail };
};

const applyCampaigns = async (actionType, memberId, originalValue) => {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { finalValue: originalValue, totalBonus: 0, participations: [] };

  const campaigns = await findActiveCampaigns(actionType, member);
  if (campaigns.length === 0) return { finalValue: originalValue, totalBonus: 0, participations: [] };

  let currentValue = originalValue;
  let totalBonus = 0;
  const participations = [];

  for (const campaign of campaigns) {
    const { bonus, hitDetail } = computeBonus(campaign, actionType, currentValue, member);
    if (bonus <= 0) continue;
    totalBonus += bonus;
    participations.push({
      campaignId: campaign.id,
      memberId,
      actionType,
      originalValue,
      bonusValue: bonus,
      finalValue: originalValue + totalBonus,
      ruleHitDetail: hitDetail,
    });
    currentValue += bonus;
  }

  return {
    finalValue: currentValue,
    totalBonus,
    participations,
  };
};

const saveParticipations = async (participations, tx) => {
  if (!participations || participations.length === 0) return;
  const db = tx || prisma;
  await db.campaignParticipation.createMany({ data: participations });
};

const getActiveCampaignsForBanner = async () => {
  const now = new Date();
  return prisma.campaign.findMany({
    where: {
      status: 'ACTIVE',
      enabled: true,
      startTime: { lte: now },
      endTime: { gte: now },
    },
    orderBy: { priority: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      endTime: true,
      priority: true,
    },
  });
};

const getCampaignStats = async (campaignId) => {
  const participations = await prisma.campaignParticipation.findMany({
    where: { campaignId },
    select: {
      memberId: true,
      bonusValue: true,
      createdAt: true,
      ruleHitDetail: true,
    },
  });

  const uniqueMembers = new Set(participations.map((p) => p.memberId));
  const totalBonus = participations.reduce((s, p) => s + p.bonusValue, 0);

  const byDay = {};
  for (const p of participations) {
    const day = p.createdAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { count: 0, bonus: 0 };
    byDay[day].count += 1;
    byDay[day].bonus += p.bonusValue;
  }

  const dailyTrend = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const ruleDetails = participations.map((p) => ({
    memberId: p.memberId,
    createdAt: p.createdAt,
    bonusValue: p.bonusValue,
    detail: p.ruleHitDetail,
  }));

  return {
    participationCount: participations.length,
    uniqueMemberCount: uniqueMembers.size,
    totalBonusPoints: totalBonus,
    dailyTrend,
    ruleDetails,
  };
};

module.exports = {
  ACTION_TYPES,
  findActiveCampaigns,
  computeBonus,
  applyCampaigns,
  saveParticipations,
  getActiveCampaignsForBanner,
  getCampaignStats,
};
