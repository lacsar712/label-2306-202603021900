<template>
  <div class="campaign-list">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">营销活动管理</h2>
        <p class="page-subtitle">创建和管理限时营销活动，支持双倍积分、满赠、等级加成等多种类型</p>
      </div>
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        新建活动
      </el-button>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="活动名称">
          <el-input v-model="filters.search" placeholder="搜索活动名称" clearable @input="fetchList" style="width: 200px" />
        </el-form-item>
        <el-form-item label="活动类型">
          <el-select v-model="filters.type" placeholder="全部类型" clearable @change="fetchList" style="width: 160px">
            <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="活动状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable @change="fetchList" style="width: 160px">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card" shadow="never">
      <el-table :data="store.campaigns" v-loading="store.loading" stripe>
        <el-table-column prop="name" label="活动名称" min-width="180">
          <template #default="{ row }">
            <span class="campaign-name">{{ row.name }}</span>
            <el-tag :type="getTypeTag(row.type)" size="small" class="type-tag">{{ getTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)" effect="dark">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="活动时间" width="320">
          <template #default="{ row }">
            <div class="time-range">
              <div class="time-item">
                <span class="time-label">开始</span>
                <span class="time-value">{{ formatDate(row.startTime) }}</span>
              </div>
              <div class="time-item">
                <span class="time-label">结束</span>
                <span class="time-value">{{ formatDate(row.endTime) }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="80" align="center" />
        <el-table-column prop="mutualExclusionGroup" label="互斥组" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.mutualExclusionGroup" size="small" type="warning">{{ row.mutualExclusionGroup }}</el-tag>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="participationCount" label="参与人次" width="100" align="center" />
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="(val) => handleToggleEnabled(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleViewStats(row)">数据</el-button>
            <el-button link type="primary" @click="handleEdit(row)" :disabled="!canEdit(row)">编辑</el-button>
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
            <el-button link type="danger" @click="handleDelete(row)" :disabled="!canDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑活动' : '新建活动'"
      width="720px"
      destroy-on-close
      @close="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="活动名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入活动名称" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="活动类型" prop="type">
          <el-select v-model="form.type" placeholder="请选择活动类型" style="width: 100%" :disabled="isEdit">
            <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开始时间" prop="startTime">
              <el-date-picker
                v-model="form.startTime"
                type="datetime"
                placeholder="选择开始时间"
                style="width: 100%"
                value-format="YYYY-MM-DDTHH:mm:ssZ"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="endTime">
              <el-date-picker
                v-model="form.endTime"
                type="datetime"
                placeholder="选择结束时间"
                style="width: 100%"
                value-format="YYYY-MM-DDTHH:mm:ssZ"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="适用会员等级" prop="applicableLevels">
          <el-select v-model="form.applicableLevels" multiple placeholder="不选表示适用所有等级" style="width: 100%">
            <el-option label="普通会员" value="NORMAL" />
            <el-option label="白银会员" value="SILVER" />
            <el-option label="黄金会员" value="GOLD" />
            <el-option label="铂金会员" value="PLATINUM" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用会员标签" prop="applicableTags">
          <el-select
            v-model="form.applicableTags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="不选表示适用所有标签"
            style="width: 100%"
          >
            <el-option
              v-for="tag in store.meta.tags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="适用来源渠道" prop="applicableChannels">
          <el-select v-model="form.applicableChannels" multiple placeholder="不选表示适用所有渠道" style="width: 100%">
            <el-option
              v-for="ch in store.meta.channels"
              :key="ch.code"
              :label="ch.name"
              :value="ch.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用活动" prop="enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="优先级" prop="priority">
              <el-input-number v-model="form.priority" :min="0" :max="999" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每人参与上限" prop="participationLimit">
              <el-input-number v-model="form.participationLimit" :min="0" style="width: 100%" />
              <div class="form-tip">0 表示不限制</div>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="互斥活动组" prop="mutualExclusionGroup">
          <el-input v-model="form.mutualExclusionGroup" placeholder="同组活动互斥，留空表示不互斥" />
        </el-form-item>

        <el-divider>规则参数配置</el-divider>

        <template v-if="form.type === 'DOUBLE_POINTS'">
          <el-form-item label="积分倍率" prop="ruleParams.multiplier">
            <el-input-number v-model="form.ruleParams.multiplier" :min="2" :max="10" style="width: 160px" />
            <span class="form-tip">最终积分 = 原始积分 × 倍率</span>
          </el-form-item>
        </template>

        <template v-if="form.type === 'SPEND_GIFT_POINTS'">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="满积分阈值" prop="ruleParams.threshold">
                <el-input-number v-model="form.ruleParams.threshold" :min="1" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="赠送积分" prop="ruleParams.giftPoints">
                <el-input-number v-model="form.ruleParams.giftPoints" :min="1" style="width: 100%" />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <template v-if="form.type === 'LEVEL_BONUS'">
          <el-form-item label="各等级加成比例">
            <div class="level-bonus-grid">
              <div v-for="level in ['NORMAL', 'SILVER', 'GOLD', 'PLATINUM']" :key="level" class="level-bonus-item">
                <span class="level-label">{{ getLevelLabel(level) }}</span>
                <el-input-number
                  v-model="form.ruleParams.levelBonus[level]"
                  :min="0"
                  :max="500"
                  size="small"
                />
                <span class="unit">%</span>
              </div>
            </div>
          </el-form-item>
        </template>

        <template v-if="form.type === 'SIGNIN_DOUBLE'">
          <el-form-item label="签到倍率" prop="ruleParams.multiplier">
            <el-input-number v-model="form.ruleParams.multiplier" :min="2" :max="10" style="width: 160px" />
            <span class="form-tip">签到积分 = 基础10分 × 倍率</span>
          </el-form-item>
        </template>

        <template v-if="form.type === 'EXCHANGE_DISCOUNT'">
          <el-form-item label="兑换折扣比例" prop="ruleParams.discountPct">
            <el-input-number v-model="form.ruleParams.discountPct" :min="1" :max="90" style="width: 160px" />
            <span class="unit">%</span>
            <span class="form-tip">实际扣除积分 = 原价 × (1 - 折扣比例)</span>
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="statsVisible" title="活动数据统计" width="800px" destroy-on-close>
      <div v-if="statsLoading" class="stats-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      </div>
      <div v-else-if="statsData">
        <el-row :gutter="16" class="stats-row">
          <el-col :span="8">
            <el-card class="mini-stat">
              <div class="mini-label">参与人次</div>
              <div class="mini-value">{{ statsData.participationCount }}</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="mini-stat">
              <div class="mini-label">独立会员数</div>
              <div class="mini-value">{{ statsData.uniqueMemberCount }}</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="mini-stat">
              <div class="mini-label">加成积分总量</div>
              <div class="mini-value accent">{{ statsData.totalBonusPoints }}</div>
            </el-card>
          </el-col>
        </el-row>

        <h4 class="stats-subtitle">按日参与趋势</h4>
        <el-table :data="statsData.dailyTrend" size="small" stripe v-if="statsData.dailyTrend.length > 0">
          <el-table-column prop="date" label="日期" width="140" />
          <el-table-column prop="count" label="参与次数" align="center" />
          <el-table-column prop="bonus" label="加成积分" align="center" />
        </el-table>
        <el-empty v-else description="暂无数据" :image-size="80" />

        <h4 class="stats-subtitle">规则命中明细</h4>
        <el-table :data="statsData.ruleDetails" size="small" stripe max-height="300" v-if="statsData.ruleDetails.length > 0">
          <el-table-column prop="memberId" label="会员ID" width="100" />
          <el-table-column prop="createdAt" label="时间" width="180">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column prop="bonusValue" label="加成积分" width="100" align="center" />
          <el-table-column label="命中规则">
            <template #default="{ row }">
              <span v-if="row.detail">{{ JSON.stringify(row.detail) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无数据" :image-size="80" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useCampaignStore } from '../stores/campaign';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, ArrowDown, Loading } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const store = useCampaignStore();
const formRef = ref(null);
const dialogVisible = ref(false);
const isEdit = ref(false);
const editingId = ref(null);
const submitting = ref(false);
const statsVisible = ref(false);
const statsLoading = ref(false);
const statsData = ref(null);

const filters = reactive({
  search: '',
  type: '',
  status: '',
});

const form = reactive({
  name: '',
  type: '',
  ruleParams: {},
  startTime: '',
  endTime: '',
  applicableLevels: [],
  applicableTags: [],
  applicableChannels: [],
  enabled: true,
  participationLimit: 0,
  mutualExclusionGroup: '',
  priority: 0,
});

const rules = {
  name: [{ required: true, message: '请输入活动名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择活动类型', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
};

const typeOptions = [
  { value: 'DOUBLE_POINTS', label: '双倍积分' },
  { value: 'SPEND_GIFT_POINTS', label: '满赠积分' },
  { value: 'LEVEL_BONUS', label: '指定等级加成' },
  { value: 'SIGNIN_DOUBLE', label: '签到翻倍' },
  { value: 'EXCHANGE_DISCOUNT', label: '兑换折扣' },
];

const statusOptions = [
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING_REVIEW', label: '待审核' },
  { value: 'ACTIVE', label: '进行中' },
  { value: 'ENDED', label: '已结束' },
  { value: 'VOID', label: '已作废' },
];

const STATUS_TRANSITIONS = {
  DRAFT: ['PENDING_REVIEW', 'VOID'],
  PENDING_REVIEW: ['DRAFT', 'ACTIVE', 'VOID'],
  ACTIVE: ['ENDED', 'VOID'],
  ENDED: [],
  VOID: [],
};

const getTypeLabel = (t) => typeOptions.find((o) => o.value === t)?.label || t;
const getTypeTag = (t) => {
  const map = {
    DOUBLE_POINTS: 'danger',
    SPEND_GIFT_POINTS: 'warning',
    LEVEL_BONUS: 'success',
    SIGNIN_DOUBLE: 'primary',
    EXCHANGE_DISCOUNT: 'info',
  };
  return map[t] || '';
};
const getStatusLabel = (s) => statusOptions.find((o) => o.value === s)?.label || s;
const getStatusTag = (s) => {
  const map = {
    DRAFT: 'info',
    PENDING_REVIEW: 'warning',
    ACTIVE: 'success',
    ENDED: '',
    VOID: 'danger',
  };
  return map[s] || '';
};
const getLevelLabel = (l) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[l] || l;
};
const formatDate = (d) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '');

const canEdit = (row) => row.status === 'DRAFT' || row.status === 'PENDING_REVIEW';
const canDelete = (row) => row.status !== 'ACTIVE';
const canTransition = (row) => getNextStatuses(row.status).length > 0;
const getNextStatuses = (current) => STATUS_TRANSITIONS[current] || [];

const fetchList = () => {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.type) params.type = filters.type;
  if (filters.status) params.status = filters.status;
  store.fetchCampaigns(params);
};

const resetForm = () => {
  isEdit.value = false;
  editingId.value = null;
  form.name = '';
  form.type = '';
  form.ruleParams = {};
  form.startTime = '';
  form.endTime = '';
  form.applicableLevels = [];
  form.applicableTags = [];
  form.applicableChannels = [];
  form.enabled = true;
  form.participationLimit = 0;
  form.mutualExclusionGroup = '';
  form.priority = 0;
};

const handleCreate = () => {
  resetForm();
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  editingId.value = row.id;
  form.name = row.name;
  form.type = row.type;
  form.ruleParams = row.ruleParams ? JSON.parse(JSON.stringify(row.ruleParams)) : {};
  if (form.type === 'LEVEL_BONUS' && !form.ruleParams.levelBonus) {
    form.ruleParams.levelBonus = { NORMAL: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
  }
  form.startTime = row.startTime;
  form.endTime = row.endTime;
  form.applicableLevels = row.applicableLevels || [];
  form.applicableTags = row.applicableTags || [];
  form.applicableChannels = row.applicableChannels || [];
  form.enabled = !!row.enabled;
  form.participationLimit = row.participationLimit || 0;
  form.mutualExclusionGroup = row.mutualExclusionGroup || '';
  form.priority = row.priority || 0;
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    if (!form.type) {
      ElMessage.warning('请选择活动类型');
      return;
    }
    submitting.value = true;
    try {
      const data = { ...form };
      if (!data.applicableLevels || data.applicableLevels.length === 0) {
        data.applicableLevels = null;
      }
      if (!data.applicableTags || data.applicableTags.length === 0) {
        data.applicableTags = null;
      }
      if (!data.applicableChannels || data.applicableChannels.length === 0) {
        data.applicableChannels = null;
      }
      if (!data.mutualExclusionGroup) {
        data.mutualExclusionGroup = null;
      }
      if (isEdit.value) {
        await store.updateCampaign(editingId.value, data);
        ElMessage.success('活动已更新');
      } else {
        await store.createCampaign(data);
        ElMessage.success('活动已创建');
      }
      dialogVisible.value = false;
    } finally {
      submitting.value = false;
    }
  });
};

const handleStatusChange = async (row, targetStatus) => {
  try {
    await ElMessageBox.confirm(
      `确定要将活动「${row.name}」状态变更为「${getStatusLabel(targetStatus)}」吗？`,
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
    await store.toggleEnabled(row.id, val);
    ElMessage.success(val ? '活动已启用' : '活动已停用');
  } catch (e) {
    row.enabled = !val;
  }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除活动「${row.name}」吗？`, '删除确认', {
      type: 'warning',
    });
    await store.deleteCampaign(row.id);
    ElMessage.success('活动已删除');
  } catch {
    // cancelled
  }
};

const handleViewStats = async (row) => {
  statsVisible.value = true;
  statsLoading.value = true;
  try {
    const { useCampaignStore: _unused } = await import('../stores/campaign');
    const { default: api } = await import('../api/campaigns');
    statsData.value = await api.getStats(row.id);
  } finally {
    statsLoading.value = false;
  }
};

onMounted(() => {
  fetchList();
  store.fetchMeta();
});
</script>

<style scoped>
.campaign-list {
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

.campaign-name {
  font-weight: 600;
  color: #1e293b;
  margin-right: 8px;
}

.type-tag {
  margin-left: 4px;
}

.time-range {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-item {
  display: flex;
  font-size: 12px;
}

.time-label {
  color: #94a3b8;
  width: 36px;
}

.time-value {
  color: #475569;
}

.muted {
  color: #cbd5e1;
}

.form-tip {
  color: #94a3b8;
  font-size: 12px;
  margin-left: 8px;
}

.level-bonus-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
}

.level-bonus-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #f8fafc;
  border-radius: 8px;
}

.level-label {
  font-size: 13px;
  color: #475569;
  width: 72px;
}

.unit {
  color: #64748b;
  font-size: 13px;
}

.stats-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 0;
  color: #94a3b8;
}

.stats-row {
  margin-bottom: 20px;
}

.mini-stat {
  border: none;
  border-radius: 10px;
  text-align: center;
}

.mini-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 6px;
}

.mini-value {
  font-size: 26px;
  font-weight: 700;
  color: #1e293b;
}

.mini-value.accent {
  color: #ef4444;
}

.stats-subtitle {
  margin: 20px 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
</style>
