<template>
  <div class="ticket-detail" v-loading="loading">
    <div class="page-header">
      <div class="header-left">
        <el-button link @click="$router.back()" class="back-btn">
          <el-icon><ArrowLeft /></el-icon>
          <span>返回列表</span>
        </el-button>
        <h2 class="page-title">工单 #{{ ticket?.id }} · {{ ticket?.title }}</h2>
      </div>
      <div class="header-actions">
        <el-tag :type="TICKET_PRIORITY[ticket?.priority]?.type" effect="dark" size="large">
          {{ TICKET_PRIORITY[ticket?.priority]?.label }}优先级
        </el-tag>
        <el-tag :type="TICKET_STATUS[ticket?.status]?.type" size="large">
          {{ TICKET_STATUS[ticket?.status]?.label }}
        </el-tag>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col :span="17">
        <el-card class="info-card" shadow="never">
          <div class="card-title">工单内容</div>
          <div class="ticket-meta">
            <span>
              <el-icon><User /></el-icon>
              {{ ticket?.member?.name }} ({{ ticket?.member?.phone }})
            </span>
            <span>
              <el-icon><Clock /></el-icon>
              {{ formatDate(ticket?.createdAt) }}
            </span>
            <el-tag :type="TICKET_CATEGORY[ticket?.category]?.type" size="small">
              {{ TICKET_CATEGORY[ticket?.category]?.label }}
            </el-tag>
          </div>
          <div class="ticket-content">
            {{ ticket?.content }}
          </div>
          <div v-if="ticket?.attachments?.length" class="attachments-section">
            <div class="section-title">
              <el-icon><Paperclip /></el-icon>
              附件 ({{ ticket.attachments.length }})
            </div>
            <div class="attachments-list">
              <el-tag
                v-for="att in ticket.attachments"
                :key="att.id"
                class="attachment-tag"
                type="info"
                effect="plain"
              >
                <el-icon class="mr-4"><Document /></el-icon>
                {{ att.fileName }}
              </el-tag>
            </div>
          </div>
        </el-card>

        <el-card class="timeline-card" shadow="never">
          <div class="card-title">沟通时间线</div>
          <el-timeline>
            <el-timeline-item
              v-for="reply in ticket?.replies || []"
              :key="reply.id"
              :timestamp="formatDate(reply.createdAt)"
              :type="getTimelineType(reply.actionType)"
              :hollow="isActionItem(reply.actionType)"
            >
              <div class="reply-item">
                <div class="reply-header">
                  <el-avatar :size="32">
                    {{ reply.user?.username?.charAt(0)?.toUpperCase() || 'S' }}
                  </el-avatar>
                  <div class="reply-user">
                    <span class="username">{{ reply.user?.username || '系统' }}</span>
                    <el-tag v-if="reply.actionType && reply.actionType !== 'REPLY'" size="small" type="info">
                      {{ getActionLabel(reply.actionType) }}
                    </el-tag>
                  </div>
                </div>
                <div class="reply-content">
                  <p>{{ reply.content }}</p>
                  <p v-if="reply.actionDetail" class="action-detail">{{ reply.actionDetail }}</p>
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-card v-if="!isClosed" class="reply-card" shadow="never">
          <div class="card-title">追加回复</div>
          <el-input
            v-model="replyContent"
            type="textarea"
            :rows="4"
            placeholder="请输入回复内容..."
            maxlength="2000"
            show-word-limit
          />
          <div class="reply-actions">
            <div class="status-actions">
              <el-select v-model="selectedStatus" placeholder="变更状态" clearable style="width: 140px; margin-right: 10px;">
                <el-option
                  v-for="s in availableStatuses"
                  :key="s"
                  :label="TICKET_STATUS[s]?.label"
                  :value="s"
                />
              </el-select>
              <el-select
                v-if="selectedStatus === 'CLOSED'"
                v-model="satisfaction"
                placeholder="满意度评分"
                style="width: 160px;"
              >
                <el-option label="1星 - 非常不满意" :value="1" />
                <el-option label="2星 - 不满意" :value="2" />
                <el-option label="3星 - 一般" :value="3" />
                <el-option label="4星 - 满意" :value="4" />
                <el-option label="5星 - 非常满意" :value="5" />
              </el-select>
            </div>
            <el-button type="primary" :loading="replying" @click="submitReply">
              发送回复
            </el-button>
          </div>
        </el-card>

        <el-card v-else class="closed-card" shadow="never">
          <el-result icon="success" title="工单已关闭" :sub-title="closedSubTitle">
            <template #extra>
              <el-button type="primary" @click="reopenTicket">重新打开</el-button>
            </template>
          </el-result>
        </el-card>
      </el-col>

      <el-col :span="7">
        <el-card class="side-card" shadow="never">
          <div class="card-title">SLA</div>
          <div v-if="ticket?.slaDeadline && !isClosed" class="sla-display">
            <div :class="['sla-countdown', ticket?.slaOverdue ? 'overdue' : '']">
              <el-icon v-if="ticket?.slaOverdue" :size="20"><WarningFilled /></el-icon>
              <span>{{ formatSlaRemaining(ticket?.slaRemaining) }}</span>
            </div>
            <div class="sla-deadline">
              截止时间: {{ formatDate(ticket?.slaDeadline) }}
            </div>
          </div>
          <div v-else class="sla-display">
            <el-tag type="info" size="large">—</el-tag>
          </div>
        </el-card>

        <el-card class="side-card" shadow="never">
          <div class="side-header">
            <div class="card-title">处理人</div>
            <el-button link type="primary" size="small" @click="showAssignDialog = true">
              <el-icon><Switch /></el-icon>转派
            </el-button>
          </div>
          <div v-if="ticket?.assignee" class="assignee-info">
            <el-avatar :size="36">
              {{ ticket.assignee.username?.charAt(0)?.toUpperCase() }}
            </el-avatar>
            <div>
              <div class="assignee-name">{{ ticket.assignee.username }}</div>
              <el-tag size="small" :type="ticket.assignee.role === 'ADMIN' ? 'danger' : 'info'">
                {{ ticket.assignee.role === 'ADMIN' ? '管理员' : '普通用户' }}
              </el-tag>
            </div>
          </div>
          <div v-else class="empty-assignee">
            <el-empty description="暂无处理人" :image-size="60" />
          </div>
        </el-card>

        <el-card class="side-card" shadow="never">
          <div class="side-header">
            <div class="card-title">协同处理人</div>
            <el-button link type="primary" size="small" @click="showCollaboratorDialog = true">
              <el-icon><Plus /></el-icon>添加
            </el-button>
          </div>
          <div v-if="ticket?.collaborators?.length" class="collaborator-list">
            <div v-for="c in ticket.collaborators" :key="c.id" class="collaborator-item">
              <el-avatar :size="28">
                {{ c.user?.username?.charAt(0)?.toUpperCase() }}
              </el-avatar>
              <span class="collaborator-name">{{ c.user?.username }}</span>
              <el-button link type="danger" size="small" @click="removeCollaborator(c.userId)">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>
          <div v-else class="empty-assignee">
            <el-empty description="暂无协同处理人" :image-size="60" />
          </div>
        </el-card>

        <el-card class="side-card" shadow="never">
          <div class="side-header">
            <div class="card-title">操作</div>
          </div>
          <div class="action-list">
            <el-button
              type="warning"
              plain
              style="width: 100%;"
              :disabled="ticket?.priority === 'URGENT' || isClosed"
              @click="escalatePriority"
            >
              <el-icon><Top /></el-icon>
              升级优先级
            </el-button>
            <el-button
              v-if="!isClosed"
              type="success"
              plain
              style="width: 100%; margin-top: 10px;"
              @click="markForReview"
            >
              <el-icon><Check /></el-icon>
              提交待回访
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="showAssignDialog" title="转派工单" width="400px">
      <el-form label-position="top">
        <el-form-item label="选择处理人">
          <el-select v-model="newAssigneeId" placeholder="请选择处理人" style="width: 100%;" filterable>
            <el-option v-for="user in users" :key="user.id" :label="user.username" :value="user.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAssignDialog = false">取消</el-button>
        <el-button type="primary" :loading="assigning" @click="confirmAssign">确定转派</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCollaboratorDialog" title="添加协同处理人" width="400px">
      <el-form label-position="top">
        <el-form-item label="选择用户（可多选）">
          <el-select
            v-model="selectedCollaborators"
            multiple
            filterable
            placeholder="请选择用户"
            style="width: 100%;"
          >
            <el-option
              v-for="user in availableCollaborators"
              :key="user.id"
              :label="user.username"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCollaboratorDialog = false">取消</el-button>
        <el-button type="primary" :loading="addingCollab" @click="confirmAddCollaborators">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTicketStore } from '../stores/ticket';
