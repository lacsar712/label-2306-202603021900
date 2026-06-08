<template>
  <div class="member-list">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">会员列表</h2>
        <p class="page-subtitle">管理和查看所有系统会员信息</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showAddDialog = true">
          <el-icon class="mr-4"><Plus /></el-icon>新增会员
        </el-button>
        <el-button type="warning" @click="$router.push('/points')">会员积分</el-button>
      </div>
    </div>

    <el-card class="filter-card mb-24" shadow="never">
      <div class="filter-header">
        <div class="search-group">
          <el-input
            v-model="search"
            placeholder="搜索姓名或手机号"
            class="search-input"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-select v-model="filterLevel" placeholder="会员等级" clearable @change="handleSearch" class="level-select">
            <el-option label="普通会员" value="NORMAL" />
            <el-option label="白银会员" value="SILVER" />
            <el-option label="黄金会员" value="GOLD" />
            <el-option label="铂金会员" value="PLATINUM" />
          </el-select>
          <el-select v-model="filterChannel" placeholder="来源渠道" clearable @change="handleSearch" class="channel-select" filterable>
            <el-option
              v-for="ch in channelOptions"
              :key="ch.id"
              :label="ch.name"
              :value="ch.id"
            />
          </el-select>
          <el-button type="primary" plain @click="handleSearch">搜索</el-button>
        </div>
      </div>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table 
        v-loading="memberStore.loading"
        :data="memberStore.members" 
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
        row-class-name="member-row"
      >
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="phone" label="手机号" min-width="120" />
        <el-table-column prop="level" label="等级" min-width="100">
          <template #default="{ row }">
            <el-tag :type="getLevelTagType(row.level)">{{ getLevelLabel(row.level) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="积分" min-width="80" />
        <el-table-column label="工单统计" min-width="160">
          <template #default="{ row }">
            <div class="ticket-stats">
              <el-tag type="info" size="small" effect="plain">
                总计 {{ row.totalTickets || 0 }}
              </el-tag>
              <el-tag
                v-if="(row.openTickets || 0) > 0"
                type="warning"
                size="small"
                effect="dark"
              >
                未关闭 {{ row.openTickets || 0 }}
              </el-tag>
              <el-tag v-else type="success" size="small" effect="plain">
                无进行中
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源渠道" min-width="140">
          <template #default="{ row }">
            <el-tag v-if="row.sourceChannel" type="primary" effect="plain" size="small">
              {{ row.sourceChannel.name }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="推荐人" min-width="160">
          <template #default="{ row }">
            <div v-if="row.referrer">
              <div class="font-medium">{{ row.referrer.name }}</div>
              <div class="text-muted text-sm">{{ row.referrer.phone }}</div>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="推荐码" min-width="120">
          <template #default="{ row }">
            <el-tag v-if="row.referralCode" type="warning" effect="plain" size="small" class="font-mono">
              {{ row.referralCode }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="直推人数" min-width="100" align="center">
          <template #default="{ row }">
            <span class="font-medium text-primary">{{ row.directReferrals || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" min-width="100">
          <template #default="{ row }">
            <el-badge :is-dot="true" :type="getStatusType(row.status)">
              <span class="ml-8">{{ getStatusLabel(row.status) }}</span>
            </el-badge>
          </template>
        </el-table-column>
        <el-table-column prop="joinDate" label="加入时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.joinDate) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="260">
          <template #default="{ row }">
            <el-button link @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="$router.push({ path: '/points', query: { memberId: row.id } })">积分</el-button>
            <el-button link type="primary" @click="$router.push({ path: '/tickets', query: { memberId: row.id } })">工单</el-button>
            <el-popconfirm title="确定删除该会员吗？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="showAddDialog"
      :title="isEdit ? '编辑会员' : '新增会员'"
      width="480px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="等级" prop="level">
              <el-select v-model="form.level" class="w-full">
                <el-option label="普通会员" value="NORMAL" />
                <el-option label="白银会员" value="SILVER" />
                <el-option label="黄金会员" value="GOLD" />
                <el-option label="铂金会员" value="PLATINUM" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="积分" prop="points">
              <el-input-number v-model="form.points" :min="0" class="w-full" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio label="ACTIVE">活跃</el-radio>
            <el-radio label="INACTIVE">不活跃</el-radio>
            <el-radio label="SUSPENDED">已停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-divider content-position="left">来源信息</el-divider>
        <el-form-item label="来源渠道" prop="sourceChannelId">
          <el-select v-model="form.sourceChannelId" placeholder="请选择来源渠道" clearable filterable class="w-full">
            <el-option
              v-for="ch in channelOptions"
              :key="ch.id"
              :label="ch.name"
              :value="ch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="首次触达时间" prop="firstTouchAt">
          <el-date-picker
            v-model="form.firstTouchAt"
            type="datetime"
            placeholder="选择首次触达时间"
            class="w-full"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="UTM Source" prop="utmSource">
              <el-input v-model="form.utmSource" placeholder="source" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="UTM Medium" prop="utmMedium">
              <el-input v-model="form.utmMedium" placeholder="medium" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="UTM Campaign" prop="utmCampaign">
              <el-input v-model="form.utmCampaign" placeholder="campaign" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">推荐关系</el-divider>

        <el-form-item v-if="form.referrerName" label="当前推荐人">
          <div class="current-referrer">
            <el-tag type="primary" effect="plain">
              {{ form.referrerName }} - {{ form.referrerPhone }}
            </el-tag>
            <el-button
              v-if="isEdit"
              link
              type="danger"
              size="small"
              @click="handleUnbindCurrentReferrer"
            >
              解除绑定
            </el-button>
          </div>
        </el-form-item>

        <el-form-item v-if="!form.referrerName" label="绑定方式">
          <el-radio-group v-model="bindMode">
            <el-radio label="phone">通过手机号</el-radio>
            <el-radio label="code">通过推荐码</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="!form.referrerName && bindMode === 'phone'" label="搜索推荐人">
          <div class="referrer-search-group">
            <el-input
              v-model="referrerSearchKeyword"
              placeholder="输入推荐人手机号搜索"
              :loading="referrerSearchLoading"
              class="flex-1"
              @keyup.enter="handleReferrerSearch"
            >
              <template #append>
                <el-button @click="handleReferrerSearch">搜索</el-button>
              </template>
            </el-input>
          </div>
          <div v-if="referrerCandidates.length > 0" class="referrer-candidate-list">
            <div
              v-for="m in referrerCandidates"
              :key="m.id"
              class="referrer-candidate-item"
              @click="selectReferrer(m)"
            >
              <div class="candidate-name">{{ m.name }}</div>
              <div class="candidate-phone">{{ m.phone }}</div>
              <el-tag v-if="m.referralCode" size="small" type="warning" effect="plain">
                {{ m.referralCode }}
              </el-tag>
            </div>
          </div>
          <div v-if="form.referrerId && form.referrerName" class="selected-referrer">
            <el-icon color="#10b981"><CircleCheck /></el-icon>
            <span>已选择: {{ form.referrerName }} - {{ form.referrerPhone }}</span>
            <el-button link type="danger" size="small" @click="clearReferrer">清除</el-button>
          </div>
        </el-form-item>

        <el-form-item v-if="!form.referrerName && bindMode === 'code'" label="推荐码">
          <div class="referrer-search-group">
            <el-input
              v-model="form.bindReferralCode"
              placeholder="输入推荐码"
              class="flex-1"
            />
            <el-button
              v-if="isEdit"
              type="primary"
              @click="handleBindByCode"
            >
              绑定
            </el-button>
            <span v-else class="text-muted ml-8">
              <el-icon><InfoFilled /></el-icon>
              保存后可绑定
            </span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import { useMemberStore } from '../stores/member';
import { useReferralStore } from '../stores/referral';
import { useChannelStore } from '../stores/channel';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CircleCheck, InfoFilled } from '@element-plus/icons-vue';

const memberStore = useMemberStore();
const referralStore = useReferralStore();
const channelStore = useChannelStore();
const search = ref('');
const filterLevel = ref('');
const filterChannel = ref('');
const showAddDialog = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const formRef = ref(null);
const channelOptions = ref([]);
const referrerSearchLoading = ref(false);
const referrerSearchKeyword = ref('');
const referrerCandidates = ref([]);
const bindMode = ref('phone');

const form = reactive({
  id: null,
  name: '',
  phone: '',
  email: '',
  level: 'NORMAL',
  points: 0,
  status: 'ACTIVE',
  sourceChannelId: null,
  firstTouchAt: '',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  referrerId: null,
  referrerName: '',
  referrerPhone: '',
  bindReferralCode: '',
});

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  email: [{ type: 'email', message: '请输入正确的邮箱', trigger: 'blur' }]
};

const handleSearch = () => {
  memberStore.fetchMembers({
    search: search.value,
    level: filterLevel.value,
    channelId: filterChannel.value || undefined
  });
};

const loadChannels = async () => {
  channelOptions.value = await memberStore.fetchChannels();
};

const handleEdit = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  if (row.referrer) {
    form.referrerName = row.referrer.name;
    form.referrerPhone = row.referrer.phone;
  }
  showAddDialog.value = true;
};

const handleDelete = async (id) => {
  await memberStore.deleteMember(id);
  ElMessage.success('删除成功');
};

const resetForm = () => {
  isEdit.value = false;
  form.id = null;
  form.name = '';
  form.phone = '';
  form.email = '';
  form.level = 'NORMAL';
  form.points = 0;
  form.status = 'ACTIVE';
  form.sourceChannelId = null;
  form.firstTouchAt = '';
  form.utmSource = '';
  form.utmMedium = '';
  form.utmCampaign = '';
  form.referrerId = null;
  form.referrerName = '';
  form.referrerPhone = '';
  form.bindReferralCode = '';
  referrerSearchKeyword.value = '';
  referrerCandidates.value = [];
  bindMode.value = 'phone';
};

const handleReferrerSearch = async () => {
  const keyword = referrerSearchKeyword.value.trim();
  if (!keyword) return;
  referrerSearchLoading.value = true;
  try {
    const params = bindMode.value === 'phone' ? { phone: keyword } : { code: keyword.toUpperCase() };
    referrerCandidates.value = await referralStore.searchReferrer(params);
  } finally {
    referrerSearchLoading.value = false;
  }
};

const selectReferrer = (member) => {
  form.referrerId = member.id;
  form.referrerName = member.name;
  form.referrerPhone = member.phone;
  referrerCandidates.value = [];
  referrerSearchKeyword.value = '';
};

const clearReferrer = () => {
  form.referrerId = null;
  form.referrerName = '';
  form.referrerPhone = '';
  form.bindReferralCode = '';
};

const handleBindByCode = async () => {
  if (!form.bindReferralCode.trim()) {
    ElMessage.warning('请输入推荐码');
    return;
  }
  if (!form.id && !isEdit.value) {
    ElMessage.warning('请先保存会员信息后再绑定推荐人');
    return;
  }
  try {
    await referralStore.bindByCode({
      refereeId: form.id,
      referralCode: form.bindReferralCode.trim().toUpperCase(),
      bindChannel: 'MEMBER_FORM',
      bindSource: 'CODE',
    });
    ElMessage.success('绑定成功');
    await memberStore.fetchMembers();
    clearReferrer();
    showAddDialog.value = false;
  } catch (error) {
    ElMessage.error(error?.response?.data?.error || '绑定失败');
  }
};

const handleUnbindCurrentReferrer = async () => {
  try {
    await ElMessageBox.confirm('确定要解除该会员的推荐人绑定吗？', '确认解除', {
      type: 'warning',
    });
    await referralStore.unbindReferral(form.id);
    ElMessage.success('已解除推荐关系');
    clearReferrer();
    await memberStore.fetchMembers();
    showAddDialog.value = false;
  } catch {
  }
};

const submitForm = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        if (isEdit.value) {
          await memberStore.updateMember(form.id, form);
          if (form.referrerId && !form.referrer) {
            try {
              await referralStore.bindByPhone({
                refereeId: form.id,
                referrerPhone: form.referrerPhone,
                bindChannel: 'MEMBER_FORM',
                bindSource: 'PHONE',
              });
            } catch (bindError) {
              console.warn('推荐人绑定失败', bindError);
            }
          }
          ElMessage.success('更新成功');
        } else {
          await memberStore.addMember(form);
          ElMessage.success('添加成功');
        }
        showAddDialog.value = false;
      } finally {
        submitting.value = false;
      }
    }
  });
};

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getLevelTagType = (level) => {
  const map = { NORMAL: 'info', SILVER: 'primary', GOLD: 'warning', PLATINUM: 'success' };
  return map[level] || 'info';
};

