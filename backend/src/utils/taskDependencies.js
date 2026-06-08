const prisma = require('./prisma');

const checkDependenciesMet = async (taskId) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const dependencies = await prisma.taskDependency.findMany({
    where: { childTaskId: parseInt(taskId) },
    include: { parentTask: true },
  });

  for (let i = 0; i < dependencies.length; i++) {
    const dep = dependencies[i];
    const lastLog = await prisma.taskExecutionLog.findFirst({
      where: {
        taskId: dep.parentTaskId,
        status: 'SUCCESS',
        createdAt: { gte: startOfDay },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!lastLog) return false;
  }
  return true;
};

const listDependencies = async (taskId) => {
  return await prisma.taskDependency.findMany({
    where: { OR: [{ parentTaskId: parseInt(taskId) }, { childTaskId: parseInt(taskId) }] },
    include: {
      parentTask: { select: { id: true, name: true, displayName: true } },
      childTask: { select: { id: true, name: true, displayName: true } },
    },
  });
};

const addDependency = async (parentTaskId, childTaskId) => {
  return await prisma.taskDependency.upsert({
    where: {
      parentTaskId_childTaskId: {
        parentTaskId: parseInt(parentTaskId),
        childTaskId: parseInt(childTaskId),
      },
    },
    update: {},
    create: {
      parentTaskId: parseInt(parentTaskId),
      childTaskId: parseInt(childTaskId),
    },
  });
};

const removeDependency = async (dependencyId) => {
  return await prisma.taskDependency.delete({
    where: { id: parseInt(dependencyId) },
  });
};

module.exports = {
  checkDependenciesMet,
  listDependencies,
  addDependency,
  removeDependency,
};