import api from '../api/axios';
import { ticketApi, TICKET_CATEGORY, TICKET_PRIORITY, TICKET_STATUS, CLOSED_STATUSES } from '../api/tickets';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  ArrowLeft, User, Clock, Paperclip, Document, WarningFilled,
  Switch, Plus, Close, Top, Check,
} from '@element-plus/icons-vue';

const route = useRoute();
const ticketStore = useTicketStore();

const ticketId = computed(() => parseInt(route.params.id));
const ticket = ref(null);
const loading = ref(false);
const replying = ref(false);
const assigning = ref(false);
const addingCollab = ref(false);
const users = ref([]);

const replyContent = ref('');
const selectedStatus = ref('');
const satisfaction = ref(null);

const showAssignDialog = ref(false);
const showCollaboratorDialog = ref(false);
const newAssigneeId = ref(null);
const selectedCollaborators = ref([]);

const isClosed = computed(() => ticket.value && CLOSED_STATUSES.includes(ticket.value.status));

const closedSubTitle = computed(() => {
  if (!ticket.value) return '';
  if (ticket.value.status === 'REJECTED') return '工单已被驳回';
  if (ticket.value.satisfaction) {
    const stars = '★'.repeat(ticket.value.satisfaction) + '☆'.repeat(5 - ticket.value.satisfaction);
    return `会员满意度: ${stars} (${ticket.value.satisfaction}/5)`;
  }
  return '会员尚未评价';
});

