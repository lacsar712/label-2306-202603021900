const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { authenticate, isAdmin } = require('../middleware/auth');
const taskService = require('../utils/taskService');
const taskScheduler = require('../utils/taskScheduler');
const { z } = require('zod');

router.get('/dashboard', authenticate, isAdmin, async (req, res) => {
  try {
    const stats = await taskService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching task dashboard stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { module, status } = req.query;
    const filters = {};
    if (module) filters.module = module;
    if (status) filters.status = status;
    const tasks = await taskService.listTasks(filters);
    res.json(tasks);
  } catch (error) {
    logger.error('Error listing tasks', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/handlers', authenticate, isAdmin, async (req, res) => {
  try {
    res.json(taskService.listHandlers());
  } catch (error) {
    logger.error('Error listing handlers', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    logger.error('Error fetching task', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const CreateTaskSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  cronExpression: z.string().min(5),
  description: z.string().optional(),
  module: z.enum(['POINTS', 'BLACKLIST', 'CAMPAIGN', 'MEMBER', 'TICKET', 'REFERRAL', 'SYSTEM']),
  handler: z.string().min(1),
  timeoutSeconds: z.number().int().positive().default(300),
  maxRetryCount: z.number().int().min(0).default(3),
  retryIntervalSeconds: z.number().int().positive().default(60),
  failureThreshold: z.number().int().positive().default(5),
  isEnabled: z.boolean().default(true),
});

router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const validated = CreateTaskSchema.parse(req.body);
    const existing = await prisma.scheduledTask.findUnique({ where: { name: validated.name } });
    if (existing) return res.status(400).json({ error: 'Task name already exists' });

    const task = await taskService.createTask(validated);
    if (task.isEnabled) await taskScheduler.rescheduleTask(task.id);
    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating task', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const UpdateTaskSchema = z.object({
  displayName: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  module: z.enum(['POINTS', 'BLACKLIST', 'CAMPAIGN', 'MEMBER', 'TICKET', 'REFERRAL', 'SYSTEM']).optional(),
  handler: z.string().min(1).optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  maxRetryCount: z.number().int().min(0).optional(),
  retryIntervalSeconds: z.number().int().positive().optional(),
  failureThreshold: z.number().int().positive().optional(),
  isEnabled: z.boolean().optional(),
});

router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const validated = UpdateTaskSchema.parse(req.body);
    const task = await taskService.updateTask(req.params.id, validated);
    if (validated.isEnabled !== undefined || validated.cronExpression !== undefined) {
      await taskScheduler.rescheduleTask(task.id);
    }
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating task', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const CronUpdateSchema = z.object({
  cronExpression: z.string().min(5),
});

router.put('/:id/cron', authenticate, isAdmin, async (req, res) => {
  try {
    const validated = CronUpdateSchema.parse(req.body);
    const task = await taskService.updateTaskCron(req.params.id, validated.cronExpression);
    await taskScheduler.rescheduleTask(task.id);
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error updating task cron', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/trigger', authenticate, isAdmin, async (req, res) => {
  try {
    const task = await prisma.scheduledTask.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const result = await taskService.executeTask(req.params.id, 'MANUAL');
    if (result === null) {
      return res.status(400).json({ error: 'Task cannot be executed (paused/disabled/already running)' });
    }
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Error triggering task', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/pause', authenticate, isAdmin, async (req, res) => {
  try {
    const task = await taskService.pauseTask(req.params.id);
    taskScheduler.stopTask(task.id);
    res.json(task);
  } catch (error) {
    logger.error('Error pausing task', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/:id/resume', authenticate, isAdmin, async (req, res) => {
  try {
    const task = await taskService.resumeTask(req.params.id);
    await taskScheduler.rescheduleTask(task.id);
    res.json(task);
  } catch (error) {
    logger.error('Error resuming task', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/logs', authenticate, isAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const result = await taskService.getExecutionLogs(req.params.id, { page, pageSize, status });
    res.json(result);
  } catch (error) {
    logger.error('Error fetching task logs', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/:id/dependencies', authenticate, isAdmin, async (req, res) => {
  try {
    const deps = await taskService.listDependencies(req.params.id);
    res.json(deps);
  } catch (error) {
    logger.error('Error listing dependencies', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const DependencySchema = z.object({
  parentTaskId: z.number().int().positive(),
  childTaskId: z.number().int().positive(),
});

router.post('/dependencies', authenticate, isAdmin, async (req, res) => {
  try {
    const validated = DependencySchema.parse(req.body);
    if (validated.parentTaskId === validated.childTaskId) {
      return res.status(400).json({ error: 'Task cannot depend on itself' });
    }
    const dep = await taskService.addDependency(validated.parentTaskId, validated.childTaskId);
    res.status(201).json(dep);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error adding dependency', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/dependencies/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await taskService.removeDependency(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing dependency', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/notifications', authenticate, isAdmin, async (req, res) => {
  try {
    const { level, status } = req.query;
    const notifications = await taskService.listNotifications({ level, status });
    res.json(notifications);
  } catch (error) {
    logger.error('Error listing notifications', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/notifications/:id/read', authenticate, isAdmin, async (req, res) => {
  try {
    const notif = await taskService.markNotificationRead(req.params.id);
    res.json(notif);
  } catch (error) {
    logger.error('Error marking notification read', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
