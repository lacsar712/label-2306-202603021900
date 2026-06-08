const prisma = require('./prisma');

const getDashboardStats = async () => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const tasks = [
    prisma.scheduledTask.count(),
    prisma.scheduledTask.count({ where: { status: 'RUNNING' } }),
    prisma.scheduledTask.count({ where: { status: 'ERROR' } }),
    prisma.taskExecutionLog.findMany({
      where: { createdAt: { gte: startOfDay } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskExecutionLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'asc' },
    }),
  ];

  const results = await Promise.all(tasks);
  const totalTasks = results[0];
  const runningTasks = results[1];
  const errorTasks = results[2];
  const todayLogs = results[3];
  const weekLogs = results[4];

  const todaySuccess = todayLogs.filter(l => l.status === 'SUCCESS').length;
  const todayTotal = todayLogs.length;
  const todaySuccessRate = todayTotal > 0 ? todaySuccess / todayTotal : 0;

  let avgTodayDuration = 0;
  if (todayTotal > 0) {
    const sum = todayLogs.reduce((s, l) => s + (l.durationMs || 0), 0);
    avgTodayDuration = sum / todayTotal;
  }

  const dailySuccessRate = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split('T')[0];
    dailySuccessRate[key] = { success: 0, total: 0, avgDuration: 0 };
  }

  weekLogs.forEach(log => {
    const key = log.createdAt.toISOString().split('T')[0];
    if (!dailySuccessRate[key]) {
      dailySuccessRate[key] = { success: 0, total: 0, avgDuration: 0 };
    }
    dailySuccessRate[key].total++;
    if (log.status === 'SUCCESS') {
      dailySuccessRate[key].success++;
    }
    dailySuccessRate[key].avgDuration += (log.durationMs || 0);
  });

  Object.keys(dailySuccessRate).forEach(key => {
    const d = dailySuccessRate[key];
    if (d.total > 0) {
      d.avgDuration = d.avgDuration / d.total;
      d.successRate = d.success / d.total;
    } else {
      d.avgDuration = 0;
      d.successRate = 0;
    }
  });

  return {
    totalTasks: totalTasks,
    runningTasks: runningTasks,
    errorTasks: errorTasks,
    todaySuccessRate: todaySuccessRate,
    avgTodayDuration: avgTodayDuration,
    todayTotalExecutions: todayTotal,
    weekDailyTrend: dailySuccessRate,
  };
};

module.exports = {
  getDashboardStats,
};