const availableStatuses = computed(() => {
  if (!ticket.value) return [];
  const transitions = {
    PENDING_ASSIGN: ['PENDING_PROCESS', 'REJECTED'],
    PENDING_PROCESS: ['PROCESSING', 'PENDING_ASSIGN', 'REJECTED'],
    PROCESSING: ['PENDING_REVIEW', 'CLOSED', 'PENDING_PROCESS'],
    PENDING_REVIEW: ['PROCESSING', 'CLOSED'],
    CLOSED: [],
    REJECTED: ['PENDING_PROCESS'],
  };
  return transitions[ticket.value.status] || [];
});

const availableCollaborators = computed(() => {
  if (!ticket.value || !users.value.length) return users.value;
  const existingIds = new Set(ticket.value.collaborators.map((c) => c.userId));
  if (ticket.value.assigneeId) existingIds.add(ticket.value.assigneeId);
  return users.value.filter((u) => !existingIds.has(u.id));
});

const fetchTicket = async () => {
  loading.value = true;
  try {
    ticket.value = await ticketApi.get(ticketId.value);
  } finally {
    loading.value = false;
  }
};

const fetchUsers = async () => {
  users.value = await api.get('/users');
};

const submitReply = async () => {
  if (!replyContent.value.trim() && !selectedStatus.value) {
    ElMessage.warning('请输入回复内容或选择状态变更');
    return;
  }
  replying.value = true;
  try {
    if (selectedStatus.value) {
      const updateData = { status: selectedStatus.value };
      if (selectedStatus.value === 'CLOSED' && satisfaction.value) {
        updateData.satisfaction = satisfaction.value;
      }
      await ticketStore.updateTicket(ticketId.value, updateData);
    }
    if (replyContent.value.trim()) {
      await ticketStore.replyTicket(ticketId.value, {
        content: replyContent.value.trim(),
      });
    }
    ElMessage.success('操作成功');
    replyContent.value = '';
    selectedStatus.value = '';
    satisfaction.value = null;
    await fetchTicket();
  } finally {
    replying.value = false;
  }
};

const confirmAssign = async () => {
  if (!newAssigneeId.value) {
    ElMessage.warning('请选择处理人');
    return;
  }
  assigning.value = true;
  try {
    await ticketStore.assignTicket(ticketId.value, newAssigneeId.value);
    ElMessage.success('转派成功');
    showAssignDialog.value = false;
    newAssigneeId.value = null;
    await fetchTicket();
  } finally {
    assigning.value = false;
  }
};

const confirmAddCollaborators = async () => {
  if (!selectedCollaborators.value.length) {
    ElMessage.warning('请选择用户');
    return;
  }
  addingCollab.value = true;
  try {
    await ticketStore.addCollaborators(ticketId.value, selectedCollaborators.value);
    ElMessage.success('添加成功');
    showCollaboratorDialog.value = false;
    selectedCollaborators.value = [];
    await fetchTicket();
  } finally {
    addingCollab.value = false;
  }
};

const removeCollaborator = async (userId) => {
  try {
    await ElMessageBox.confirm('确定移除该协同处理人吗？', '提示', { type: 'warning' });
    await ticketStore.removeCollaborator(ticketId.value, userId);
    ElMessage.success('已移除');
    await fetchTicket();
  } catch (e) {}
};

const escalatePriority = async () => {
  try {
    await ticketStore.escalateTicket(ticketId.value);
    ElMessage.success('优先级已升级');
    await fetchTicket();
  } catch (e) {}
};

