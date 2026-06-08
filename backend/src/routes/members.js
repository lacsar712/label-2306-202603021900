const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, applyChannelFilter } = require('../middleware/auth');
const { MemberSchema, PointsUpdateSchema, SigninSchema, ExchangeSchema } = require('../validations/schemas');
const { z } = require('zod');
const { applyCampaigns, saveParticipations, ACTION_TYPES } = require('../utils/campaignService');
const { createPointsLedger, consumePointsByFIFO } = require('../utils/pointsExpiryService');
const referralService = require('../utils/referralService');
const { checkAndBlock } = require('../utils/blacklistService');

const CLOSED_TICKET_STATUSES = ['CLOSED', 'REJECTED'];

// Get all members
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, level, status, channelId } = req.query;
    let where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } }
      ];
    }
    if (level) where.level = level;
    if (status) where.status = status;
    if (channelId) where.sourceChannelId = parseInt(channelId);

    where = await applyChannelFilter(req, where);

    const members = await prisma.member.findMany({
      where,
      include: {
        sourceChannel: { select: { id: true, name: true, code: true } },
        referrer: { select: { id: true, name: true, phone: true } },
        referralCodes: { where: { type: 'PERSONAL' }, take: 1 },
        _count: {
          select: {
            tickets: true,
            referrals: true,
          },
        },
        tickets: {
          where: {
            status: { notIn: CLOSED_TICKET_STATUSES },
          },
          select: { id: true },
        },
      },
      orderBy: { joinDate: 'desc' }
    });

    const enriched = members.map((m) => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      email: m.email,
      level: m.level,
      status: m.status,
      points: m.points,
      tags: m.tags,
      joinDate: m.joinDate,
      updatedAt: m.updatedAt,
      sourceChannelId: m.sourceChannelId,
      sourceChannel: m.sourceChannel,
      firstTouchAt: m.firstTouchAt,
      utmSource: m.utmSource,
      utmMedium: m.utmMedium,
      utmCampaign: m.utmCampaign,
      referrerId: m.referrerId,
      referrer: m.referrer,
      referralCode: m.referralCodes[0]?.code,
      totalTickets: m._count.tickets,
      openTickets: m.tickets.length,
      directReferrals: m._count.referrals,
    }));

    res.json(enriched);
  } catch (error) {
    logger.error('Error fetching members', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get member ticket summary
router.get('/:id/tickets-summary', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tickets: true },
        },
        tickets: {
          select: {
            id: true,
            status: true,
            priority: true,
            category: true,
            satisfaction: true,
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const tickets = member.tickets;
    const openTickets = tickets.filter((t) => !CLOSED_TICKET_STATUSES.includes(t.status)).length;
    const closedTickets = tickets.filter((t) => CLOSED_TICKET_STATUSES.includes(t.status)).length;
    const ratedTickets = tickets.filter((t) => t.satisfaction !== null);
    const avgSatisfaction = ratedTickets.length > 0
      ? ratedTickets.reduce((s, t) => s + t.satisfaction, 0) / ratedTickets.length
      : null;

    const byCategory = {};
    for (const t of tickets) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    }

    res.json({
      memberId: id,
      totalTickets: member._count.tickets,
      openTickets,
      closedTickets,
      avgSatisfaction: avgSatisfaction ? Math.round(avgSatisfaction * 10) / 10 : null,
      byCategory,
    });
  } catch (error) {
    logger.error('Error fetching member ticket summary', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get member tickets
router.get('/:id/tickets', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.query;
    const where = { memberId: id };
    if (status) where.status = status;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        assignee: { select: { id: true, username: true } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tickets);
  } catch (error) {
    logger.error('Error fetching member tickets', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create member
router.post('/', authenticate, async (req, res) => {
  try {
    const validatedData = MemberSchema.parse(req.body);
    const { referrerId, ...memberData } = validatedData;

    const member = await prisma.$transaction(async (tx) => {
      const newMember = await tx.member.create({ data: memberData });

      await referralService.ensurePersonalReferralCode(newMember.id);

      if (referrerId) {
        const config = await referralService.getReferralConfig();

        if (config.enableCircularCheck) {
          const isCircular = await referralService.checkCircularReferral(referrerId, newMember.id);
          if (isCircular) {
            throw Object.assign(new Error('存在循环推荐关系，无法绑定推荐人'), { status: 400 });
          }
        }

        const referrer = await tx.member.findUnique({ where: { id: referrerId } });
        if (!referrer) {
          throw Object.assign(new Error('推荐人不存在'), { status: 400 });
        }

        const level = await referralService.calculateReferralLevel(referrerId);
        if (level > config.maxDepth) {
          throw Object.assign(new Error(`推荐层级超过最大限制 ${config.maxDepth}`), { status: 400 });
        }

        await tx.member.update({
          where: { id: newMember.id },
          data: { referrerId },
        });

        await tx.referralBind.create({
          data: {
            referrerId,
            refereeId: newMember.id,
            level,
            bindChannel: 'MEMBER_FORM',
            bindSource: 'MEMBER_CREATE',
            expiresAt: config.bindExpireHours > 0
              ? new Date(Date.now() + config.bindExpireHours * 3600 * 1000)
              : null,
          },
        });

        await referralService.createReferralRewards(tx, referrerId, newMember.id, level);
        await referralService.processRegisterReward(tx, newMember.id);

        if (config.enableAnomalyDetection) {
          await referralService.detectAnomalies(referrerId, newMember.id, level);
        }
      }

      return newMember;
    });

    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    logger.error('Error creating member', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update member
router.put('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const validatedData = MemberSchema.partial().parse(req.body);
    const member = await prisma.member.update({
      where: { id },
      data: validatedData
    });
    res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating member', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete member
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.member.delete({
      where: { id }
    });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting member', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update member points
router.post('/:id/points', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { points } = PointsUpdateSchema.parse(req.body);

    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const blockCheck = await checkAndBlock(id, member.phone, 'POINTS_ADJUST', req.user.id, `积分调整: ${points}`);
    if (blockCheck.blocked) {
      return res.status(403).json({ error: blockCheck.message });
    }

    const result = await prisma.$transaction(async (tx) => {
      const memberTx = await tx.member.findUnique({ where: { id } });
      if (!memberTx) throw Object.assign(new Error('Member not found'), { status: 404 });

      const applied = points > 0
        ? await applyCampaigns(ACTION_TYPES.POINTS_ADJUST, id, points)
        : { finalValue: points, totalBonus: 0, participations: [] };

      if (applied.finalValue < 0) {
        const { consumed, insufficient } = await consumePointsByFIFO(tx, id, Math.abs(applied.finalValue));
        if (insufficient) {
          throw Object.assign(new Error('Insufficient points in ledger'), { status: 400 });
        }
      }

      const updatedMember = await tx.member.update({
        where: { id },
        data: { points: { increment: applied.finalValue } },
      });

      const log = await tx.memberPointsLog.create({
        data: {
          memberId: id,
          changePoints: applied.finalValue,
          balanceAfter: memberTx.points + applied.finalValue,
          reason: 'POINTS_ADJUST',
          campaignId: applied.participations.length > 0 ? applied.participations[0].campaignId : null,
        },
      });

      if (applied.finalValue > 0) {
        await createPointsLedger(tx, {
          memberId: id,
          points: applied.finalValue,
          sourceType: 'ADJUST',
          campaignId: applied.participations.length > 0 ? applied.participations[0].campaignId : null,
          sourceLogId: log.id,
          reason: 'POINTS_ADJUST',
        });
      }

      await saveParticipations(applied.participations, tx);

      return {
        member: updatedMember,
        originalPoints: points,
        bonusPoints: applied.totalBonus,
        finalPoints: applied.finalValue,
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
    logger.error('Error updating member points', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Member signin
router.post('/signin', authenticate, async (req, res) => {
  try {
    const { memberId } = SigninSchema.parse(req.body);
    const today = new Date();
    const signinDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const basePoints = 10;

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const blockCheck = await checkAndBlock(memberId, member.phone, 'SIGNIN', req.user.id, '会员签到');
    if (blockCheck.blocked) {
      return res.status(403).json({ error: blockCheck.message });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.memberSignin.findFirst({
        where: { memberId, signinDate },
      });
      if (existing) throw Object.assign(new Error('Already signed in today'), { status: 400 });

      const memberTx = await tx.member.findUnique({ where: { id: memberId } });
      if (!memberTx) throw Object.assign(new Error('Member not found'), { status: 404 });

      const applied = await applyCampaigns(ACTION_TYPES.SIGNIN, memberId, basePoints);

      const signin = await tx.memberSignin.create({
        data: { memberId, signinDate, points: applied.finalValue },
      });

      await tx.member.update({
        where: { id: memberId },
        data: { points: { increment: applied.finalValue } },
      });

      const log = await tx.memberPointsLog.create({
        data: {
          memberId,
          changePoints: applied.finalValue,
          balanceAfter: memberTx.points + applied.finalValue,
          reason: 'SIGNIN',
          campaignId: applied.participations.length > 0 ? applied.participations[0].campaignId : null,
        },
      });

      if (applied.finalValue > 0) {
        await createPointsLedger(tx, {
          memberId,
          points: applied.finalValue,
          sourceType: 'SIGNIN',
          campaignId: applied.participations.length > 0 ? applied.participations[0].campaignId : null,
          sourceLogId: log.id,
          reason: 'SIGNIN',
        });
      }

      await saveParticipations(applied.participations, tx);

      return {
        signin,
        basePoints,
        bonusPoints: applied.totalBonus,
        finalPoints: applied.finalValue,
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

// Get member signin history
router.get('/:id/signins', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const signins = await prisma.memberSignin.findMany({
      where: { memberId: id },
      orderBy: { signinDate: 'desc' },
    });
    res.json(signins);
  } catch (error) {
    logger.error('Error fetching signins', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Member exchange
router.post('/exchange', authenticate, async (req, res) => {
  try {
    const { memberId, itemName, points } = ExchangeSchema.parse(req.body);

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const blockCheck = await checkAndBlock(memberId, member.phone, 'EXCHANGE', req.user.id, `兑换: ${itemName}, 积分: ${points}`);
    if (blockCheck.blocked) {
      return res.status(403).json({ error: blockCheck.message });
    }

    const result = await prisma.$transaction(async (tx) => {
      const memberTx = await tx.member.findUnique({ where: { id: memberId } });
      if (!memberTx) throw Object.assign(new Error('Member not found'), { status: 404 });

      const applied = await applyCampaigns(ACTION_TYPES.EXCHANGE, memberId, points);
      const discounted = points - applied.totalBonus;
      if (discounted < 0) throw Object.assign(new Error('Invalid discount calculation'), { status: 500 });
      if (memberTx.points < discounted) throw Object.assign(new Error('Insufficient points'), { status: 400 });

      const { consumed, insufficient } = await consumePointsByFIFO(tx, memberId, discounted);
      if (insufficient) {
        throw Object.assign(new Error('Insufficient points in ledger'), { status: 400 });
      }

      const exchange = await tx.memberExchange.create({
        data: {
          memberId,
          itemName,
          originalPoints: points,
          finalPoints: discounted,
        },
      });

      await tx.member.update({
        where: { id: memberId },
        data: { points: { decrement: discounted } },
      });

      await tx.memberPointsLog.create({
        data: {
          memberId,
          changePoints: -discounted,
          balanceAfter: memberTx.points - discounted,
          reason: 'EXCHANGE',
          campaignId: applied.participations.length > 0 ? applied.participations[0].campaignId : null,
        },
      });

      await saveParticipations(applied.participations, tx);

      return {
        exchange,
        originalPoints: points,
        discountPoints: applied.totalBonus,
        finalPoints: discounted,
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
    logger.error('Error during exchange', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get member points logs
router.get('/:id/points-logs', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const logs = await prisma.memberPointsLog.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true } },
      },
    });
    res.json(logs);
  } catch (error) {
    logger.error('Error fetching points logs', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
