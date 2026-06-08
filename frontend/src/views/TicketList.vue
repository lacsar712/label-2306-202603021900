<template>
  <div class="ticket-list">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">工单管理</h2>
        <p class="page-subtitle">处理会员反馈工单，查看 SLA 和统计数据</p>
      </div>
      <div class="header-actions">
        <el-button @click="openRulesDialog">
          <el-icon class="mr-4"><Setting /></el-icon>分配规则
        </el-button>
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon class="mr-4"><Plus /></el-icon>新建工单
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div>
              <div class="stat-label">总工单</div>
              <div class="stat-value">{{ stats?.total || 0 }}</div>
            </div>
            <el-icon :size="40" color="#6366f1"><Document /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div>
              <div class="stat-label">待处理</div>
              <div class="stat-value pending">{{ pendingCount }}</div>
            </div>
            <el-icon :size="40" color="#f59e0b"><Clock /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div>
              <div class="stat-label">处理中</div>
              <div class="stat-value processing">{{ processingCount }}</div>
            </div>
            <el-icon :size="40" color="#3b82f6"><Loading /></el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div>
              <div class="stat-label">已超时</div>
              <div class="stat-value overdue">{{ stats?.overdue || 0 }}</div>
            </div>
            <el-icon :size="40" color="#ef4444"><Warning /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="pendingAssignCount > 0" class="warn-card mb-24" shadow="never">
      <el-alert
        :title="`当前有 ${pendingAssignCount} 个工单处于「待分配」状态，建议尽快配置分配规则或手动转派。`"
        type="warning"
        show-icon
        :closable="false"
      >
        <template #default>
          <el-button size="small" type="warning" @click="openRulesDialog">配置分配规则</el-button>
        </template>
      </el-alert>
    </el-card>

    <el-card class="assignee-stats-card mb-24" shadow="never">
      <div class="section-header">
        <div class="section-title">
          <el-icon><DataAnalysis /></el-icon>
          <span>处理人绩效（近 30 天）</span>
        </div>
      </div>
      <el-table
        :data="assigneeStats"
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
        empty-text="暂无处理数据"
      >
        <el-table-column prop="username" label="处理人" width="150">
          <template #default="{ row }">
            <div class="assignee-cell">
              <el-avatar :size="28">{{ row.username?.charAt(0)?.toUpperCase() }}</el-avatar>
              <span>{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="totalTickets" label="受理工单" width="100" align="center" />
        <el-table-column prop="closedCount" label="已关闭" width="100" align="center" />
        <el-table-column label="关闭率" width="140" align="center">
          <template #default="{ row }">
            <el-progress
              :percentage="row.closeRate || 0"
              :color="getCloseRateColor(row.closeRate)"
              :stroke-width="10"
            />
          </template>
        </el-table-column>
        <el-table-column label="平均响应时长" width="160" align="center">
          <template #default="{ row }">
            <span v-if="row.avgResponseTimeMs">{{ formatDuration(row.avgResponseTimeMs) }}</span>
            <span v-else class="sub-text">—</span>
          </template>
        </el-table-column>
        <el-table-column label="满意度" width="180" align="center">
          <template #default="{ row }">
            <div v-if="row.avgSatisfaction" class="satisfaction-display">
              <el-rate v-model="row.avgSatisfaction" disabled :max="5" size="small" />
              <span class="satisfaction-num">{{ row.avgSatisfaction.toFixed(1) }} / 5</span>
            </div>
            <span v-else class="sub-text">暂无评价</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="filter-card mb-24" shadow="never">
      <div class="filter-row">
        <el-input
          v-model="filters.search"
          placeholder="搜索标题、内容、会员姓名或手机号"
          class="search-input"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filters.status" placeholder="状态" clearable @change="handleSearch" class="filter-select">
          <el-option v-for="item in Object.values(TICKET_STATUS)" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.priority" placeholder="优先级" clearable @change="handleSearch" class="filter-select">
          <el-option v-for="item in Object.values(TICKET_PRIORITY)" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.category" placeholder="分类" clearable @change="handleSearch" class="filter-select">
          <el-option v-for="item in Object.values(TICKET_CATEGORY)" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="filters.assigneeId" placeholder="处理人" clearable @change="handleSearch" class="filter-select">
          <el-option v-for="user in users" :key="user.id" :label="user.username" :value="String(user.id)" />
        </el-select>
        <el-select v-model="filters.slaTimeout" placeholder="SLA 状态" clearable @change="handleSearch" class="filter-select">
          <el-option label="已超时" value="true" />
          <el-option label="未超时" value="false" />
        </el-select>
      </div>
      <div class="filter-row mt-12">
        <el-date-picker
          v-model="filters.dateFrom"
          type="date"
          placeholder="开始日期"
          value-format="YYYY-MM-DD"
          @change="handleSearch"
          class="date-picker"
        />
        <span class="date-sep">至</span>
        <el-date-picker
          v-model="filters.dateTo"
          type="date"
          placeholder="结束日期"
          value-format="YYYY-MM-DD"
          @change="handleSearch"
          class="date-picker"
        />
        <el-button type="primary" @click="handleSearch">
          <el-icon class="mr-4"><Search /></el-icon>搜索
        </el-button>
        <el-button @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table
        v-loading="ticketStore.loading"
        :data="ticketStore.tickets"
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
        row-class-name="ticket-row"
      >
        <el-table-column prop="id" label="工单号" width="80" />
        <el-table-column prop="title" label="标题" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/tickets/${row.id}`)" class="title-link">
              {{ row.title }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="member.name" label="会员" min-width="120">
          <template #default="{ row }">
            <div>
              <div>{{ row.member?.name }}</div>
              <div class="sub-text">{{ row.member?.phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="90">
          <template #default="{ row }">
            <el-tag :type="TICKET_CATEGORY[row.category]?.type" size="small">
              {{ TICKET_CATEGORY[row.category]?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="TICKET_PRIORITY[row.priority]?.type" size="small" effect="dark">
              {{ TICKET_PRIORITY[row.priority]?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="TICKET_STATUS[row.status]?.type" size="small">
              {{ TICKET_STATUS[row.status]?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="assignee.username" label="处理人" width="100">
          <template #default="{ row }">
            <span>{{ row.assignee?.username || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="SLA" width="130">
          <template #default="{ row }">
            <div v-if="!CLOSED_STATUSES.includes(row.status) && row.slaDeadline">
              <div :class="['sla-text', row.slaOverdue ? 'overdue' : '']">
                <el-icon v-if="row.slaOverdue"><WarningFilled /></el-icon>
                <span>{{ formatSlaRemaining(row.slaRemaining) }}</span>
              </div>
              <div class="sub-text">{{ formatDate(row.slaDeadline) }}</div>
            </div>
            <span v-else class="sub-text">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="150">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/tickets/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="ticketStore.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新建工单" width="560px" destroy-on-close @closed="resetCreateForm">
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-position="top">
        <el-form-item label="关联会员" prop="memberId">
          <el-select v-model="createForm.memberId" filterable placeholder="搜索并选择会员" style="width: 100%">
            <el-option
              v-for="member in memberStore.members"
              :key="member.id"
              :label="`${member.name} (${member.phone})`"
              :value="member.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="createForm.title" placeholder="请输入工单标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="分类" prop="category">
              <el-select v-model="createForm.category" placeholder="请选择分类" style="width: 100%">
                <el-option v-for="item in Object.values(TICKET_CATEGORY)" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级" prop="priority">
              <el-select v-model="createForm.priority" placeholder="请选择优先级" style="width: 100%">
                <el-option v-for="item in Object.values(TICKET_PRIORITY)" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="内容" prop="content">
          <el-input
            v-model="createForm.content"
            type="textarea"
            :rows="5"
            placeholder="请详细描述问题或反馈内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreateForm">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRulesDialog" title="工单分配规则配置" width="680px" destroy-on-close>
      <div class="rules-desc">
        为每个工单分类指定默认处理人，新创建的工单将自动分配给对应分类的处理人，并根据 SLA 时长计算截止时间。
      </div>
      <el-table
        :data="assignmentRulesTable"
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
      >
        <el-table-column label="工单分类" width="140">
          <template #default="{ row }">
            <el-tag :type="TICKET_CATEGORY[row.category]?.type" effect="dark">
              {{ TICKET_CATEGORY[row.category]?.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="默认处理人" min-width="200">
          <template #default="{ row }">
            <el-select
              v-model="row.defaultAssigneeId"
              placeholder="请选择处理人"
              filterable
              style="width: 100%"
              clearable
            >
              <el-option
                v-for="u in users"
                :key="u.id"
                :label="u.username"
                :value="u.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="SLA 时长（小时）" width="180">
          <template #default="{ row }">
            <el-input-number
              v-model="row.slaHours"
              :min="1"
              :max="240"
              :step="1"
              controls-position="right"
              style="width: 100%"
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showRulesDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingRules" @click="saveAssignmentRules">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTicketStore } from '../stores/ticket';
import { useMemberStore } from '../stores/member';
import api from '../api/axios';
import { TICKET_CATEGORY, TICKET_PRIORITY, TICKET_STATUS, CLOSED_STATUSES } from '../api/tickets';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import {
  Plus, Search, Document, Clock, Loading, Warning, WarningFilled,
  Setting, DataAnalysis,
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const ticketStore = useTicketStore();
const memberStore = useMemberStore();

const showCreateDialog = ref(false);
const submitting = ref(false);
const createFormRef = ref(null);
const users = ref([]);

const showRulesDialog = ref(false);
const savingRules = ref(false);
const assignmentRulesTable = ref([]);

const filters = reactive({
  search: '',
  status: '',
  priority: '',
  category: '',
  assigneeId: '',
  slaTimeout: '',
  dateFrom: '',
  dateTo: '',
});

const currentPage = ref(1);
const pageSize = ref(20);

const createForm = reactive({
  memberId: null,
  title: '',
  content: '',
  category: '',
  priority: 'MEDIUM',
});

const createRules = {
  memberId: [{ required: true, message: '请选择会员', trigger: 'change' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }, { min: 2, message: '标题至少2个字符', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  content: [{ required: true, message: '请输入内容', trigger: 'blur' }, { min: 5, message: '内容至少5个字符', trigger: 'blur' }],
};

const stats = computed(() => ticketStore.stats);
const pendingCount = computed(() => {
  const byStatus = stats.value?.byStatus || [];
  const pending = byStatus.find((s) => s.status === 'PENDING_ASSIGN')?._count?._all || 0;
  const pendingProcess = byStatus.find((s) => s.status === 'PENDING_PROCESS')?._count?._all || 0;
  return pending + pendingProcess;
});
const processingCount = computed(() => {
  const byStatus = stats.value?.byStatus || [];
  const processing = byStatus.find((s) => s.status === 'PROCESSING')?._count?._all || 0;
  const review = byStatus.find((s) => s.status === 'PENDING_REVIEW')?._count?._all || 0;
  return processing + review;
});

const pendingAssignCount = computed(() => {
  const byStatus = stats.value?.byStatus || [];
  return byStatus.find((s) => s.status === 'PENDING_ASSIGN')?._count?._all || 0;
});

const assigneeStats = computed(() => stats.value?.assigneeStats || []);

const handleSearch = () => {
  currentPage.value = 1;
  fetchTickets();
};

const resetFilters = () => {
  filters.search = '';
  filters.status = '';
  filters.priority = '';
  filters.category = '';
  filters.assigneeId = '';
  filters.slaTimeout = '';
  filters.dateFrom = '';
  filters.dateTo = '';
  currentPage.value = 1;
  fetchTickets();
};

const handlePageChange = () => {
  fetchTickets();
};

const fetchTickets = () => {
  const params = {
    page: currentPage.value,
    pageSize: pageSize.value,
  };
  for (const [key, value] of Object.entries(filters)) {
    if (value) params[key] = value;
  }
  ticketStore.fetchTickets(params);
};

const fetchUsers = async () => {
  try {
    users.value = await api.get('/users');
  } catch (e) {
    console.error(e);
  }
};

const resetCreateForm = () => {
  createForm.memberId = null;
  createForm.title = '';
  createForm.content = '';
  createForm.category = '';
  createForm.priority = 'MEDIUM';
  if (createFormRef.value) createFormRef.value.clearValidate();
};

const submitCreateForm = async () => {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        await ticketStore.createTicket(createForm);
        ElMessage.success('工单创建成功');
        showCreateDialog.value = false;
        fetchTickets();
        ticketStore.fetchStats();
      } finally {
        submitting.value = false;
      }
    }
  });
};

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm');

const formatSlaRemaining = (ms) => {
  if (ms === null) return '—';
  const abs = Math.abs(ms);
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const sign = ms < 0 ? '超时 ' : '';
  if (days > 0) return `${sign}${days}天${hours}小时`;
  if (hours > 0) return `${sign}${hours}小时${mins}分`;
  return `${sign}${mins}分钟`;
};

const formatDuration = (ms) => {
  if (!ms) return '—';
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / (60 * 60 * 1000));
  const mins = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}小时${mins}分`;
  return `${mins}分钟`;
};