const markForReview = async () => {
  try {
    await ElMessageBox.confirm('确定将工单标记为待回访吗？', '提示');
    await ticketStore.updateTicket(ticketId.value, { status: 'PENDING_REVIEW' });
    ElMessage.success('已标记待回访');
    await fetchTicket();
  } catch (e) {}
};

const reopenTicket = async () => {
  try {
    await ElMessageBox.confirm('确定重新打开此工单吗？', '提示');
    await ticketStore.updateTicket(ticketId.value, { status: 'PENDING_PROCESS' });
    ElMessage.success('工单已重新打开');
    await fetchTicket();
  } catch (e) {}
};

const getTimelineType = (actionType) => {
  const map = {
    CREATE: 'primary',
    UPDATE: 'warning',
    REPLY: '',
    ASSIGN: 'success',
    ESCALATE: 'danger',
    ADD_COLLABORATOR: 'success',
    REMOVE_COLLABORATOR: 'info',
  };
  return map[actionType] || '';
};

const isActionItem = (actionType) => actionType && actionType !== 'REPLY';

const getActionLabel = (actionType) => {
  const map = {
    CREATE: '创建',
    UPDATE: '更新',
    ASSIGN: '转派',
    ESCALATE: '升级',
    ADD_COLLABORATOR: '添加协同',
    REMOVE_COLLABORATOR: '移除协同',
  };
  return map[actionType] || actionType;
};

const formatDate = (date) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '');

const formatSlaRemaining = (ms) => {
  if (ms === null || ms === undefined) return '—';
  const abs = Math.abs(ms);
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  const sign = ms < 0 ? '超时 ' : '';
  if (days > 0) return `${sign}${days}天${hours}小时${mins}分`;
  if (hours > 0) return `${sign}${hours}小时${mins}分`;
  return `${sign}${mins}分钟`;
};

onMounted(async () => {
  await fetchUsers();
  await fetchTicket();
});

watch(ticketId, () => {
  fetchTicket();
});
</script>

<style scoped>
.ticket-detail {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 4px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  color: #64748b;
  padding: 4px 8px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 16px;
}

.info-card, .timeline-card, .reply-card, .closed-card, .side-card {
  border-radius: 12px;
  border: none;
  margin-bottom: 20px;
}

.ticket-meta {
  display: flex;
  align-items: center;
  gap: 20px;
  color: #64748b;
  font-size: 13px;
  margin-bottom: 16px;
}

.ticket-meta > span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ticket-content {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  line-height: 1.8;
  color: #334155;
  white-space: pre-wrap;
}

.attachments-section {
  margin-top: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  margin-bottom: 10px;
}

.attachments-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-tag {
  max-width: 240px;
}

.reply-item {
  padding: 4px 0;
}

.reply-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.reply-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.username {
  font-weight: 500;
  color: #1e293b;
  font-size: 14px;
}

.reply-content p {
  margin: 0;
  color: #334155;
  line-height: 1.7;
}

.action-detail {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px !important;
}

.reply-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.status-actions {
  display: flex;
  align-items: center;
}

.side-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.side-header .card-title {
  margin-bottom: 0;
}

.sla-display {
  text-align: center;
  padding: 8px 0;
}

.sla-countdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 24px;
  font-weight: 700;
  color: #16a34a;
  margin-bottom: 8px;
}

.sla-countdown.overdue {
  color: #ef4444;
}

.sla-deadline {
  font-size: 12px;
  color: #94a3b8;
}

.assignee-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.assignee-name {
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
}

.empty-assignee {
  padding: 8px 0;
}

.collaborator-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.collaborator-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collaborator-name {
  flex: 1;
  font-size: 14px;
  color: #334155;
}

.action-list {
  display: flex;
  flex-direction: column;
}

.mr-4 { margin-right: 4px; }

:deep(.el-timeline-item__timestamp) {
  color: #94a3b8;
  font-size: 12px;
}

:deep(.el-timeline-item__tail) {
  border-color: #e2e8f0;
}

:deep(.el-timeline-item__node) {
  background-color: #e2e8f0;
}

:deep(.el-timeline-item__node--primary) {
  background-color: #3b82f6;
}

:deep(.el-timeline-item__node--success) {
  background-color: #16a34a;
}

:deep(.el-timeline-item__node--warning) {
  background-color: #f59e0b;
}

:deep(.el-timeline-item__node--danger) {
  background-color: #ef4444;
}

:deep(.el-timeline-item__node--info) {
  background-color: #64748b;
}

:deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
  border: none;
}
</style>
