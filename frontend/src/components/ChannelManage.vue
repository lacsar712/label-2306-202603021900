<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    title="渠道配置管理"
    width="900px"
    destroy-on-close
    @closed="resetState"
  >
    <div class="channel-manage">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="渠道列表" name="list">
          <div class="tab-toolbar">
            <el-button type="primary" @click="handleAdd" v-if="isAdmin">
              <el-icon class="mr-4"><Plus /></el-icon>新增渠道
            </el-button>
            <el-button type="warning" @click="showMergeDialog = true" v-if="isAdmin && flatChannels.length >= 2">
              <el-icon class="mr-4"><Rank /></el-icon>合并渠道
            </el-button>
          </div>
          <el-table
            :data="channelStore.channels"
            row-key="id"
            default-expand-all
            :tree-props="{ children: 'children' }"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
          >
            <el-table-column prop="name" label="渠道名称" min-width="180">
              <template #default="{ row }">
                <span class="channel-name">
                  <span class="channel-level-dot" :style="{ backgroundColor: getLevelColor(row.level) }" />
                  {{ row.name }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="code" label="渠道编码" min-width="120" />
            <el-table-column label="层级" min-width="80" align="center">
              <template #default="{ row }">
                <el-tag size="small" type="info" effect="plain">Lv.{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="负责人" min-width="100">
              <template #default="{ row }">
                {{ row.manager?.username || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="会员数" min-width="80" align="right">
              <template #default="{ row }">
                {{ row._count?.members || 0 }}
              </template>
            </el-table-column>
            <el-table-column label="状态" min-width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
                  {{ row.isActive ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="排序" min-width="80" align="center" prop="sortOrder" />
            <el-table-column label="操作" width="180" fixed="right" v-if="isAdmin">
              <template #default="{ row }">
                <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
                <el-button link type="warning" @click="handleAddChild(row)">添加子渠道</el-button>
                <el-popconfirm
                  title="确定删除该渠道吗？有子渠道或关联会员时无法删除。"
                  @confirm="handleDelete(row.id)"
                >
                  <template #reference>
                    <el-button link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog
      v-model="showFormDialog"
      :title="isEdit ? '编辑渠道' : (parentChannel ? '新增子渠道' : '新增渠道')"
      width="520px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-form-item label="渠道名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入渠道名称" />
        </el-form-item>
        <el-form-item label="渠道编码" prop="code">
          <el-input v-model="form.code" placeholder="请输入渠道编码（英文唯一标识）" />
        </el-form-item>
        <el-form-item label="上级渠道" prop="parentId">
          <el-tree-select
            v-model="form.parentId"
            :data="treeOptions"
            :props="{ label: 'name', value: 'id', children: 'children' }"
            placeholder="选择上级渠道（不选则为顶级渠道）"
            check-strictly
            clearable
            class="w-full"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="渠道负责人" prop="managerId">
              <el-select v-model="form.managerId" placeholder="选择负责人" clearable class="w-full">
                <el-option
                  v-for="user in users"
                  :key="user.id"
                  :label="user.username"
                  :value="user.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序" prop="sortOrder">
              <el-input-number v-model="form.sortOrder" :min="0" class="w-full" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="渠道预算" prop="budget">
          <el-input-number v-model="form.budget" :min="0" :precision="2" class="w-full" />
        </el-form-item>
        <el-form-item label="状态" prop="isActive">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入渠道描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFormDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showMergeDialog"
      title="合并渠道"
      width="500px"
      destroy-on-close
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="合并后，源渠道的所有会员将归并到目标渠道，源渠道会被删除，此操作不可撤销。"
        class="mb-16"
      />
      <el-form label-position="top">
        <el-form-item label="选择要合并的源渠道（可多选）">
          <el-select
            v-model="mergeForm.sourceIds"
            multiple
            placeholder="选择源渠道"
            class="w-full"
            filterable
          >
            <el-option
              v-for="ch in flatChannels.filter(c => c.id !== mergeForm.targetId)"
              :key="ch.id"
              :label="ch.name"
              :value="ch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="选择目标渠道">
          <el-select
            v-model="mergeForm.targetId"
            placeholder="选择目标渠道"
            class="w-full"
            filterable
          >
            <el-option
              v-for="ch in flatChannels.filter(c => !mergeForm.sourceIds.includes(c.id))"
              :key="ch.id"
              :label="ch.name"
              :value="ch.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMergeDialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="mergeForm.sourceIds.length < 2 || !mergeForm.targetId"
          :loading="merging"
          @click="submitMerge"
        >
          确认合并
        </el-button>
      </template>
    </el-dialog>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue';
import { useChannelStore } from '../stores/channel';
import { useAuthStore } from '../stores/auth';
import { Plus, Rank } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api from '../api/axios';

const props = defineProps({
  modelValue: Boolean
});

const emit = defineEmits(['update:modelValue', 'refresh']);

const channelStore = useChannelStore();
const authStore = useAuthStore();

const isAdmin = computed(() => authStore.isAdmin);

const activeTab = ref('list');
const showFormDialog = ref(false);
const showMergeDialog = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const merging = ref(false);
const formRef = ref(null);
const parentChannel = ref(null);
const users = ref([]);

const form = reactive({
  id: null,
  name: '',
  code: '',
  description: '',
  parentId: null,
  sortOrder: 0,
  managerId: null,
  isActive: true,
  budget: null
});

const mergeForm = reactive({
  sourceIds: [],
  targetId: null
});

const rules = {
  name: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入渠道编码', trigger: 'blur' }]
};

const flatChannels = computed(() => {
  const flatten = (arr) => {
    const result = [];
    arr.forEach(c => {
      result.push({ id: c.id, name: c.name, code: c.code });
      if (c.children?.length) result.push(...flatten(c.children));
    });
    return result;
  };
  return flatten(channelStore.channels);
});

const treeOptions = computed(() => {
  const transform = (arr) => arr.map(c => ({
    id: c.id,
    name: c.name,
    children: c.children?.length ? transform(c.children) : undefined
  }));
  return transform(channelStore.channels);
});

const getLevelColor = (level) => {
  const colors = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444'];
  return colors[(level - 1) % colors.length];
};

const resetForm = () => {
  isEdit.value = false;
  parentChannel.value = null;
  form.id = null;
  form.name = '';
  form.code = '';
  form.description = '';
  form.parentId = null;
  form.sortOrder = 0;
  form.managerId = null;
  form.isActive = true;
  form.budget = null;
};

const resetState = () => {
  activeTab.value = 'list';
  resetForm();
  showFormDialog.value = false;
  showMergeDialog.value = false;
  mergeForm.sourceIds = [];
  mergeForm.targetId = null;
};

const handleAdd = () => {
  isEdit.value = false;
  parentChannel.value = null;
  form.parentId = null;
  showFormDialog.value = true;
};

const handleAddChild = (row) => {
  isEdit.value = false;
  parentChannel.value = row;
  form.parentId = row.id;
  showFormDialog.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  Object.assign(form, {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    managerId: row.managerId,
    isActive: row.isActive,
    budget: row.budget
  });
  showFormDialog.value = true;
};

const handleDelete = async (id) => {
  try {
    await channelStore.deleteChannel(id);
    ElMessage.success('删除成功');
    emit('refresh');
  } catch (e) {
    // Error handled by axios interceptor
  }
};

const submitForm = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        if (isEdit.value) {
          await channelStore.updateChannel(form.id, form);
          ElMessage.success('更新成功');
        } else {
          await channelStore.createChannel(form);
          ElMessage.success('创建成功');
        }
        showFormDialog.value = false;
        emit('refresh');
      } finally {
        submitting.value = false;
      }
    }
  });
};

const submitMerge = async () => {
  merging.value = true;
  try {
    await channelStore.mergeChannels(mergeForm.sourceIds, mergeForm.targetId);
    ElMessage.success('合并成功');
    showMergeDialog.value = false;
    mergeForm.sourceIds = [];
    mergeForm.targetId = null;
    emit('refresh');
  } finally {
    merging.value = false;
  }
};

const fetchUsers = async () => {
  try {
    users.value = await api.get('/users');
  } catch (e) {
    // ignore
  }
};

watch(() => props.modelValue, (val) => {
  if (val) {
    channelStore.fetchChannels();
    if (isAdmin.value) fetchUsers();
  }
});
</script>

<style scoped>
.channel-manage {
  padding: 4px 0;
}

.tab-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.mr-4 { margin-right: 4px; }
.mb-16 { margin-bottom: 16px; }
.w-full { width: 100%; }

.channel-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.channel-level-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
