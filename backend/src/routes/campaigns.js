const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { CampaignSchema, CampaignUpdateSchema, CampaignStatusTransitionSchema, CampaignEnabledToggleSchema } = require('../validations/schemas');
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

router.get('/meta', authenticate, async (req, res) => {
  try {
    const channels = await prisma.channel.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
    const members = await prisma.member.findMany({
      where: { tags: { not: null } },
      select: { tags: true },
    });
    const tagSet = new Set();
    for (const m of members) {
      if (Array.isArray(m.tags)) {
        for (const t of m.tags) tagSet.add(t);
      }
    }
    const tags = Array.from(tagSet).sort();
    res.json({ channels, tags });
  } catch (error) {
    logger.error('Error fetching campaign meta', { error: error.message });
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

    const restrictedFields = ['name', 'type', 'ruleParams', 'startTime', 'endTime', 'applicableLevels', 'applicableTags', 'applicableChannels', 'participationLimit', 'mutualExclusionGroup', 'priority', 'status'];
    const hasRestricted = Object.keys(data).some((k) => restrictedFields.includes(k));
    if (hasRestricted && (existing.status === 'ACTIVE' || existing.status === 'ENDED' || existing.status === 'VOID')) {
      return res.status(400).json({ error: 'Cannot modify campaign core fields in current status' });
    }

    const updateData = { ...data };
    if (data.applicableLevels !== undefined) {
      updateData.applicableLevels = data.applicableLevels;
    }
    if (data.applicableTags !== undefined) {
      updateData.applicableTags = data.applicableTags;
    }
    if (data.applicableChannels !== undefined) {
      updateData.applicableChannels = data.applicableChannels;
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
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

router.post('/:id/enabled', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { enabled } = CampaignEnabledToggleSchema.parse(req.body);
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });

    if (enabled && existing.mutualExclusionGroup && existing.status === 'ACTIVE') {
      const conflict = await prisma.campaign.findFirst({
        where: {
          id: { not: id },
          status: 'ACTIVE',
          enabled: true,
          mutualExclusionGroup: existing.mutualExclusionGroup,
          startTime: { lte: existing.endTime },
          endTime: { gte: existing.startTime },
        },
      });
      if (conflict) {
        return res.status(400).json({
          error: `Conflict with existing enabled active campaign in the same mutual exclusion group: ${conflict.name}`,
        });
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: { enabled },
    });
    res.json(campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error toggling campaign enabled', { id: req.params.id, error: error.message });
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
