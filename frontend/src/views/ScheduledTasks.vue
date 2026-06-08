<template>
  <div class="scheduled-tasks">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">任务监控</h2>
        <p class="page-subtitle">管理和监控系统中的所有定时任务</p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="refreshAll">
          <el-icon class="mr-4"><Refresh /></el-icon>刷新
        </el-button>
        <el-button v-if="authStore.isAdmin" type="success" @click="openCreateDialog">
          <el-icon class="mr-4"><Plus /></el-icon>新建任务
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="dashboard-cards">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon total-icon">
              <el-icon :size="28"><List /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ dashboard.totalTasks || 0 }}</div>
              <div class="stat-label">任务总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon running-icon">
              <el-icon :size="28"><VideoPlay /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ dashboard.runningTasks || 0 }}</div>
              <div class="stat-label">运行中</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon success-icon">
              <el-icon :size="28"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ (dashboard.todaySuccessRate * 100).toFixed(1) }}%</div>
              <div class="stat-label">今日成功率</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-icon error-icon">
              <el-icon :size="28"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value" :class="{'error-text': dashboard.errorTasks > 0}">{{ dashboard.errorTasks || 0 }}</div>
              <div class="stat-label">异常任务</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="trend-cards">
      <el-col :span="12">
        <el-card shadow="never" class="trend-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">7日成功率趋势</span>
            </div>
          </template>
          <div class="trend-chart">
            <div class="chart-bars">
              <div v-for="(item, key) in dashboard.weekDailyTrend" :key="key" class="chart-bar-item">
                <div class="bar-wrapper">
                  <div class="bar success-bar" :style="{height: (item.successRate * 100) + '%'}"></div>
                </div>
                <div class="bar-label">{{ formatShortDate(key) }}</div>
                <div class="bar-value">{{ (item.successRate * 100).toFixed(0) }}%</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="trend-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">7日平均耗时趋势 (ms)</span>
            </div>
          </template>
          <div class="trend-chart">
            <div class="chart-bars">
              <div v-for="(item, key) in dashboard.weekDailyTrend" :key="key" class="chart-bar-item">
                <div class="bar-wrapper">
                  <div class="bar duration-bar" :style="{height: getDurationHeight(item.avgDuration) + '%'}"></div>
                </div>
                <div class="bar-label">{{ formatShortDate(key) }}</div>
                <div class="bar-value">{{ formatDuration(item.avgDuration) }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="tasks-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">任务列表</span>
          <div class="filter-bar">
            <el-select v-model="filterModule" placeholder="所属模块" clearable style="width: 140px; margin-right: 8px;">
              <el-option label="积分" value="POINTS" />
              <el-option label="黑名单" value="BLACKLIST" />
              <el-option label="营销活动" value="CAMPAIGN" />
              <el-option label="会员" value="MEMBER" />
              <el-option label="工单" value="TICKET" />
              <el-option label="推荐" value="REFERRAL" />
              <el-option label="系统" value="SYSTEM" />
            </el-select>
            <el-select v-model="filterStatus" placeholder="运行状态" clearable style="width: 140px;">
              <el-option label="运行中" value="RUNNING" />
              <el-option label="已暂停" value="PAUSED" />
              <el-option label="异常" value="ERROR" />
              <el-option label="执行中" value="EXECUTING" />
            </el-select>
          </div>
        </div>
      </template>

      <el-table :data="filteredTasks" v-loading="loadingTasks" style="width: 100%" :header-cell-style="{ background: '#f8fafc' }">
        <el-table-column prop="displayName" label="任务名称" width="180">
          <template #default="{ row }">
            <div class="task-name">
              <span class="task-display">{{ row.displayName }}</span>
              <span class="task-code">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="所属模块" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getModuleTagType(row.module)" effect="light">
              {{ getModuleLabel(row.module) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="cronExpression" label="Cron 表达式" width="130">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain" class="cron-tag">{{ row.cronExpression }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="运行状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getStatusTagType(row.status)" effect="dark" round>
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上次执行" width="170">
          <template #default="{ row }">
            <div class="exec-info">
              <div class="exec-time">{{ row.lastExecutionAt ? formatDateTime(row.lastExecutionAt) : '-' }}</div>
              <div v-if="row.lastDurationMs != null" class="exec-duration">
                耗时: {{ formatDuration(row.lastDurationMs) }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="上次结果" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.lastExecutionStatus" size="small" :type="getLogStatusTagType(row.lastExecutionStatus)" effect="dark" round>
              {{ getLogStatusLabel(row.lastExecutionStatus) }}
            </el-tag>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="输出摘要" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="summary-text">{{ row.lastExecutionSummary || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="下次执行" width="160">
          <template #default="{ row }">
            {{ row.nextExecutionAt ? formatDateTime(row.nextExecutionAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="连续失败" width="90" align="center">
          <template #default="{ row }">
            <span :class="{'error-text': row.consecutiveFailures > 0}">
              {{ row.consecutiveFailures || 0 }}/{{ row.failureThreshold }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="重试策略" width="120">
          <template #default="{ row }">
            <span class="retry-info">
              {{ row.maxRetryCount }}次 / {{ row.retryIntervalSeconds }}s
            </span>
          </template>
        </el-table-column>
        <el-table-column label="依赖" width="80" align="center">
          <template #default="{ row }">
            <el-badge v-if="row.dependenciesAsChild?.length > 0" :value="row.dependenciesAsChild.length" type="warning" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetailDrawer(row)">详情</el-button>
            <el-button link type="success" @click="handleTrigger(row)" :loading="row.status === 'EXECUTING'">
              执行
            </el-button>
            <el-button v-if="row.status === 'RUNNING' || row.status === 'EXECUTING'" link type="warning" @click="handlePause(row)">
              暂停
            </el-button>
            <el-button v-if="row.status === 'PAUSED' || row.status === 'ERROR'" link type="success" @click="handleResume(row)">
              恢复
            </el-button>
            <el-button link @click="openCronDialog(row)">改Cron</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-drawer v-model="detailDrawerVisible" title="任务详情" size="700px" direction="rtl">
      <div v-if="currentTask" class="task-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务名称">{{ currentTask.displayName }}</el-descriptions-item>
          <el-descriptions-item label="任务编码">{{ currentTask.name }}</el-descriptions-item>
          <el-descriptions-item label="所属模块">{{ getModuleLabel(currentTask.module) }}</el-descriptions-item>
          <el-descriptions-item label="运行状态">
            <el-tag :type="getStatusTagType(currentTask.status)" effect="dark" round>
              {{ getStatusLabel(currentTask.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Cron 表达式">{{ currentTask.cronExpression }}</el-descriptions-item>
          <el-descriptions-item label="处理函数">{{ currentTask.handler }}</el-descriptions-item>
          <el-descriptions-item label="超时阈值">{{ currentTask.timeoutSeconds }} 秒</el-descriptions-item>
          <el-descriptions-item label="失败阈值">{{ currentTask.failureThreshold }} 次</el-descriptions-item>
          <el-descriptions-item label="重试策略">{{ currentTask.maxRetryCount }} 次 / {{ currentTask.retryIntervalSeconds }} 秒间隔</el-descriptions-item>
          <el-descriptions-item label="启用状态">
            <el-tag :type="currentTask.isEnabled ? 'success' : 'info'">{{ currentTask.isEnabled ? '已启用' : '已禁用' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="上次执行">{{ currentTask.lastExecutionAt ? formatDateTime(currentTask.lastExecutionAt) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="下次执行">{{ currentTask.nextExecutionAt ? formatDateTime(currentTask.nextExecutionAt) : '-' }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ currentTask.description || '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-tabs v-model="detailTab" class="detail-tabs" style="margin-top: 24px;">
          <el-tab-pane label="执行日志" name="logs">
            <div class="logs-header">
              <el-select v-model="logFilterStatus" placeholder="状态筛选" clearable style="width: 140px;">
                <el-option label="成功" value="SUCCESS" />
                <el-option label="失败" value="FAILED" />
                <el-option label="超时" value="TIMEOUT" />
                <el-option label="跳过" value="SKIPPED" />
              </el-select>
            </div>
            <el-table :data="taskLogs" v-loading="loadingLogs" style="width: 100%" size="small">
              <el-table-column prop="createdAt" label="执行时间" width="170">
                <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="getLogStatusTagType(row.status)" effect="dark" round>
                    {{ getLogStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="durationMs" label="耗时" width="100">
                <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
              </el-table-column>
              <el-table-column prop="processedCount" label="处理条数" width="90" />
              <el-table-column prop="triggeredBy" label="触发方式" width="100">
                <template #default="{ row }">{{ getTriggeredByLabel(row.triggeredBy) }}</template>
              </el-table-column>
              <el-table-column prop="outputSummary" label="输出摘要" show-overflow-tooltip />
              <el-table-column label="操作" width="80">
                <template #default="{ row }">
                  <el-button v-if="row.errorStack" link type="danger" size="small" @click="showErrorStack(row)">错误</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-wrapper">
              <el-pagination
                v-model:current-page="logPage"
                v-model:page-size="logPageSize"
                :page-sizes="[10, 20, 50]"
                :total="logTotal"
                layout="total, sizes, prev, pager, next, jumper"
                @current-change="loadTaskLogs"
                @size-change="loadTaskLogs"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="依赖配置" name="dependencies">
            <div class="deps-section">
              <h4 class="deps-title">前置依赖（需等待这些任务成功后执行）</h4>
              <div v-if="currentTask.dependenciesAsChild?.length > 0" class="deps-list">
                <div v-for="dep in currentTask.dependenciesAsChild" :key="dep.id" class="dep-item">
                  <el-icon><Link /></el-icon>
                  <span>{{ dep.parentTask.displayName }} ({{ dep.parentTask.name }})</span>
                  <el-button link type="danger" size="small" @click="handleRemoveDependency(dep)">移除</el-button>
                </div>
              </div>
              <el-empty v-else description="暂无前置依赖" :image-size="60" />
            </div>

            <div class="deps-section" style="margin-top: 24px;">
              <h4 class="deps-title">后置任务（此任务成功后触发）</h4>
              <div v-if="currentTask.dependenciesAsParent?.length > 0" class="deps-list">
                <div v-for="dep in currentTask.dependenciesAsParent" :key="dep.id" class="dep-item">
                  <el-icon><Connection /></el-icon>
                  <span>{{ dep.childTask.displayName }} ({{ dep.childTask.name }})</span>
                  <el-button link type="danger" size="small" @click="handleRemoveDependency(dep)">移除</el-button>
                </div>
              </div>
              <el-empty v-else description="暂无后置任务" :image-size="60" />
            </div>

            <div class="add-dep-section" style="margin-top: 24px;">
              <h4 class="deps-title">添加依赖</h4>
              <div class="add-dep-form">
                <el-select v-model="newDepParentId" placeholder="选择前置任务" style="flex: 1; margin-right: 8px;">
                  <el-option
                    v-for="task in availableTasks"
                    :key="task.id"
                    :label="`${task.displayName} (${task.name})`"
                    :value="task.id"
                  />
                </el-select>
                <el-button type="primary" @click="handleAddDependency" :disabled="!newDepParentId">
                  添加为前置依赖
                </el-button>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <el-dialog v-model="cronDialogVisible" title="修改 Cron 表达式" width="480px">
      <div v-if="cronTask" class="cron-dialog-content">
        <el-alert type="warning" :closable="false" style="margin-bottom: 16px;">
          修改 Cron 表达式将影响任务的调度频率，请谨慎操作！
        </el-alert>
        <el-descriptions :column="1" size="small" border style="margin-bottom: 16px;">
          <el-descriptions-item label="任务名称">{{ cronTask.displayName }}</el-descriptions-item>
          <el-descriptions-item label="当前表达式">{{ cronTask.cronExpression }}</el-descriptions-item>
        </el-descriptions>
        <el-form label-position="top">
          <el-form-item label="新 Cron 表达式">
            <el-input v-model="newCronExpression" placeholder="例如: 0 2 * * * (每日凌晨2点)" />
          </el-form-item>
          <div class="cron-help">
            <div class="cron-help-title">Cron 格式说明 (分 时 日 月 周):</div>
            <div class="cron-help-item"><code>0 2 * * *</code> - 每日凌晨2点</div>
            <div class="cron-help-item"><code>0 * * * *</code> - 每小时整点</div>
            <div class="cron-help-item"><code>0 */6 * * *</code> - 每6小时</div>
            <div class="cron-help-item"><code>0 0 * * 1</code> - 每周一零点</div>
          </div>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="cronDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmUpdateCron">确认修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="createDialogVisible" title="新建定时任务" width="600px">
      <el-form :model="createForm" label-position="top" ref="createFormRef" :rules="createRules">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="任务编码" prop="name">
              <el-input v-model="createForm.name" placeholder="英文唯一标识，如: MY_TASK" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="任务名称" prop="displayName">
              <el-input v-model="createForm.displayName" placeholder="显示名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="所属模块" prop="module">
              <el-select v-model="createForm.module" placeholder="选择模块" style="width: 100%;">
                <el-option label="积分" value="POINTS" />
                <el-option label="黑名单" value="BLACKLIST" />
                <el-option label="营销活动" value="CAMPAIGN" />
                <el-option label="会员" value="MEMBER" />
                <el-option label="工单" value="TICKET" />
                <el-option label="推荐" value="REFERRAL" />
                <el-option label="系统" value="SYSTEM" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="处理函数" prop="handler">
              <el-select v-model="createForm.handler" placeholder="选择处理函数" style="width: 100%;">
                <el-option v-for="h in availableHandlers" :key="h" :label="h" :value="h" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="Cron 表达式" prop="cronExpression">
          <el-input v-model="createForm.cronExpression" placeholder="例如: 0 2 * * *" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="超时(秒)" prop="timeoutSeconds">
              <el-input-number v-model="createForm.timeoutSeconds" :min="10" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最大重试" prop="maxRetryCount">
              <el-input-number v-model="createForm.maxRetryCount" :min="0" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="重试间隔(秒)" prop="retryIntervalSeconds">
              <el-input-number v-model="createForm.retryIntervalSeconds" :min="10" style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreateTask" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="errorStackVisible" title="错误堆栈" width="700px">
      <pre class="error-stack">{{ currentErrorStack }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Refresh, Plus, List, VideoPlay, CircleCheck, Warning,
  Link, Connection
} from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import {
  fetchTaskDashboard, fetchTasks, fetchTaskDetail, fetchTaskHandlers,
  createTask, updateTaskCron, triggerTask, pauseTask, resumeTask,
  fetchTaskLogs, addDependency, removeDependency
} from '../api/scheduledTasks';

const authStore = useAuthStore();

const loadingTasks = ref(false);
const tasks = ref([]);
const filterModule = ref('');
const filterStatus = ref('');
const dashboard = ref({});
const weekDailyTrend = ref([]);

const detailDrawerVisible = ref(false);
const currentTask = ref(null);
const detailTab = ref('logs');

const loadingLogs = ref(false);
const taskLogs = ref([]);
const logPage = ref(1);
const logPageSize = ref(10);
const logTotal = ref(0);
const logFilterStatus = ref('');

const cronDialogVisible = ref(false);
const cronTask = ref(null);
const newCronExpression = ref('');

const createDialogVisible = ref(false);
const submitting = ref(false);
const createFormRef = ref(null);
const availableHandlers = ref([]);
const createForm = reactive({
  name: '',
  displayName: '',
  cronExpression: '',
  description: '',
  module: 'SYSTEM',
  handler: '',
  timeoutSeconds: 300,
  maxRetryCount: 3,
  retryIntervalSeconds: 60,
  failureThreshold: 5,
  isEnabled: true,
});
const createRules = {
  name: [{ required: true, message: '请输入任务编码', trigger: 'blur' }],
  displayName: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  cronExpression: [{ required: true, message: '请输入 Cron 表达式', trigger: 'blur' }],
  module: [{ required: true, message: '请选择模块', trigger: 'change' }],
  handler: [{ required: true, message: '请选择处理函数', trigger: 'change' }],
};

const errorStackVisible = ref(false);
const currentErrorStack = ref('');

const newDepParentId = ref(null);

const filteredTasks = computed(() => {
  let result = tasks.value;
  if (filterModule.value) result = result.filter(t => t.module === filterModule.value);
  if (filterStatus.value) result = result.filter(t => t.status === filterStatus.value);
  return result;
});

const availableTasks = computed(() => {
  if (!currentTask.value) return [];
  return tasks.value.filter(t => t.id !== currentTask.value.id);
});

const loadDashboard = async () => {
  try {
    dashboard.value = await fetchTaskDashboard();
  } catch (e) {
    console.error('Failed to load dashboard', e);
  }
};

const loadTasks = async () => {
  loadingTasks.value = true;
  try {
    tasks.value = await fetchTasks({ module: filterModule.value, status: filterStatus.value });
  } finally {
    loadingTasks.value = false;
  }
};

const refreshAll = () => {
  loadDashboard();
  loadTasks();
  ElMessage.success('已刷新');
};

const loadTaskLogs = async () => {
  if (!currentTask.value) return;
  loadingLogs.value = true;
  try {
    const result = await fetchTaskLogs(currentTask.value.id, {
      page: logPage.value,
      pageSize: logPageSize.value,
      status: logFilterStatus.value,
    });
    taskLogs.value = result.logs;
    logTotal.value = result.total;
  } finally {
    loadingLogs.value = false;
  }
};

watch(logFilterStatus, () => {
  logPage.value = 1;
  loadTaskLogs();
});

const openDetailDrawer = async (row) => {
  currentTask.value = await fetchTaskDetail(row.id);
  detailTab.value = 'logs';
  logPage.value = 1;
  logFilterStatus.value = '';
  newDepParentId.value = null;
  detailDrawerVisible.value = true;
  loadTaskLogs();
};

const handleTrigger = async (row) => {
  try {
    await triggerTask(row.id);
    ElMessage.success('任务已触发执行');
    setTimeout(loadTasks, 2000);
  } catch (e) {
    ElMessage.error('任务触发失败');
  }
};

const handlePause = async (row) => {
  try {
    await pauseTask(row.id);
    ElMessage.success('任务已暂停');
    loadTasks();
    if (currentTask.value?.id === row.id) {
      currentTask.value = await fetchTaskDetail(row.id);
    }
  } catch (e) {
    ElMessage.error('暂停失败');
  }
};

const handleResume = async (row) => {
  try {
    await resumeTask(row.id);
    ElMessage.success('任务已恢复');
    loadTasks();
    if (currentTask.value?.id === row.id) {
      currentTask.value = await fetchTaskDetail(row.id);
    }
  } catch (e) {
    ElMessage.error('恢复失败');
  }
};

const openCronDialog = (row) => {
  cronTask.value = row;
  newCronExpression.value = row.cronExpression;
  cronDialogVisible.value = true;
};

const confirmUpdateCron = async () => {
  if (!newCronExpression.value.trim()) {
    ElMessage.warning('请输入 Cron 表达式');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认将任务 "${cronTask.value.displayName}" 的 Cron 表达式从 "${cronTask.value.cronExpression}" 修改为 "${newCronExpression.value}"？此操作将影响任务调度频率。`,
      '二次确认',
      { type: 'warning', confirmButtonText: '确认修改', cancelButtonText: '取消' }
    );
    await updateTaskCron(cronTask.value.id, newCronExpression.value.trim());
    ElMessage.success('Cron 表达式已更新');
    cronDialogVisible.value = false;
    loadTasks();
    if (currentTask.value?.id === cronTask.value.id) {
      currentTask.value = await fetchTaskDetail(cronTask.value.id);
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('修改失败');
  }
};

const openCreateDialog = async () => {
  Object.assign(createForm, {
    name: '',
    displayName: '',
    cronExpression: '',
    description: '',
    module: 'SYSTEM',
    handler: '',
    timeoutSeconds: 300,
    maxRetryCount: 3,
    retryIntervalSeconds: 60,
    failureThreshold: 5,
    isEnabled: true,
  });
  availableHandlers.value = await fetchTaskHandlers();
  createDialogVisible.value = true;
};

const submitCreateTask = async () => {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        await createTask(createForm);
        ElMessage.success('任务创建成功');
        createDialogVisible.value = false;
        loadTasks();
      } catch (e) {
        ElMessage.error('任务创建失败');
      } finally {
        submitting.value = false;
      }
    }
  });
};

const showErrorStack = (row) => {
  currentErrorStack.value = row.errorStack;
  errorStackVisible.value = true;
};

const handleAddDependency = async () => {
  if (!newDepParentId.value || !currentTask.value) return;
  try {
    await addDependency({ parentTaskId: newDepParentId.value, childTaskId: currentTask.value.id });
    ElMessage.success('依赖已添加');
    newDepParentId.value = null;
    currentTask.value = await fetchTaskDetail(currentTask.value.id);
  } catch (e) {
    ElMessage.error('添加依赖失败');
  }
};

const handleRemoveDependency = async (dep) => {
  try {
    await ElMessageBox.confirm('确认移除此依赖关系？', '提示', { type: 'warning' });
    await removeDependency(dep.id);
    ElMessage.success('依赖已移除');
    currentTask.value = await fetchTaskDetail(currentTask.value.id);
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('移除失败');
  }
};

const formatDateTime = (d) => dayjs(d).format('YYYY-MM-DD HH:mm:ss');
const formatShortDate = (d) => dayjs(d).format('MM/DD');
const formatDuration = (ms) => {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};
const getDurationHeight = (ms) => {
  const max = 30000;
  const pct = Math.min(100, (ms || 0) / max * 100);
  return Math.max(pct, 2);
};
const getModuleLabel = (m) => ({ POINTS: '积分', BLACKLIST: '黑名单', CAMPAIGN: '活动', MEMBER: '会员', TICKET: '工单', REFERRAL: '推荐', SYSTEM: '系统' }[m] || m);
const getModuleTagType = (m) => ({ POINTS: 'primary', BLACKLIST: 'danger', CAMPAIGN: 'success', MEMBER: '', TICKET: 'warning', REFERRAL: 'info', SYSTEM: '' }[m] || '');
const getStatusLabel = (s) => ({ RUNNING: '运行中', PAUSED: '已暂停', ERROR: '异常', EXECUTING: '执行中' }[s] || s);
const getStatusTagType = (s) => ({ RUNNING: 'success', PAUSED: 'info', ERROR: 'danger', EXECUTING: 'warning' }[s] || '');
const getLogStatusLabel = (s) => ({ SUCCESS: '成功', FAILED: '失败', TIMEOUT: '超时', SKIPPED: '跳过' }[s] || s);
const getLogStatusTagType = (s) => ({ SUCCESS: 'success', FAILED: 'danger', TIMEOUT: 'warning', SKIPPED: 'info' }[s] || '');
const getTriggeredByLabel = (t) => ({ SYSTEM: '系统', MANUAL: '手动', RETRY: '重试', DEPENDENCY: '依赖' }[t] || t);

onMounted(() => {
  loadDashboard();
  loadTasks();
});
</script>

<style scoped>
.scheduled-tasks {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #64748b;
}

.header-right {
  display: flex;
  gap: 8px;
}

.mr-4 {
  margin-right: 4px;
}

.dashboard-cards {
  margin-bottom: 16px;
}

.stat-card {
  border-radius: 12px;
  border: none;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.total-icon { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.running-icon { background: linear-gradient(135deg, #10b981, #059669); }
.success-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.error-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-top: 2px;
}

.error-text {
  color: #ef4444 !important;
  font-weight: 600;
}

.trend-cards {
  margin-bottom: 16px;
}

.trend-card {
  border-radius: 12px;
  border: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.filter-bar {
  display: flex;
  align-items: center;
}

.trend-chart {
  height: 180px;
  display: flex;
  align-items: flex-end;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  width: 100%;
  height: 100%;
  padding: 0 10px;
}

.chart-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 4px;
}

.bar-wrapper {
  width: 32px;
  height: 110px;
  background: #f1f5f9;
  border-radius: 6px 6px 0 0;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar {
  width: 100%;
  border-radius: 6px 6px 0 0;
  transition: height 0.3s ease;
  min-height: 2px;
}

.success-bar {
  background: linear-gradient(180deg, #34d399, #059669);
}

.duration-bar {
  background: linear-gradient(180deg, #60a5fa, #2563eb);
}

.bar-label {
  font-size: 11px;
  color: #64748b;
}

.bar-value {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
}

.tasks-card {
  border-radius: 12px;
  border: none;
}

.task-name {
  display: flex;
  flex-direction: column;
}

.task-display {
  font-weight: 600;
  color: #1e293b;
}

.task-code {
  font-size: 12px;
  color: #94a3b8;
  font-family: monospace;
}

.cron-tag {
  font-family: monospace;
}

.exec-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.exec-time {
  font-size: 13px;
  color: #334155;
}

.exec-duration {
  font-size: 12px;
  color: #94a3b8;
}

.muted {
  color: #94a3b8;
  font-size: 12px;
}

.summary-text {
  color: #475569;
  font-size: 13px;
}

.retry-info {
  font-size: 12px;
  color: #64748b;
}

.detail-tabs {
  margin-top: 16px;
}

.logs-header {
  margin-bottom: 12px;
  display: flex;
  justify-content: flex-end;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.deps-section {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
}

.deps-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

.deps-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dep-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.dep-item span {
  flex: 1;
  color: #334155;
}

.add-dep-section {
  background: #f0fdf4;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #bbf7d0;
}

.add-dep-form {
  display: flex;
  align-items: center;
  margin-top: 12px;
}

.cron-dialog-content {
  padding: 8px 0;
}

.cron-help {
  background: #f8fafc;
  padding: 12px;
  border-radius: 6px;
  margin-top: 8px;
}

.cron-help-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px;
}

.cron-help-item {
  font-size: 12px;
  color: #64748b;
  font-family: monospace;
  margin: 3px 0;
}

.error-stack {
  background: #1e293b;
  color: #f1f5f9;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow: auto;
}

:deep(.el-descriptions__label) {
  width: 120px;
  background-color: #f8fafc !important;
  color: #64748b;
  font-weight: 500;
}
</style>
