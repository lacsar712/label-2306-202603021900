const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin, getAccessibleChannelIds, applyChannelFilter } = require('../middleware/auth');
const { z } = require('zod');
const {
  PointsExpiryRuleSchema,
  PointsExpiryRuleUpdateSchema,
  PointsExtendSchema,
  PointsExemptSchema,
} = require('../validations/schemas');
const pointsExpiryService = require('../utils/pointsExpiryService');

router.get('/rules', authenticate, async (req, res) => {
  try {
    const rules = await prisma.pointsExpiryRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (error) {
    logger.error('Error fetching expiry rules', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/rules', authenticate, isAdmin, async (req, res) => {
  try {
    const data = PointsExpiryRuleSchema.parse(req.body);
    const rule = await prisma.pointsExpiryRule.create({
      data: {
        ...data,
        reminderDays: data.reminderDays || [],
        createdBy: req.user.id,
      },
    });
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: '该来源类型已存在对应规则' });
    }
    logger.error('Error creating expiry rule', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/rules/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = PointsExpiryRuleUpdateSchema.parse(req.body);
    const rule = await prisma.pointsExpiryRule.update({
      where: { id },
      data: {
        ...data,
        ...(data.reminderDays && { reminderDays: data.reminderDays }),
      },
    });
    res.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: '规则不存在' });
    }
    logger.error('Error updating expiry rule', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/rules/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.pointsExpiryRule.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: '规则不存在' });
    }
    logger.error('Error deleting expiry rule', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/ledger', authenticate, async (req, res) => {
  try {
    const { memberId, status, expiringSoon, expired } = req.query;
    let where = {};

    if (memberId) where.memberId = parseInt(memberId);
    if (status) where.status = status;
    if (expiringSoon === 'true') {
      const now = new Date();
      const thirtyDaysLater = new Date(now);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
      where.expireAt = { lte: thirtyDaysLater, gte: now };
      where.status = 'ACTIVE';
    }
    if (expired === 'true') {
      where.status = { in: ['EXPIRED', 'FROZEN'] };
    }

    where = await applyChannelFilter(req, where, 'member');

    const ledgers = await prisma.pointsLedger.findMany({
      where,
      include: {
        member: { select: { id: true, name: true, phone: true } },
        rule: { select: { id: true, name: true } },
      },
      orderBy: { expireAt: 'asc' },
      take: 500,
    });
    res.json(ledgers);
  } catch (error) {
    logger.error('Error fetching points ledger', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/member/:id/summary', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const summary = await pointsExpiryService.getMemberPointsSummary(id);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching member points summary', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/member/:id/ledgers', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, expiringSoon, expired } = req.query;
    const ledgers = await pointsExpiryService.getMemberLedgers(id, { status, expiringSoon, expired });
    res.json(ledgers);
  } catch (error) {
    logger.error('Error fetching member ledgers', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/member/:id/extend', authenticate, isAdmin, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const { ledgerIds, extendDays, remark } = PointsExtendSchema.parse(req.body);
    const result = await pointsExpiryService.extendPoints(memberId, ledgerIds, extendDays, remark, req.user.id);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error extending points', { memberId: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/member/:id/exempt', authenticate, isAdmin, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const { ledgerIds, remark } = PointsExemptSchema.parse(req.body);
    const result = await pointsExpiryService.exemptPoints(memberId, ledgerIds, remark);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error exempting points', { memberId: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const stats = await pointsExpiryService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching points expiry dashboard', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/scan', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await pointsExpiryService.processExpiredPoints();
    await pointsExpiryService.processReminders();
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Error running expiry scan', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/executions', authenticate, async (req, res) => {
  try {
    const executions = await prisma.pointsExpiryExecution.findMany({
      orderBy: { executionDate: 'desc' },
      take: 100,
    });
    res.json(executions);
  } catch (error) {
    logger.error('Error fetching expiry executions', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
