const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const {
  CreateTicketSchema,
  UpdateTicketSchema,
  TicketReplySchema,
  TicketAssignSchema,
  TicketCollaboratorSchema,
  AssignmentRuleSchema,
  TicketListQuerySchema,
} = require('../validations/schemas');
const { z } = require('zod');

const STATUS_TRANSITIONS = {
  PENDING_ASSIGN: ['PENDING_PROCESS', 'REJECTED'],
  PENDING_PROCESS: ['PROCESSING', 'PENDING_ASSIGN', 'REJECTED'],
  PROCESSING: ['PENDING_REVIEW', 'CLOSED', 'PENDING_PROCESS'],
  PENDING_REVIEW: ['PROCESSING', 'CLOSED'],
  CLOSED: [],
  REJECTED: ['PENDING_PROCESS'],
};

const CLOSED_STATUSES = ['CLOSED', 'REJECTED'];

const computeSlaDeadline = async (category, priority) => {
  const rule = await prisma.ticketAssignmentRule.findUnique({
    where: { category },
  });
  let hours = rule?.slaHours || 24;
  const priorityMultiplier = { LOW: 2, MEDIUM: 1, HIGH: 0.5, URGENT: 0.25 };
  hours = hours * (priorityMultiplier[priority] || 1);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

const getDefaultAssignee = async (category) => {
  const rule = await prisma.ticketAssignmentRule.findUnique({
    where: { category },
    select: { defaultAssigneeId: true },
  });
  return rule?.defaultAssigneeId || null;
};

router.get('/', authenticate, async (req, res) => {
  try {
    const validatedQuery = TicketListQuerySchema.parse(req.query);
    const {
      search, status, priority, category, assigneeId, memberId,
      dateFrom, dateTo, slaTimeout,
    } = validatedQuery;
    const page = parseInt(validatedQuery.page) || 1;
    const pageSize = parseInt(validatedQuery.pageSize) || 20;

    const where = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { member: { name: { contains: search } } },
        { member: { phone: { contains: search } } },
      ];
    }
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (assigneeId) where.assigneeId = parseInt(assigneeId);
    if (memberId) where.memberId = parseInt(memberId);
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59');
    }
    if (slaTimeout) {
      const now = new Date();
      if (slaTimeout === 'true') {
        where.AND = [
          { slaDeadline: { not: null } },
          { slaDeadline: { lt: now } },
          { status: { notIn: CLOSED_STATUSES } },
        ];
      } else {
        where.AND = [
          {
            OR: [
              { slaDeadline: { gte: now } },
              { slaDeadline: null },
              { status: { in: CLOSED_STATUSES } },
            ],
          },
        ];
      }
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          member: { select: { id: true, name: true, phone: true } },
          assignee: { select: { id: true, username: true } },
          collaborators: {
            include: { user: { select: { id: true, username: true } } },
          },
          _count: { select: { replies: true, attachments: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    const now = new Date();
    const enrichedTickets = tickets.map((t) => {
      const isClosed = CLOSED_STATUSES.includes(t.status);
      let slaRemaining = null;
      let slaOverdue = false;
      if (t.slaDeadline && !isClosed) {
        const diff = t.slaDeadline.getTime() - now.getTime();
        slaRemaining = diff;
        slaOverdue = diff < 0;
      }
      return { ...t, slaRemaining, slaOverdue };
    });

    res.json({
      data: enrichedTickets,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error fetching tickets', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [byStatus, byPriority, byCategory, total] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } }),
      prisma.ticket.count(),
    ]);

    const overdue = await prisma.ticket.count({
      where: {
        slaDeadline: { lt: now },
        status: { notIn: CLOSED_STATUSES },
      },
    });

    const assignees = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        username: true,
        assignedTickets: {
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: {
            id: true,
            status: true,
            satisfaction: true,
            createdAt: true,
            replies: {
              where: { userId: { not: null } },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    });

    const assigneeStats = assignees.map((u) => {
      const tickets = u.assignedTickets;
      const closedCount = tickets.filter((t) => CLOSED_STATUSES.includes(t.status)).length;
      const totalCount = tickets.length;
      const closeRate = totalCount > 0 ? (closedCount / totalCount) * 100 : 0;
      const ratedTickets = tickets.filter((t) => t.satisfaction !== null);
      const avgSatisfaction = ratedTickets.length > 0
        ? ratedTickets.reduce((s, t) => s + t.satisfaction, 0) / ratedTickets.length
        : null;
      const responseTimes = tickets
        .filter((t) => t.replies.length > 0)
        .map((t) => t.replies[0].createdAt.getTime() - t.createdAt.getTime());
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : null;
      return {
        userId: u.id,
        username: u.username,
        totalTickets: totalCount,
        closedCount,
        closeRate: Math.round(closeRate * 10) / 10,
        avgSatisfaction: avgSatisfaction ? Math.round(avgSatisfaction * 10) / 10 : null,
        avgResponseTimeMs: avgResponseTime,
      };
    });

    res.json({
      total,
      overdue,
      byStatus,
      byPriority,
      byCategory,
      assigneeStats,
    });
  } catch (error) {
    logger.error('Error fetching ticket stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, name: true, phone: true, email: true, level: true } },
        assignee: { select: { id: true, username: true, role: true } },
        collaborators: {
          include: { user: { select: { id: true, username: true, role: true } } },
        },
        replies: {
          include: { user: { select: { id: true, username: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: { uploader: { select: { id: true, username: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const now = new Date();
    const isClosed = CLOSED_STATUSES.includes(ticket.status);
    let slaRemaining = null;
    let slaOverdue = false;
    if (ticket.slaDeadline && !isClosed) {
      const diff = ticket.slaDeadline.getTime() - now.getTime();
      slaRemaining = diff;
      slaOverdue = diff < 0;
    }

    res.json({ ...ticket, slaRemaining, slaOverdue });
  } catch (error) {
    logger.error('Error fetching ticket', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const validatedData = CreateTicketSchema.parse(req.body);
    const currentUserId = req.user.id;

    const [slaDeadline, defaultAssigneeId] = await Promise.all([
      computeSlaDeadline(validatedData.category, validatedData.priority || 'MEDIUM'),
      getDefaultAssignee(validatedData.category),
    ]);

    const status = defaultAssigneeId ? 'PENDING_PROCESS' : 'PENDING_ASSIGN';

    const ticket = await prisma.ticket.create({
      data: {
        ...validatedData,
        assigneeId: defaultAssigneeId,
        slaDeadline,
        status,
      },
      include: {
        member: { select: { id: true, name: true, phone: true } },
        assignee: { select: { id: true, username: true } },
      },
    });

    await prisma.ticketReply.create({
      data: {
        ticketId: ticket.id,
        userId: currentUserId,
        content: `工单已创建${defaultAssigneeId ? `，已自动分配给处理人` : '，等待分配处理人'}`,
        actionType: 'CREATE',
        actionDetail: defaultAssigneeId ? `分配给用户 #${defaultAssigneeId}` : null,
      },
    });

    res.status(201).json(ticket);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating ticket', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const validatedData = UpdateTicketSchema.parse(req.body);
    const currentUserId = req.user.id;

    const existing = await prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updates = { ...validatedData };

    if (validatedData.status && existing.status !== validatedData.status) {
      const allowed = STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(validatedData.status)) {
        return res.status(400).json({
          error: `Invalid status transition from ${existing.status} to ${validatedData.status}`,
        });
      }
    }

    if (validatedData.category || validatedData.priority) {
      const newCategory = validatedData.category || existing.category;
      const newPriority = validatedData.priority || existing.priority;
      updates.slaDeadline = await computeSlaDeadline(newCategory, newPriority);
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: updates,
      include: {
        member: { select: { id: true, name: true, phone: true } },
        assignee: { select: { id: true, username: true } },
      },
    });

    const changedFields = [];
    for (const key of Object.keys(validatedData)) {
      if (existing[key] !== validatedData[key]) {
        changedFields.push(`${key}: ${existing[key]} → ${validatedData[key]}`);
      }
    }
    if (changedFields.length > 0) {
      await prisma.ticketReply.create({
        data: {
          ticketId: id,
          userId: currentUserId,
          content: `工单信息已更新`,
          actionType: 'UPDATE',
          actionDetail: changedFields.join('; '),
        },
      });
    }

    res.json(ticket);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating ticket', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/replies', authenticate, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const validatedData = TicketReplySchema.parse(req.body);
    const currentUserId = req.user.id;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const reply = await prisma.ticketReply.create({
      data: {
        ticketId,
        userId: currentUserId,
        content: validatedData.content,
        actionType: validatedData.actionType || 'REPLY',
        actionDetail: validatedData.actionDetail,
      },
      include: {
        user: { select: { id: true, username: true, role: true } },
      },
    });

    if (ticket.status === 'PENDING_ASSIGN') {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'PROCESSING' },
      });
    } else if (ticket.status === 'PENDING_PROCESS') {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'PROCESSING' },
      });
    }

    res.status(201).json(reply);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating ticket reply', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/assign', authenticate, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const validatedData = TicketAssignSchema.parse(req.body);
    const currentUserId = req.user.id;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: validatedData.assigneeId } });
    if (!user) {
      return res.status(404).json({ error: 'Assignee not found' });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assigneeId: validatedData.assigneeId,
        status: 'PENDING_PROCESS',
      },
      include: { assignee: { select: { id: true, username: true } } },
    });

    await prisma.ticketReply.create({
      data: {
        ticketId,
        userId: currentUserId,
        content: `工单已转派给 ${user.username}`,
        actionType: 'ASSIGN',
        actionDetail: `转派给用户 #${validatedData.assigneeId} (${user.username})`,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error assigning ticket', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/escalate', authenticate, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const currentUserId = req.user.id;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const priorityOrder = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const currentIdx = priorityOrder.indexOf(ticket.priority);
    if (currentIdx >= priorityOrder.length - 1) {
      return res.status(400).json({ error: 'Ticket already at highest priority' });
    }
    const newPriority = priorityOrder[currentIdx + 1];

    const newSlaDeadline = await computeSlaDeadline(ticket.category, newPriority);

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { priority: newPriority, slaDeadline: newSlaDeadline },
    });

    await prisma.ticketReply.create({
      data: {
        ticketId,
        userId: currentUserId,
        content: `优先级已从 ${ticket.priority} 升级到 ${newPriority}`,
        actionType: 'ESCALATE',
        actionDetail: `${ticket.priority} → ${newPriority}`,
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Error escalating ticket', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/collaborators', authenticate, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const validatedData = TicketCollaboratorSchema.parse(req.body);
    const currentUserId = req.user.id;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const collaborators = [];
    for (const userId of validatedData.userIds) {
      try {
        const c = await prisma.ticketCollaborator.create({
          data: { ticketId, userId },
          include: { user: { select: { id: true, username: true } } },
        });
        collaborators.push(c);
      } catch (e) {
        if (e.code !== 'P2002') throw e;
      }
    }

    if (collaborators.length > 0) {
      const names = collaborators.map((c) => c.user.username).join(', ');
      await prisma.ticketReply.create({
        data: {
          ticketId,
          userId: currentUserId,
          content: `已添加协同处理人: ${names}`,
          actionType: 'ADD_COLLABORATOR',
          actionDetail: names,
        },
      });
    }

    res.json(collaborators);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error adding collaborators', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id/collaborators/:userId', authenticate, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const currentUserId = req.user.id;

    await prisma.ticketCollaborator.deleteMany({
      where: { ticketId, userId },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.ticketReply.create({
      data: {
        ticketId,
        userId: currentUserId,
        content: `已移除协同处理人: ${user?.username || `#${userId}`}`,
        actionType: 'REMOVE_COLLABORATOR',
        actionDetail: user?.username || `#${userId}`,
      },
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Error removing collaborator', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/assignment-rules/list', authenticate, async (req, res) => {
  try {
    const rules = await prisma.ticketAssignmentRule.findMany({
      include: { defaultAssignee: { select: { id: true, username: true } } },
    });
    res.json(rules);
  } catch (error) {
    logger.error('Error fetching assignment rules', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/assignment-rules', authenticate, async (req, res) => {
  try {
    const validatedData = AssignmentRuleSchema.parse(req.body);
    const rule = await prisma.ticketAssignmentRule.upsert({
      where: { category: validatedData.category },
      create: validatedData,
      update: {
        defaultAssigneeId: validatedData.defaultAssigneeId,
        slaHours: validatedData.slaHours,
      },
      include: { defaultAssignee: { select: { id: true, username: true } } },
    });
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error saving assignment rule', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
