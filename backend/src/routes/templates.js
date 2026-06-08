const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');
const {
  NotificationTemplateSchema,
  NotificationTemplateUpdateSchema,
  NotificationTemplateStatusTransitionSchema,
  NotificationTemplateVersionCreateSchema,
  NotificationTemplateRollbackSchema,
  NotificationTemplatePreviewSchema,
  NotificationSendSchema,
} = require('../validations/schemas');
const { previewTemplate, DEFAULT_VARIABLES } = require('../utils/templateService');

const STATUS_TRANSITIONS = {
  DRAFT: ['PENDING_REVIEW', 'DISABLED'],
  PENDING_REVIEW: ['DRAFT', 'PUBLISHED', 'DISABLED'],
  PUBLISHED: ['DISABLED'],
  DISABLED: ['DRAFT'],
};

router.get('/variables', authenticate, async (req, res) => {
  try {
    res.json(DEFAULT_VARIABLES);
  } catch (error) {
    logger.error('Error fetching default variables', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { status, category, search, channel } = req.query;
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) where.name = { contains: search };

    const templates = await prisma.notificationTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        _count: { select: { versions: true, sendRecords: true } },
      },
    });

    const enriched = templates.map((t) => ({
      ...t,
      versionCount: t._count.versions,
      sendRecordCount: t._count.sendRecords,
      latestVersion: t.versions[0] || null,
    }));

    res.json(enriched);
  } catch (error) {
    logger.error('Error fetching templates', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const template = await prisma.notificationTemplate.findUnique({
      where: { id },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: 'desc' } },
      },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (error) {
    logger.error('Error fetching template', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const template = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const versions = await prisma.notificationTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { versionNumber: 'desc' },
    });
    res.json(versions);
  } catch (error) {
    logger.error('Error fetching template versions', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/preview', authenticate, async (req, res) => {
  try {
    const data = NotificationTemplatePreviewSchema.parse(req.body);
    const result = previewTemplate(data);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: formatZodError(error) });
    }
    logger.error('Error previewing template', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

function formatZodError(err) {
  if (err && err.errors && Array.isArray(err.errors)) {
    return err.errors.map((e) => {
      const path = e.path && e.path.length ? e.path.join('.') : '';
      return path ? `${path}: ${e.message}` : e.message;
    }).join('; ');
  }
  return '参数校验失败';
}

router.post('/', authenticate, async (req, res) => {
  try {
    const data = NotificationTemplateSchema.parse(req.body);

    const template = await prisma.$transaction(async (tx) => {
      const tpl = await tx.notificationTemplate.create({
        data: {
          name: data.name,
          category: data.category || 'OTHER',
          channels: data.channels || [],
          variables: data.variables || [],
          status: data.status || 'DRAFT',
          enabled: data.enabled !== undefined ? data.enabled : true,
        },
      });

      if (data.titleTemplate && data.contentTemplate) {
        const version = await tx.notificationTemplateVersion.create({
          data: {
            templateId: tpl.id,
            versionNumber: 1,
            titleTemplate: data.titleTemplate,
            contentTemplate: data.contentTemplate,
            channelRules: data.channelRules || {},
            remark: data.remark || '初始版本',
          },
        });

        await tx.notificationTemplate.update({
          where: { id: tpl.id },
          data: { currentVersionId: version.id },
        });

        return tx.notificationTemplate.findUnique({
          where: { id: tpl.id },
          include: { currentVersion: true },
        });
      }

      return tpl;
    });

    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: formatZodError(error) });
    }
    logger.error('Error creating template', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = NotificationTemplateUpdateSchema.parse(req.body);

    const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const needNewVersion = data.titleTemplate !== undefined || data.contentTemplate !== undefined || data.channelRules !== undefined;

    const template = await prisma.$transaction(async (tx) => {
      const updateData = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.channels !== undefined) updateData.channels = data.channels;
      if (data.variables !== undefined) updateData.variables = data.variables;
      if (data.enabled !== undefined) updateData.enabled = data.enabled;

      let tpl = await tx.notificationTemplate.update({
        where: { id },
        data: updateData,
      });

      if (needNewVersion) {
        const versions = await tx.notificationTemplateVersion.findMany({
          where: { templateId: id },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        });
        const nextVersion = versions.length > 0 ? versions[0].versionNumber + 1 : 1;

        const latest = versions[0];
        const newVersion = await tx.notificationTemplateVersion.create({
          data: {
            templateId: id,
            versionNumber: nextVersion,
            titleTemplate: data.titleTemplate !== undefined ? data.titleTemplate : (latest?.titleTemplate || ''),
            contentTemplate: data.contentTemplate !== undefined ? data.contentTemplate : (latest?.contentTemplate || ''),
            channelRules: data.channelRules !== undefined ? data.channelRules : (latest?.channelRules || {}),
            remark: data.remark || `版本 ${nextVersion}`,
          },
        });

        tpl = await tx.notificationTemplate.update({
          where: { id },
          data: { currentVersionId: newVersion.id },
          include: { currentVersion: true },
        });
      }

      return tpl;
    });

    res.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: formatZodError(error) });
    }
    logger.error('Error updating template', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/versions', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = NotificationTemplateVersionCreateSchema.parse(req.body);

    const template = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const version = await prisma.$transaction(async (tx) => {
      const versions = await tx.notificationTemplateVersion.findMany({
        where: { templateId: id },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      });
      const nextVersion = versions.length > 0 ? versions[0].versionNumber + 1 : 1;

      const v = await tx.notificationTemplateVersion.create({
        data: {
          templateId: id,
          versionNumber: nextVersion,
          titleTemplate: data.titleTemplate,
          contentTemplate: data.contentTemplate,
          channelRules: data.channelRules || {},
          remark: data.remark || `版本 ${nextVersion}`,
        },
      });

      await tx.notificationTemplate.update({
        where: { id },
        data: { currentVersionId: v.id },
      });

      return v;
    });

    res.status(201).json(version);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: formatZodError(error) });
    }
    logger.error('Error creating template version', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/rollback', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { versionId } = NotificationTemplateRollbackSchema.parse(req.body);

    const template = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const version = await prisma.notificationTemplateVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.templateId !== id) {
      return res.status(404).json({ error: 'Version not found' });
    }

    await prisma.notificationTemplate.update({
      where: { id },
      data: { currentVersionId: versionId },
    });

    res.json({ success: true, message: `已回滚到版本 ${version.versionNumber}` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: formatZodError(error) });
    }
    logger.error('Error rolling back template', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/status', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = NotificationTemplateStatusTransitionSchema.parse(req.body);

    const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const allowed = STATUS_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status transition from ${existing.status} to ${status}` });
    }

    if (status === 'PUBLISHED' && !existing.currentVersionId) {
      return res.status(400).json({ error: 'Cannot publish template without a version' });
    }

    const template = await prisma.notificationTemplate.update({
      where: { id },
      data: { status },
      include: { currentVersion: true },
    });
    res.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: formatZodError(error) });
    }
    logger.error('Error transitioning template status', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.status === 'PUBLISHED') {
      return res.status(400).json({ error: 'Cannot delete a published template' });
    }
    await prisma.notificationTemplate.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting template', { id: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/send', authenticate, async (req, res) => {
  try {
    const data = NotificationSendSchema.parse(req.body);

    const template = await prisma.notificationTemplate.findUnique({
      where: { id: data.templateId },
      include: { currentVersion: true },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Template is not published' });
    }

    let memberIds = data.memberIds || [];
    if (data.memberLevel && data.memberLevel.length > 0) {
      const members = await prisma.member.findMany({
        where: { level: { in: data.memberLevel }, status: 'ACTIVE' },
        select: { id: true },
      });
      const levelMemberIds = members.map((m) => m.id);
      memberIds = [...new Set([...memberIds, ...levelMemberIds])];
    }

    const versionId = data.templateVersionId || template.currentVersionId;

    const record = await prisma.notificationSendRecord.create({
      data: {
        templateId: data.templateId,
        templateVersionId: versionId,
        channel: data.channel,
        memberIds: memberIds,
        variables: data.variables || {},
        status: data.scheduledAt ? 'PENDING' : 'SENDING',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        totalCount: memberIds.length,
      },
    });

    if (!data.scheduledAt) {
      setTimeout(async () => {
        try {
          await prisma.notificationSendRecord.update({
            where: { id: record.id },
            data: {
              status: 'SUCCESS',
              successCount: memberIds.length,
              sentAt: new Date(),
            },
          });
        } catch (e) {
          logger.error('Error updating send record', { id: record.id, error: e.message });
        }
      }, 1000);
    }

    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: formatZodError(error) });
    }
    logger.error('Error sending notification', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/send-records/list', authenticate, async (req, res) => {
  try {
    const { templateId, status, channel, dateFrom, dateTo } = req.query;
    const where = {};
    if (templateId) where.templateId = parseInt(templateId);
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const records = await prisma.notificationSendRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { name: true } },
        templateVersion: { select: { versionNumber: true } },
      },
      take: 200,
    });
    res.json(records);
  } catch (error) {
    logger.error('Error fetching send records', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
