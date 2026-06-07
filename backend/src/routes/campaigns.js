const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { CampaignSchema, CampaignUpdateSchema, CampaignStatusTransitionSchema } = require('../validations/schemas');
const { z } = require('zod');
const { getActiveCampaignsForBanner, getCampaignStats, applyCampaigns, saveParticipations, ACTION_TYPES } = require('../utils/campaignService');

const STATUS_TRANSITIONS = {
  DRAFT: ['PENDING_REVIEW', 'VOID'],
  PENDING_REVIEW: ['DRAFT', 'ACTIVE', 'VOID'],
  ACTIVE: ['ENDED', 'VOID'],
  ENDED: [],
  VOID: [],
};

router.get('/active', authenticate, async (req, res) => {
  try {
    const campaigns = await getActiveCampaignsForBanner();
    res.json(campaigns);
  } catch (error) {
    logger.error('Error fetching active campaigns', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, type, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) where.name = { contains: search };

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { participations: true } },
      },
    });

    const enriched = campaigns.map((c) => ({
      ...c,
      participationCount: c._count.participations,
    }));

    res.json(enriched);
  } catch (error) {
    logger.error('Error fetching campaigns', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: { select: { participations: true } },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ ...campaign, participationCount: campaign._count.participations });
  } catch (error) {
    logger.error('Error fetching campaign', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    const stats = await getCampaignStats(id);
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching campaign stats', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = CampaignSchema.parse(req.body);
    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        applicableLevels: data.applicableLevels || null,
        applicableTags: data.applicableTags || null,
        applicableChannels: data.applicableChannels || null,
      },
    });
    res.status(201).json(campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating campaign', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = CampaignUpdateSchema.parse(req.body);

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });
    if (existing.status === 'ACTIVE' || existing.status === 'ENDED' || existing.status === 'VOID') {
      return res.status(400).json({ error: 'Cannot modify campaign in current status' });
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...data,
        applicableLevels: data.applicableLevels !== undefined ? data.applicableLevels : existing.applicableLevels,
        applicableTags: data.applicableTags !== undefined ? data.applicableTags : existing.applicableTags,
        applicableChannels: data.applicableChannels !== undefined ? data.applicableChannels : existing.applicableChannels,
      },
    });
    res.json(campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating campaign', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/status', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = CampaignStatusTransitionSchema.parse(req.body);

    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });

    const allowed = STATUS_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status transition from ${existing.status} to ${status}` });
    }

    if (status === 'ACTIVE' && existing.mutualExclusionGroup) {
      const conflict = await prisma.campaign.findFirst({
        where: {
          id: { not: id },
          status: 'ACTIVE',
          mutualExclusionGroup: existing.mutualExclusionGroup,
          enabled: true,
          startTime: { lte: existing.endTime },
          endTime: { gte: existing.startTime },
        },
      });
      if (conflict) {
        return res.status(400).json({
          error: `Conflict with existing active campaign in the same mutual exclusion group: ${conflict.name}`,
        });
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status },
    });
    res.json(campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error transitioning campaign status', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });
    if (existing.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot delete an active campaign' });
    }
    await prisma.campaign.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting campaign', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