const getStatusLabel = (status) => {
  const map = { ACTIVE: '活跃', INACTIVE: '不活跃', SUSPENDED: '已停用' };
  return map[status] || status;
};

const getStatusType = (status) => {
  const map = { ACTIVE: 'success', INACTIVE: 'info', SUSPENDED: 'danger' };
  return map[status] || 'info';
};

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm');

onMounted(() => {
  memberStore.fetchMembers();
  loadChannels();
});

watch(showAddDialog, (val) => {
  if (val) loadChannels();
});
</script>

<style scoped>
.member-list {
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

.header-actions {
  display: flex;
  gap: 12px;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #64748b;
}

.filter-card, .table-card {
  border-radius: 12px;
  border: none;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-group {
  display: flex;
  gap: 12px;
  flex: 1;
}

.search-input {
  max-width: 320px;
}

.level-select {
  width: 160px;
}

.channel-select {
  width: 180px;
}

.mb-24 {
  margin-bottom: 24px;
}

.mr-4 {
  margin-right: 4px;
}

.ml-8 {
  margin-left: 8px;
}

.w-full {
  width: 100%;
}

.ticket-stats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

:deep(.member-row) {
  transition: background-color 0.2s;
}

:deep(.member-row:hover) {
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

:deep(.el-tag--info) { background-color: #f1f5f9; color: #64748b; }
:deep(.el-tag--primary) { background-color: #eff6ff; color: #3b82f6; }
:deep(.el-tag--warning) { background-color: #fff7ed; color: #f97316; }
:deep(.el-tag--success) { background-color: #faf5ff; color: #a855f7; }

.text-muted {
  color: #94a3b8;
}

.current-referrer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.referrer-search-group {
  display: flex;
  width: 100%;
  gap: 8px;
  align-items: center;
}

.referrer-search-group .flex-1 {
  flex: 1;
}

.referrer-candidate-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.referrer-candidate-item {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.referrer-candidate-item:hover {
  background-color: #f8fafc;
}

.candidate-name {
  font-weight: 500;
  color: #1e293b;
}

.candidate-phone {
  font-size: 13px;
  color: #64748b;
  margin-right: 12px;
}

.selected-referrer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  background-color: #ecfdf5;
  border-radius: 8px;
  color: #065f46;
}

.text-primary {
  color: #4f46e5;
}

.font-mono {
  font-family: monospace;
}

.flex-1 {
  flex: 1;
}

.ml-8 {
  margin-left: 8px;
}
</style>