const getCloseRateColor = (rate) => {
  if (rate >= 80) return '#16a34a';
  if (rate >= 50) return '#3b82f6';
  if (rate >= 30) return '#f59e0b';
  return '#ef4444';
};

const initAssignmentRulesTable = async () => {
  try {
    const rules = await ticketStore.fetchAssignmentRules();
    const ruleMap = {};
    (rules || []).forEach((r) => {
      ruleMap[r.category] = r;
    });
    assignmentRulesTable.value = Object.keys(TICKET_CATEGORY).map((key) => ({
      category: key,
      defaultAssigneeId: ruleMap[key]?.defaultAssigneeId || null,
      slaHours: ruleMap[key]?.slaHours || 24,
    }));
  } catch (e) {
    assignmentRulesTable.value = Object.keys(TICKET_CATEGORY).map((key) => ({
      category: key,
      defaultAssigneeId: null,
      slaHours: 24,
    }));
  }
};

const saveAssignmentRules = async () => {
  savingRules.value = true;
  try {
    const validRules = assignmentRulesTable.value.filter((r) => r.defaultAssigneeId);
    if (validRules.length === 0) {
      ElMessage.warning('请至少为一个分类指定默认处理人');
      return;
    }
    for (const rule of assignmentRulesTable.value) {
      if (rule.defaultAssigneeId) {
        await ticketStore.saveAssignmentRule({
          category: rule.category,
          defaultAssigneeId: rule.defaultAssigneeId,
          slaHours: rule.slaHours,
        });
      }
    }
    ElMessage.success('分配规则保存成功');
    showRulesDialog.value = false;
    ticketStore.fetchStats();
  } finally {
    savingRules.value = false;
  }
};

