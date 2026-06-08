const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const { z } = require('zod');
const {
  BlacklistCreateSchema,
  BlacklistBatchCreateSchema,
  BlacklistReleaseSchema,
  BlacklistBatchReleaseSchema,
  BlacklistApprovalSchema,
  BlacklistQuerySchema,
  BlacklistAuditLogQuerySchema,
  BlacklistConfigSchema,
} = require('../validations/schemas');
const {
  releaseBlacklist,
  getOrCreateConfig,
  getBlacklistStats,
} = require('../utils/blacklistService');

router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, category, dateFrom, dateTo, page, pageSize } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { memberName: { contains: search } },
        { reason: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (category) where.category = category;
    if (dateFrom || dateTo) {
      where.addedAt = {};
      if (dateFrom) where.addedAt.gte = new Date(dateFrom);
      if (dateTo) where.addedAt.lte = new Date(dateTo);
    }

    const skip = page ? (parseInt(page) - 1) * (parseInt(pageSize) || 20) : undefined;
    const take = pageSize ? parseInt(pageSize) : undefined;

    const [list, total] = await Promise.all([
      prisma.blacklist.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          member: { select: { id: true, name: true, phone: true, level: true, status: true } },
          addedByUser: { select: { id: true, username: true } },
          approvedByUser: { select: { id: true, username: true } },
          releasedByUser: { select: { id: true, username: true } },
        },
      }),
      prisma.blacklist.count({ where }),
    ]);

    res.json({ list, total, page: page ? parseInt(page) : 1, pageSize: pageSize ? parseInt(pageSize) : total });
  } catch (error) {
    logger.error('Error fetching blacklist', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/check', authenticate, async (req, res) => {
  try {
    const { memberId, phone } = req.query;
    if (!memberId && !phone) {
      return res.status(400).json({ error: 'memberId or phone is required' });
    }

    const where = { status: 'ACTIVE' };
    if (memberId) where.memberId = parseInt(memberId);
    if (phone) where.phone = phone;

    const blacklist = await prisma.blacklist.findFirst({
      where,
      include: {
        member: { select: { id: true, name: true, phone: true } },
      },
    });

    res.json({ isBlacklisted: !!blacklist, blacklist });
  } catch (error) {
    logger.error('Error checking blacklist', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await getBlacklistStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching blacklist stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/audit-logs', authenticate, async (req, res) => {
  try {
    const { phone, memberId, actionType, dateFrom, dateTo, page, pageSize } = req.query;
    const where = {};

    if (phone) where.phone = phone;
    if (memberId) where.memberId = parseInt(memberId);
    if (actionType) where.actionType = actionType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = page ? (parseInt(page) - 1) * (parseInt(pageSize) || 20) : undefined;
    const take = pageSize ? parseInt(pageSize) : undefined;

    const [list, total] = await Promise.all([
      prisma.blacklistAuditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          operator: { select: { id: true, username: true } },
        },
      }),
      prisma.blacklistAuditLog.count({ where }),
    ]);

    res.json({ list, total, page: page ? parseInt(page) : 1, pageSize: pageSize ? parseInt(pageSize) : total });
  } catch (error) {
    logger.error('Error fetching audit logs', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/config', authenticate, async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(config);
  } catch (error) {
    logger.error('Error fetching blacklist config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/config', authenticate, isAdmin, async (req, res) => {
  try {
    const data = BlacklistConfigSchema.parse(req.body);
    const config = await getOrCreateConfig();
    const updated = await prisma.blacklistConfig.update({
      where: { id: config.id },
      data,
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating blacklist config', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const data = BlacklistCreateSchema.parse(req.body);

    const member = data.memberId
      ? await prisma.member.findUnique({ where: { id: data.memberId } })
      : await prisma.member.findUnique({ where: { phone: data.phone } });

    if (member && !data.memberId) {
      data.memberId = member.id;
    }

    const existingActive = await prisma.blacklist.findFirst({
      where: {
        OR: [
          { phone: data.phone, status: 'ACTIVE' },
          ...(data.memberId ? [{ memberId: data.memberId, status: 'ACTIVE' }] : []),
        ],
      },
    });
    if (existingActive) {
      return res.status(400).json({ error: '该会员已存在生效的黑名单记录' });
    }

    const initialStatus = req.user.role === 'ADMIN' ? 'ACTIVE' : 'PENDING_APPROVAL';

    const blacklist = await prisma.blacklist.create({
      data: {
        memberId: data.memberId || null,
        phone: data.phone,
        memberName: member?.name || null,
        category: data.category,
        reason: data.reason,
        evidence: data.evidence || null,
        status: initialStatus,
        addedBy: req.user.id,
        expectedReleaseAt: data.expectedReleaseAt ? new Date(data.expectedReleaseAt) : null,
        restoreOnRelease: data.restoreOnRelease !== undefined ? data.restoreOnRelease : true,
        approvedAt: initialStatus === 'ACTIVE' ? new Date() : null,
        approvedBy: initialStatus === 'ACTIVE' ? req.user.id : null,
      },
      include: {
        member: { select: { id: true, name: true, phone: true } },
        addedByUser: { select: { id: true, username: true } },
      },
    });

    if (initialStatus === 'ACTIVE' && member) {
      await prisma.member.update({
        where: { id: member.id },
        data: { status: 'SUSPENDED' },
      });
    }

    res.status(201).json(blacklist);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating blacklist', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/batch', authenticate, async (req, res) => {
  try {
    const { items } = BlacklistBatchCreateSchema.parse(req.body);
    const initialStatus = req.user.role === 'ADMIN' ? 'ACTIVE' : 'PENDING_APPROVAL';

    const results = await prisma.$transaction(async (tx) => {
      const created = [];
      const skipped = [];

      for (const item of items) {
        const member = item.memberId
          ? await tx.member.findUnique({ where: { id: item.memberId } })
          : await tx.member.findUnique({ where: { phone: item.phone } });

        if (member && !item.memberId) {
          item.memberId = member.id;
        }

        const existingActive = await tx.blacklist.findFirst({
          where: {
            OR: [
              { phone: item.phone, status: 'ACTIVE' },
              ...(item.memberId ? [{ memberId: item.memberId, status: 'ACTIVE' }] : []),
            ],
          },
        });

        if (existingActive) {
          skipped.push({ phone: item.phone, reason: '已存在生效记录' });
          continue;
        }

        const bl = await tx.blacklist.create({
          data: {
            memberId: item.memberId || null,
            phone: item.phone,
            memberName: member?.name || null,
            category: item.category,
            reason: item.reason,
            evidence: item.evidence || null,
            status: initialStatus,
            addedBy: req.user.id,
            expectedReleaseAt: item.expectedReleaseAt ? new Date(item.expectedReleaseAt) : null,
            restoreOnRelease: item.restoreOnRelease !== undefined ? item.restoreOnRelease : true,
            approvedAt: initialStatus === 'ACTIVE' ? new Date() : null,
            approvedBy: initialStatus === 'ACTIVE' ? req.user.id : null,
          },
        });

        if (initialStatus === 'ACTIVE' && member) {
          await tx.member.update({
            where: { id: member.id },
            data: { status: 'SUSPENDED' },
          });
        }

        created.push(bl);
      }

      return { created, skipped };
    });

    res.status(201).json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error batch creating blacklist', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/import/csv', authenticate, async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'CSV records are required' });
    }

    const initialStatus = req.user.role === 'ADMIN' ? 'ACTIVE' : 'PENDING_APPROVAL';
    const categoryMap = {
      '欺诈': 'FRAUD',
      '恶意投诉': 'MALICIOUS_COMPLAINT',
      '违规兑换': 'VIOLATION_EXCHANGE',
      '滥用行为': 'ABUSIVE_BEHAVIOR',
      '其他': 'OTHER',
      FRAUD: 'FRAUD',
      MALICIOUS_COMPLAINT: 'MALICIOUS_COMPLAINT',
      VIOLATION_EXCHANGE: 'VIOLATION_EXCHANGE',
      ABUSIVE_BEHAVIOR: 'ABUSIVE_BEHAVIOR',
      OTHER: 'OTHER',
    };

    const results = await prisma.$transaction(async (tx) => {
      const created = [];
      const failed = [];

      for (let i = 0; i < records.length; i++) {
        try {
          const record = records[i];
          const phone = record.phone || record.手机号;
          const categoryRaw = record.category || record.原因分类;
          const reason = record.reason || record.列入原因;

          if (!phone || !categoryRaw || !reason) {
            failed.push({ row: i + 1, record, error: '缺少必填字段' });
            continue;
          }

          const category = categoryMap[categoryRaw];
          if (!category) {
            failed.push({ row: i + 1, record, error: `无效的分类: ${categoryRaw}` });
            continue;
          }

          const member = await tx.member.findUnique({ where: { phone } });

          const existingActive = await tx.blacklist.findFirst({
            where: {
              OR: [
                { phone, status: 'ACTIVE' },
                ...(member ? [{ memberId: member.id, status: 'ACTIVE' }] : []),
              ],
            },
          });

          if (existingActive) {
            failed.push({ row: i + 1, record, error: '已存在生效记录' });
            continue;
          }

          const expectedReleaseAt = record.expectedReleaseAt || record.预计解除时间;
          const bl = await tx.blacklist.create({
            data: {
              memberId: member?.id || null,
              phone,
              memberName: member?.name || record.name || record.姓名 || null,
              category,
              reason,
              evidence: record.evidence || record.证据备注 || null,
              status: initialStatus,
              addedBy: req.user.id,
              expectedReleaseAt: expectedReleaseAt ? new Date(expectedReleaseAt) : null,
              restoreOnRelease: record.restoreOnRelease !== undefined
                ? record.restoreOnRelease
                : (record.解除时恢复状态 !== undefined ? record.解除时恢复状态 === '是' : true),
              approvedAt: initialStatus === 'ACTIVE' ? new Date() : null,
              approvedBy: initialStatus === 'ACTIVE' ? req.user.id : null,
            },
          });

          if (initialStatus === 'ACTIVE' && member) {
            await tx.member.update({
              where: { id: member.id },
              data: { status: 'SUSPENDED' },
            });
          }

          created.push(bl);
        } catch (err) {
          failed.push({ row: i + 1, record: records[i], error: err.message });
        }
      }

      return { created: created.length, failed };
    });

    res.json(results);
  } catch (error) {
    logger.error('Error importing CSV blacklist', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/approve', authenticate, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rejectReason } = BlacklistApprovalSchema.partial().parse(req.body);

    const blacklist = await prisma.blacklist.findUnique({ where: { id } });
    if (!blacklist) {
      return res.status(404).json({ error: '记录不存在' });
    }
    if (blacklist.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ error: `当前状态 ${blacklist.status} 无法审批` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.blacklist.update({
        where: { id },
        data: {
          status: rejectReason ? 'REJECTED' : 'ACTIVE',
          approvedAt: new Date(),
          approvedBy: req.user.id,
          rejectReason: rejectReason || null,
        },
      });

      if (!rejectReason && result.memberId) {
        await tx.member.update({
          where: { id: result.memberId },
          data: { status: 'SUSPENDED' },
        });
      }

      return result;
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error approving blacklist', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/release', authenticate, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { releaseReason, restoreOnRelease } = BlacklistReleaseSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      return await releaseBlacklist(id, releaseReason, req.user.id, restoreOnRelease, tx);
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error releasing blacklist', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/batch/release', authenticate, isAdmin, async (req, res) => {
  try {
    const { ids, releaseReason, restoreOnRelease } = BlacklistBatchReleaseSchema.parse(req.body);

    const results = await prisma.$transaction(async (tx) => {
      const released = [];
      const failed = [];

      for (const id of ids) {
        try {
          const result = await releaseBlacklist(id, releaseReason, req.user.id, restoreOnRelease, tx);
          released.push(result);
        } catch (err) {
          failed.push({ id, error: err.message });
        }
      }

      return { released: released.length, failed };
    });

    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error batch releasing blacklist', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const blacklist = await prisma.blacklist.findUnique({ where: { id } });
    if (!blacklist) {
      return res.status(404).json({ error: '记录不存在' });
    }
    if (blacklist.status === 'ACTIVE') {
      return res.status(400).json({ error: '生效中的黑名单记录需先解除后才能删除' });
    }

    await prisma.blacklist.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting blacklist', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/export', authenticate, async (req, res) => {
  try {
    const { search, status, category, dateFrom, dateTo } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { memberName: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (category) where.category = category;
    if (dateFrom || dateTo) {
      where.addedAt = {};
      if (dateFrom) where.addedAt.gte = new Date(dateFrom);
      if (dateTo) where.addedAt.lte = new Date(dateTo);
    }

    const records = await prisma.blacklist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        addedByUser: { select: { username: true } },
        approvedByUser: { select: { username: true } },
        releasedByUser: { select: { username: true } },
      },
    });

    const categoryLabel = {
      FRAUD: '欺诈',
      MALICIOUS_COMPLAINT: '恶意投诉',
      VIOLATION_EXCHANGE: '违规兑换',
      ABUSIVE_BEHAVIOR: '滥用行为',
      OTHER: '其他',
    };

    const statusLabel = {
      PENDING_APPROVAL: '待审批',
      ACTIVE: '已生效',
      RELEASED: '已解除',
      REJECTED: '已驳回',
    };

    const headers = ['ID', '会员姓名', '手机号', '原因分类', '列入原因', '证据备注', '状态', '列入时间', '操作人', '预计解除时间', '审批时间', '审批人', '解除时间', '解除人', '解除原因'];
    const rows = records.map((r) => [
      r.id,
      r.memberName || '',
      r.phone,
      categoryLabel[r.category] || r.category,
      r.reason,
      r.evidence || '',
      statusLabel[r.status] || r.status,
      r.addedAt.toISOString().replace('T', ' ').slice(0, 19),
      r.addedByUser?.username || '',
      r.expectedReleaseAt ? r.expectedReleaseAt.toISOString().replace('T', ' ').slice(0, 19) : '',
      r.approvedAt ? r.approvedAt.toISOString().replace('T', ' ').slice(0, 19) : '',
      r.approvedByUser?.username || '',
      r.releasedAt ? r.releasedAt.toISOString().replace('T', ' ').slice(0, 19) : '',
      r.releasedByUser?.username || '',
      r.releaseReason || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="blacklist_${Date.now()}.csv"`);
    res.send(bom + csvContent);
  } catch (error) {
    logger.error('Error exporting blacklist', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
