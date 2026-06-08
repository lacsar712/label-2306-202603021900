<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="`版本管理 - ${template?.name || ''}`"
    width="1100px"
    destroy-on-close
    @closed="resetState"
  >
    <div class="template-version-dialog">
      <div class="toolbar">
        <el-button type="primary" @click="showCreateForm = !showCreateForm">
          <el-icon class="mr-4"><Plus /></el-icon>
          {{ showCreateForm ? '取消创建' : '新建版本' }}
        </el-button>
      </div>

      <el-form
        v-if="showCreateForm"
        :model="createForm"
        :rules="createRules"
        ref="createFormRef"
        label-position="top"
        class="create-form"
      >
        <el-card shadow="never" class="form-card">
          <template #header>
            <div class="card-header">
              <span>新建版本</span>
              <el-tag type="info">创建后将自动设为当前版本</el-tag>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :span="24">
              <el-form-item label="标题模板" prop="titleTemplate">
                <el-input v-model="createForm.titleTemplate" placeholder="请输入标题模板" />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="内容模板" prop="contentTemplate">
                <el-input
                  v-model="createForm.contentTemplate"
                  type="textarea"
                  :rows="4"
                  placeholder="请输入内容模板"
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="渠道规则 (JSON)">
                <el-input
                  v-model="createForm.channelRulesStr"
                  type="textarea"
                  :rows="3"
                  placeholder='例如：{"SMS": {"enabled": true}, "EMAIL": {"enabled": false}}'
                />
              </el-form-item>
            </el-col>
            <el-col :span="24">
              <el-form-item label="备注">
                <el-input v-model="createForm.remark" placeholder="请输入版本备注" />
              </el-form-item>
            </el-col>
          </el-row>
          <div class="form-actions">
            <el-button @click="showCreateForm = false; resetCreateForm()">取消</el-button>
            <el-button type="primary" :loading="creating" @click="handleCreateVersion">
              确认创建
            </el-button>
          </div>
        </el-card>
      </el-form>

      <el-table
        :data="versions"
        v-loading="loading"
        style="width: 100%; margin-top: 16px"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
        :row-class-name="getRowClassName"
      >
        <el-table-column label="版本号" width="100" align="center">
          <template #default="{ row }">
            <div class="version-cell">
              <el-tag v-if="row.id === template?.currentVersionId" type="success" effect="dark" size="small" class="current-tag">
                当前
              </el-tag>
              <span class="version-number">V{{ row.versionNumber }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="标题预览" min-width="160">
          <template #default="{ row }">
            <span class="ellipsis-text" :title="row.titleTemplate">
              {{ row.titleTemplate }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="内容预览" min-width="260">
          <template #default="{ row }">
            <span class="ellipsis-text content-preview" :title="row.contentTemplate">
              {{ truncate(row.contentTemplate, 60) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="140">
          <template #default="{ row }">
            <span class="ellipsis-text" :title="row.remark || '-'">
              {{ row.remark || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170" align="center">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              link
              type="warning"
              :disabled="row.id === template?.currentVersionId"
              @click="handleRollback(row)"
            >
              设为当前
            </el-button>
            <el-button link type="primary" @click="handleViewDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="showDetailDialog"
      title="版本详情"
      width="720px"
      destroy-on-close
    >
      <div v-if="selectedVersion" class="version-detail">
        <div class="detail-header">
          <el-tag :type="selectedVersion.id === template?.currentVersionId ? 'success' : 'info'" size="large">
            {{ selectedVersion.id === template?.currentVersionId ? '当前版本' : '历史版本' }}
          </el-tag>
          <span class="detail-version">V{{ selectedVersion.versionNumber }}</span>
          <span class="detail-date">{{ formatDate(selectedVersion.createdAt) }}</span>
        </div>

        <el-descriptions :column="1" border size="default">
          <el-descriptions-item label="标题模板">
            <div class="pre-wrap">{{ selectedVersion.titleTemplate }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="内容模板">
            <div class="pre-wrap">{{ selectedVersion.contentTemplate }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="渠道规则">
            <pre class="json-pre">{{ formatJson(selectedVersion.channelRules) }}</pre>
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ selectedVersion.remark || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="showDiff && currentVersion && selectedVersion.id !== currentVersion.id" class="diff-section">
          <el-divider content-position="left">与当前版本对比</el-divider>
          <el-row :gutter="16">
            <el-col :span="12">
              <div class="diff-label">
                <el-tag type="success" size="small">当前版本 V{{ currentVersion.versionNumber }}</el-tag>
              </div>
              <el-descriptions :column="1" border size="small" class="diff-desc">
                <el-descriptions-item label="标题">
                  <div class="pre-wrap">{{ currentVersion.titleTemplate }}</div>
                </el-descriptions-item>
                <el-descriptions-item label="内容">
                  <div class="pre-wrap">{{ currentVersion.contentTemplate }}</div>
                </el-descriptions-item>
              </el-descriptions>
            </el-col>
            <el-col :span="12">
              <div class="diff-label">
                <el-tag type="info" size="small">选中版本 V{{ selectedVersion.versionNumber }}</el-tag>
              </div>
              <el-descriptions :column="1" border size="small" class="diff-desc">
                <el-descriptions-item label="标题">
                  <div class="pre-wrap" :class="{ 'diff-changed': currentVersion.titleTemplate !== selectedVersion.titleTemplate }">
                    {{ selectedVersion.titleTemplate }}
                  </div>
                </el-descriptions-item>
                <el-descriptions-item label="内容">
                  <div class="pre-wrap" :class="{ 'diff-changed': currentVersion.contentTemplate !== selectedVersion.contentTemplate }">
                    {{ selectedVersion.contentTemplate }}
                  </div>
                </el-descriptions-item>
              </el-descriptions>
            </el-col>
          </el-row>
        </div>
      </div>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button
          v-if="selectedVersion && selectedVersion.id !== template?.currentVersionId"
          type="warning"
          @click="handleRollbackFromDetail"
        >
          设为当前版本
        </el-button>
      </template>
    </el-dialog>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { useTemplateStore } from '../stores/template';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';

const props = defineProps({
  modelValue: Boolean,
  template: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['update:modelValue', 'success']);

const templateStore = useTemplateStore();

const loading = ref(false);
const creating = ref(false);
const versions = ref([]);
const showCreateForm = ref(false);
const createFormRef = ref(null);
const showDetailDialog = ref(false);
const selectedVersion = ref(null);
const showDiff = ref(true);

const createForm = reactive({
  titleTemplate: '',
  contentTemplate: '',
  channelRulesStr: '',
  remark: '',
});

const createRules = {
  titleTemplate: [{ required: true, message: '请输入标题模板', trigger: 'blur' }],
  contentTemplate: [{ required: true, message: '请输入内容模板', trigger: 'blur' }],
};

const currentVersion = computed(() => {
  return versions.value.find((v) => v.id === props.template?.currentVersionId) || null;
});

const truncate = (text, len = 50) => {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '...' : text;
};

const formatDate = (date) => {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
};

const formatJson = (obj) => {
  if (!obj) return '{}';
  try {
    return typeof obj === 'string' ? JSON.stringify(JSON.parse(obj), null, 2) : JSON.stringify(obj, null, 2);
  } catch {
    return typeof obj === 'string' ? obj : JSON.stringify(obj);
  }
};

const getRowClassName = ({ row }) => {
  return row.id === props.template?.currentVersionId ? 'current-version-row' : '';
};

const resetCreateForm = () => {
  createForm.titleTemplate = currentVersion.value?.titleTemplate || '';
  createForm.contentTemplate = currentVersion.value?.contentTemplate || '';
  createForm.channelRulesStr = currentVersion.value?.channelRules
    ? JSON.stringify(currentVersion.value.channelRules, null, 2)
    : '';
  createForm.remark = '';
  nextTick(() => {
    createFormRef.value?.clearValidate();
  });
};

const resetState = () => {
  versions.value = [];
  showCreateForm.value = false;
  showDetailDialog.value = false;
  selectedVersion.value = null;
  resetCreateForm();
};

const fetchVersions = async () => {
  if (!props.template?.id) return;
  loading.value = true;
  try {
    versions.value = await templateStore.fetchVersions(props.template.id);
  } finally {
    loading.value = false;
  }
};

const handleCreateVersion = async () => {
  if (!createFormRef.value) return;
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return;

    let channelRules = {};
    if (createForm.channelRulesStr.trim()) {
      try {
        channelRules = JSON.parse(createForm.channelRulesStr);
      } catch {
        ElMessage.error('渠道规则 JSON 格式错误');
        return;
      }
    }

    creating.value = true;
    try {
      await templateStore.createVersion(props.template.id, {
        titleTemplate: createForm.titleTemplate,
        contentTemplate: createForm.contentTemplate,
        channelRules,
        remark: createForm.remark,
      });
      ElMessage.success('版本创建成功，已设为当前版本');
      showCreateForm.value = false;
      resetCreateForm();
      await fetchVersions();
      emit('success');
    } finally {
      creating.value = false;
    }
  });
};

const handleRollback = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要将版本 V${row.versionNumber} 设为当前版本吗？`,
      '回滚确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await templateStore.rollback(props.template.id, row.id);
    ElMessage.success(`已回滚到版本 V${row.versionNumber}`);
    await fetchVersions();
    emit('success');
  } catch {
    // 用户取消
  }
};

const handleRollbackFromDetail = async () => {
  if (!selectedVersion.value) return;
  showDetailDialog.value = false;
  await handleRollback(selectedVersion.value);
};

const handleViewDetail = (row) => {
  selectedVersion.value = row;
  showDetailDialog.value = true;
};

watch(
  () => props.modelValue,
  (val) => {
    if (val && props.template?.id) {
      fetchVersions();
    }
  }
);
</script>

<style scoped>
.template-version-dialog {
  padding: 4px 0;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.mr-4 {
  margin-right: 4px;
}

.create-form {
  margin-top: 8px;
}

.form-card {
  border: 1px solid #e2e8f0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.version-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.current-tag {
  margin-right: 0;
}

.version-number {
  font-weight: 600;
  color: #1e293b;
}

.ellipsis-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.content-preview {
  color: #64748b;
}

:deep(.current-version-row) {
  background-color: #f0fdf4 !important;
}

:deep(.current-version-row:hover > td) {
  background-color: #dcfce7 !important;
}

.version-detail {
  padding: 4px 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.detail-version {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.detail-date {
  color: #64748b;
  font-size: 13px;
}

.pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

.json-pre {
  margin: 0;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  max-height: 240px;
  overflow: auto;
}

.diff-section {
  margin-top: 16px;
}

.diff-label {
  margin-bottom: 8px;
}

.diff-desc :deep(.el-descriptions__cell) {
  padding: 6px 10px;
}

.diff-changed {
  background-color: #fef3c7;
  padding: 2px 4px;
  border-radius: 2px;
}
</style>
