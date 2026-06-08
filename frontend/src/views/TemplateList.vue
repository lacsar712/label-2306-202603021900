<template>
  <div class="template-list">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">通知模板管理</h2>
        <p class="page-subtitle">创建和管理多渠道通知模板，支持版本控制、状态流转与发送记录追踪</p>
      </div>
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        新建模板
      </el-button>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="模板名称">
          <el-input v-model="filters.search" placeholder="搜索模板名称" clearable @input="fetchList" style="width: 200px" />
        </el-form-item>
        <el-form-item label="模板分类">
          <el-select v-model="filters.category" placeholder="全部分类" clearable @change="fetchList" style="width: 160px">
            <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="模板状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable @change="fetchList" style="width: 160px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table :data="store.templates" v-loading="store.loading" stripe>
        <el-table-column prop="name" label="模板名称" min-width="200">
          <template #default="{ row }">
            <span class="template-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="110">
          <template #default="{ row }">
            <el-tag :type="getCategoryTag(row.category)" size="small">{{ getCategoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)" effect="dark">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="推送渠道" width="160">
          <template #default="{ row }">
            <div class="channel-tags">
              <el-tag v-for="ch in row.channels || []" :key="ch" size="small" class="channel-tag" :type="getChannelTag(ch)">
                {{ getChannelLabel(ch) }}
              </el-tag>
              <span v-if="!row.channels || row.channels.length === 0" class="muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="当前版本" width="100" align="center">
          <template #default="{ row }">
            <span class="version-text" v-if="row.currentVersionId">v{{ row.currentVersion?.versionNumber || '-' }}</span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="版本数" width="90" align="center">
          <template #default="{ row }">
            {{ row.versionCount || row.versions?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="发送次数" width="100" align="center">
          <template #default="{ row }">
            {{ row.sendRecordCount || row.sendRecords?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="启用状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="(val) => handleToggleEnabled(row, val)"
              :active-text="'启用'"
              :inactive-text="'停用'"
              inline-prompt
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="handleVersionManage(row)">版本管理</el-button>
            <el-button link type="primary" @click="handleSend(row)">发送</el-button>
            <el-dropdown @command="(cmd) => handleStatusChange(row, cmd)" :disabled="!canTransition(row)">
              <el-button link type="primary">
                状态流转
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="target in getNextStatuses(row.status)"
                    :key="target"
                    :command="target"
                  >
                    转至 {{ getStatusLabel(target) }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <TemplateEditDialog
      v-model="editDialogVisible"
      :template="currentTemplate"
      @success="handleEditSuccess"
    />

    <TemplateVersionDialog
      v-model="versionDialogVisible"
      :template="currentTemplate"
      @success="fetchList"
    />

    <TemplateSendDialog
      v-model="sendDialogVisible"
      :template="currentTemplate"
      @success="handleSendSuccess"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useTemplateStore } from '../stores/template';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, ArrowDown } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import TemplateEditDialog from '../components/TemplateEditDialog.vue';
import TemplateVersionDialog from '../components/TemplateVersionDialog.vue';
import TemplateSendDialog from '../components/TemplateSendDialog.vue';

const store = useTemplateStore();

const editDialogVisible = ref(false);
const versionDialogVisible = ref(false);
const sendDialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref(null);
const currentTemplate = ref(null);

const filters = reactive({
  search: '',
  category: '',
  status: '',
});

const categoryOptions = [
  { value: 'SYSTEM', label: '系统通知' },
  { value: 'BIRTHDAY', label: '生日祝福' },
  { value: 'POINTS_EXPIRY', label: '积分到期' },
  { value: 'CAMPAIGN', label: '营销活动' },
  { value: 'TICKET', label: '工单通知' },
  { value: 'OTHER', label: '其他' },
];

const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING_REVIEW', label: '待审核' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'DISABLED', label: '已停用' },
];

const STATUS_TRANSITIONS = {
  DRAFT: ['PENDING_REVIEW', 'DISABLED'],
  PENDING_REVIEW: ['DRAFT', 'PUBLISHED', 'DISABLED'],
  PUBLISHED: ['DISABLED'],
  DISABLED: ['DRAFT'],
};

const CHANNEL_OPTIONS = [
  { value: 'SMS', label: '短信' },
  { value: 'EMAIL', label: '邮件' },
  { value: 'INAPP', label: '站内信' },
];

const getCategoryLabel = (c) => categoryOptions.find((o) => o.value === c)?.label || c;
const getCategoryTag = (c) => {
  const map = {
    SYSTEM: 'primary',
    BIRTHDAY: 'danger',
    POINTS_EXPIRY: 'warning',
    CAMPAIGN: 'success',
    TICKET: 'info',
    OTHER: 'info',
  };
  return map[c] || '';
};

const getStatusLabel = (s) => statusOptions.find((o) => o.value === s)?.label || s;
const getStatusTag = (s) => {
  const map = {
    DRAFT: 'info',
    PENDING_REVIEW: 'warning',
    PUBLISHED: 'success',
    DISABLED: 'danger',
  };
  return map[s] || '';
};

const getChannelLabel = (ch) => CHANNEL_OPTIONS.find((o) => o.value === ch)?.label || ch;
const getChannelTag = (ch) => {
  const map = {
    SMS: 'success',
    EMAIL: 'primary',
    INAPP: 'warning',
  };
  return map[ch] || '';
};

const formatDate = (d) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '');

const canTransition = (row) => getNextStatuses(row.status).length > 0;
const getNextStatuses = (current) => STATUS_TRANSITIONS[current] || [];

const fetchList = () => {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.category) params.category = filters.category;
  if (filters.status) params.status = filters.status;
  store.fetchTemplates(params);
};

const resetEditForm = () => {
  isEdit.value = false;
  editingId.value = null;
  currentTemplate.value = null;
};

const handleCreate = () => {
  resetEditForm();
  editDialogVisible.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  editingId.value = row.id;
  currentTemplate.value = row;
  editDialogVisible.value = true;
};

const handleVersionManage = (row) => {
  currentTemplate.value = row;
  versionDialogVisible.value = true;
};

const handleSend = (row) => {
  currentTemplate.value = row;
  sendDialogVisible.value = true;
};

const handleStatusChange = async (row, targetStatus) => {
  try {
    await ElMessageBox.confirm(
      `确定要将模板「${row.name}」状态变更为「${getStatusLabel(targetStatus)}」吗？`,
      '状态变更确认',
      { type: 'warning' }
    );
    await store.updateStatus(row.id, targetStatus);
    ElMessage.success('状态已更新');
  } catch {
    // cancelled
  }
};

const handleToggleEnabled = async (row, val) => {
  try {
    await store.updateTemplate(row.id, { enabled: val });
    ElMessage.success(val ? '已启用' : '已停用');
  } catch (e) {
    row.enabled = !val;
    ElMessage.error('操作失败');
  }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除模板「${row.name}」吗？`, '删除确认', {
      type: 'warning',
    });
    await store.deleteTemplate(row.id);
    ElMessage.success('模板已删除');
  } catch {
    // cancelled
  }
};

const handleEditSuccess = () => {
  ElMessage.success(isEdit.value ? '模板已更新' : '模板已创建');
  editDialogVisible.value = false;
  fetchList();
};

const handleSendSuccess = () => {
  ElMessage.success('通知已发送');
  sendDialogVisible.value = false;
  fetchList();
};

onMounted(() => {
  fetchList();
});
</script>

<style scoped>
.template-list {
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

.filter-card,
.table-card {
  border-radius: 12px;
  border: none;
  margin-bottom: 16px;
}

.filter-form {
  margin-bottom: 0;
}

.template-name {
  font-weight: 600;
  color: #1e293b;
}

.channel-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.channel-tag {
  margin: 0;
}

.version-text {
  font-weight: 600;
  color: #3b82f6;
}

.muted {
  color: #cbd5e1;
}

.dialog-placeholder {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}
</style>
