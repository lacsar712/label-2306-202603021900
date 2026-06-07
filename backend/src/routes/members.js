const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { MemberSchema, PointsUpdateSchema } = require('../validations/schemas');
const { z } = require('zod');

const CLOSED_TICKET_STATUSES = ['CLOSED', 'REJECTED'];

// Get all members
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, level, status } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } }
      ];
    }
    if (level) where.level = level;
    if (status) where.status = status;

    const members = await prisma.member.findMany({
      where,
      include: {
        _count: {
          select: {
            tickets: true,
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
      joinDate: m.joinDate,
      updatedAt: m.updatedAt,
      totalTickets: m._count.tickets,
      openTickets: m.tickets.length,
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
    const member = await prisma.member.create({
      data: validatedData
    });
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
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
    
    const member = await prisma.member.update({
      where: { id },
      data: {
        points: {
          increment: points
        }
      }
    });
    
    res.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating member points', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