onMounted(async () => {
  await Promise.all([
    memberStore.fetchMembers(),
    fetchUsers(),
    initAssignmentRulesTable(),
  ]);
  if (route.query.memberId) {
    filters.memberId = String(route.query.memberId);
  }
  fetchTickets();
  ticketStore.fetchStats();
});

const openRulesDialog = async () => {
  showRulesDialog.value = true;
  await initAssignmentRulesTable();
};
</script>

<style scoped>
.ticket-list {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  border-radius: 12px;
  border: none;
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-value.pending { color: #f59e0b; }
.stat-value.processing { color: #3b82f6; }
.stat-value.overdue { color: #ef4444; }

.filter-card, .table-card {
  border-radius: 12px;
  border: none;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  min-width: 280px;
  flex: 1;
}

.filter-select {
  width: 130px;
}

.date-picker {
  width: 160px;
}

.date-sep {
  color: #64748b;
}

.title-link {
  font-weight: 500;
}

.sub-text {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.sla-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  color: #16a34a;
}

.sla-text.overdue {
  color: #ef4444;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.mb-24 { margin-bottom: 24px; }
.mt-12 { margin-top: 12px; }
.mr-4 { margin-right: 4px; }

:deep(.ticket-row) {
  transition: background-color 0.2s;
}

:deep(.ticket-row:hover) {
  background-color: #f8fafc !important;
}

:deep(.el-table) {
  --el-table-border-color: #f1f5f9;
}

:deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
  border: none;
}

.warn-card, .assignee-stats-card {
  border-radius: 12px;
  border: none;
}

.section-header {
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.assignee-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.satisfaction-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.satisfaction-num {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.rules-desc {
  background: #f0f9ff;
  color: #0369a1;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.6;
}
</style>
