<template>
  <div class="points-expiry">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">积分过期管理</h2>
        <p class="page-subtitle">配置积分有效期规则、查看过期数据、管理会员积分</p>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="规则配置" name="rules">
        <div class="tab-header">
          <el-button type="primary" :icon="Plus" @click="openRuleDialog()">
            新建规则
          </el-button>
          <el-tag type="info" effect="plain">
            规则变更仅对新产生的积分生效
          </el-tag>
        </div>

        <el-card class="content-card" shadow="never">
          <el-table :data="rules" v-loading="loading.rules" stripe>
            <el-table-column prop="name" label="规则名称" min-width="180">
              <template #default="{ row }">
                <span class="rule-name">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="sourceType" label="适用来源" width="140">
              <template #default="{ row }">
                <el-tag size="small" :type="getSourceTypeTag(row.sourceType)">
                  {{ getSourceTypeLabel(row.sourceType) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="validDays" label="有效天数" width="100" align="center">
              <template #default="{ row }">
                <span class="accent-text">{{ row.validDays }} 天</span>
              </template>
            </el-table-column>
            <el-table-column label="到期提醒" min-width="180">
              <template #default="{ row }">
                <el-tag v-if="!row.reminderDays || row.reminderDays.length === 0" size="small" type="info" effect="plain">
                  未设置
                </el-tag>
                <el-tag
                  v-for="d in row.reminderDays"
                  :key="d"
                  size="small"
                  type="warning"
                  effect="light"
                  style="margin-right: 4px;"
                >
                  {{ d }} 天前
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="handleType" label="过期处理" width="140">
              <template #default="{ row }">
                <el-tag size="small" :type="getHandleTypeTag(row.handleType)">
                  {{ getHandleTypeLabel(row.handleType) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="isEnabled" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-switch
                  :model-value="row.isEnabled"
                  @change="(val) => toggleRuleStatus(row, val)"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openRuleDialog(row)">
                  编辑
                </el-button>
                <el-popconfirm
                  title="确定删除此规则？"
                  @confirm="deleteRule(row.id)"
                >
                  <template #reference>
                    <el-button link type="danger" size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无规则，请点击「新建规则」创建" />
            </template>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="仪表盘" name="dashboard">
        <el-row :gutter="24">
          <el-col :span="8">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-info">
                  <span class="stat-label">本月即将过期积分</span>
                  <span class="stat-value danger">{{ dashboard.expiringThisMonth?.totalPoints || 0 }}</span>
                </div>
                <div class="stat-icon red">
                  <el-icon><Warning /></el-icon>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-info">
                  <span class="stat-label">受影响会员数</span>
                  <span class="stat-value warning">{{ dashboard.expiringThisMonth?.affectedMembers || 0 }}</span>
                </div>
                <div class="stat-icon orange">
                  <el-icon><User /></el-icon>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-content">
                <div class="stat-info">
                  <span class="stat-label">执行过期扫描</span>
                  <el-button type="primary" size="small" :loading="loading.scan" @click="runScan">
                    立即执行
                  </el-button>
                </div>
                <div class="stat-icon blue">
                  <el-icon><Refresh /></el-icon>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="24" class="mt-24">
          <el-col :span="14">
            <el-card class="content-card" shadow="never">
              <template #header>
                <div class="card-header">
                  <span class="card-title">即将过期积分明细（本月）</span>
                </div>
              </template>
              <el-table :data="dashboard.expiringThisMonth?.ledgers || []" v-loading="loading.dashboard" size="small" max-height="400">
                <el-table-column label="会员" width="160">
                  <template #default="{ row }">
                    <span>{{ row.member?.name }}</span>
                    <span class="muted-text">（{{ row.member?.phone }}）</span>
                  </template>
                </el-table-column>
                <el-table-column prop="remainingPoints" label="剩余积分" width="100" align="center">
                  <template #default="{ row }">
                    <span class="accent-text">{{ row.remainingPoints }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="expireAt" label="到期日" width="160">
                  <template #default="{ row }">
                    <el-tag size="small" :type="getExpireTagType(row.expireAt)">
                      {{ formatDate(row.expireAt) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="sourceType" label="来源" width="100">
                  <template #default="{ row }">
                    {{ getSourceTypeLabel(row.sourceType) }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="140" align="center">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="handleExtend(row)">
                      延期
                    </el-button>
                    <el-button link type="success" size="small" @click="handleExempt(row)">
                      豁免
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>

          <el-col :span="10">
            <el-card class="content-card" shadow="never">
              <template #header>
                <div class="card-header">
                  <span class="card-title">过期执行历史</span>
                </div>
              </template>
              <el-table :data="dashboard.executionHistory || []" v-loading="loading.dashboard" size="small" max-height="400">
                <el-table-column prop="executionDate" label="执行日期" width="130">
                  <template #default="{ row }">{{ formatDate(row.executionDate) }}</template>
                </el-table-column>
                <el-table-column prop="handledType" label="处理方式" width="110">
                  <template #default="{ row }">
                    <el-tag size="small" :type="getHandleTypeTag(row.handledType)">
                      {{ getHandleTypeLabel(row.handledType) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="totalExpiredPoints" label="过期积分" width="90" align="center">
                  <template #default="{ row }">
                    <span class="danger-text">-{{ row.totalExpiredPoints }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="totalFrozenPoints" label="冻结积分" width="90" align="center">
                  <template #default="{ row }">
                    <span v-if="row.totalFrozenPoints > 0" class="warning-text">{{ row.totalFrozenPoints }}</span>
                    <span v-else class="muted-text">-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="affectedMembers" label="会员数" width="70" align="center" />
              </el-table>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="会员积分明细" name="member-detail">
        <el-card class="content-card" shadow="never">
          <div class="search-bar">
            <el-select
              v-model="selectedMemberId"
              placeholder="请选择会员"
              filterable
              clearable
              style="width: 300px;"
              @change="fetchMemberSummary"
            >
              <el-option
                v-for="m in members"
                :key="m.id"
                :label="`${m.name} (${m.phone})`"
                :value="m.id"
              />
            </el-select>
          </div>

          <div v-if="memberSummary" class="member-summary mt-24">
            <el-row :gutter="16">
              <el-col :span="6">
                <div class="summary-card blue">
                  <div class="summary-label">有效积分</div>
                  <div class="summary-value">{{ memberSummary.effectivePoints }}</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="summary-card orange">
                  <div class="summary-label">即将过期（30天内）</div>
                  <div class="summary-value">{{ memberSummary.expiringSoon?.totalPoints || 0 }}</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="summary-card purple">
                  <div class="summary-label">冻结积分</div>
                  <div class="summary-value">{{ memberSummary.frozenPoints }}</div>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="action-buttons">
                  <el-button type="primary" :disabled="!selectedMemberId" @click="openExtendDialog()">
                    <el-icon><Clock /></el-icon> 批量延期
                  </el-button>
                  <el-button type="success" :disabled="!selectedMemberId" @click="openExemptDialog()">
                    <el-icon><CircleCheck /></el-icon> 批量豁免
                  </el-button>
                </div>
              </el-col>
            </el-row>
          </div>

          <el-tabs v-model="ledgerTab" class="ledger-tabs mt-24">
            <el-tab-pane label="有效积分明细" name="active">
              <el-table :data="activeLedgers" v-loading="loading.ledgers" size="small">
                <el-table-column type="selection" width="50" />
                <el-table-column prop="originalPoints" label="原始积分" width="100" align="center" />
                <el-table-column prop="remainingPoints" label="剩余积分" width="100" align="center">
                  <template #default="{ row }">
                    <span class="accent-text">{{ row.remainingPoints }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="earnedAt" label="入账时间" width="170">
                  <template #default="{ row }">{{ formatDateTime(row.earnedAt) }}</template>
                </el-table-column>
                <el-table-column prop="expireAt" label="到期日" width="170">
                  <template #default="{ row }">
                    <el-tag size="small" :type="getExpireTagType(row.expireAt)">
                      {{ formatDateTime(row.expireAt) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="sourceType" label="来源类型" width="120">
                  <template #default="{ row }">
                    {{ getSourceTypeLabel(row.sourceType) }}
                  </template>
                </el-table-column>
                <el-table-column label="规则" width="160">
                  <template #default="{ row }">{{ row.rule?.name || '默认' }}</template>
                </el-table-column>
                <el-table-column prop="extendedDays" label="已延期" width="80" align="center">
                  <template #default="{ row }">
                    <span v-if="row.extendedDays > 0" class="accent-text">+{{ row.extendedDays }}天</span>
                    <span v-else class="muted-text">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="140" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="handleExtend(row)">延期</el-button>
                    <el-button link type="success" size="small" @click="handleExempt(row)">豁免</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="已过期/冻结" name="expired">
              <el-table :data="memberSummary?.expiredLedgers || []" size="small">
                <el-table-column prop="originalPoints" label="原始积分" width="100" align="center" />
                <el-table-column prop="remainingPoints" label="剩余积分" width="100" align="center" />
                <el-table-column prop="expireAt" label="到期日" width="170">
                  <template #default="{ row }">{{ formatDateTime(row.expireAt) }}</template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.status === 'FROZEN' ? 'warning' : 'danger'">
                      {{ row.status === 'FROZEN' ? '已冻结' : '已过期' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="sourceType" label="来源类型" width="120">
                  <template #default="{ row }">
                    {{ getSourceTypeLabel(row.sourceType) }}
                  </template>
                </el-table-column>
                <el-table-column label="规则" width="160">
                  <template #default="{ row }">{{ row.rule?.name || '默认' }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="ruleDialog.visible"
      :title="ruleDialog.form.id ? '编辑规则' : '新建规则'"
      width="560px"
      destroy-on-close
    >
      <el-form :model="ruleDialog.form" :rules="ruleRules" ref="ruleFormRef" label-width="110px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="ruleDialog.form.name" placeholder="例如：消费获得积分 365天有效" maxlength="100" />
        </el-form-item>
        <el-form-item label="适用来源" prop="sourceType">
          <el-select v-model="ruleDialog.form.sourceType" style="width: 100%;">
            <el-option v-for="opt in sourceTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效天数" prop="validDays">
          <el-input-number v-model="ruleDialog.form.validDays" :min="1" :max="3650" style="width: 200px;" />
          <span class="form-tip">天</span>
        </el-form-item>
        <el-form-item label="到期提醒">
          <div class="reminder-days-input">
            <el-select
              v-model="ruleDialog.reminderInput"
              placeholder="选择提醒天数"
              style="width: 160px; margin-right: 8px;"
            >
              <el-option v-for="d in reminderDayOptions" :key="d" :label="`${d} 天前`" :value="d" />
            </el-select>
            <el-button @click="addReminderDay">添加</el-button>
          </div>
          <div class="reminder-tags mt-8">
            <el-tag
              v-for="d in ruleDialog.form.reminderDays"
              :key="d"
              closable
              type="warning"
              effect="light"
              style="margin-right: 6px;"
              @close="removeReminderDay(d)"
            >
              {{ d }} 天前
            </el-tag>
            <span v-if="!ruleDialog.form.reminderDays?.length" class="muted-text">未设置提醒</span>
          </div>
        </el-form-item>
        <el-form-item label="过期处理方式" prop="handleType">
          <el-radio-group v-model="ruleDialog.form.handleType">
            <el-radio value="CLEAR_ALL">整笔清零</el-radio>
            <el-radio value="FIFO_DEDUCT">FIFO 扣减</el-radio>
            <el-radio value="TRANSFER_FROZEN">转入冻结池</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="ruleDialog.form.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="ruleDialog.submitting" @click="saveRule">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="extendDialog.visible"
      title="积分延期"
      width="420px"
      destroy-on-close
    >
      <el-form :model="extendDialog.form" label-width="100px">
        <el-form-item label="延期天数">
          <el-input-number v-model="extendDialog.form.extendDays" :min="1" :max="3650" style="width: 200px;" />
          <span class="form-tip">天</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="extendDialog.form.remark" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-alert
          v-if="extendDialog.selectedCount > 0"
          type="info"
          :closable="false"
          show-icon
        >
          将为 {{ extendDialog.selectedCount }} 笔积分记录延期 {{ extendDialog.form.extendDays }} 天
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="extendDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="extendDialog.submitting" @click="confirmExtend">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="exemptDialog.visible"
      title="积分豁免"
      width="420px"
      destroy-on-close
    >
      <el-form label-width="100px">
        <el-alert type="warning" :closable="false" show-icon class="mb-16">
          豁免后该笔积分将永久有效，不会过期。
        </el-alert>
        <el-form-item label="备注">
          <el-input v-model="exemptDialog.form.remark" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-alert
          v-if="exemptDialog.selectedCount > 0"
          type="info"
          :closable="false"
          show-icon
        >
          将豁免 {{ exemptDialog.selectedCount }} 笔积分记录
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="exemptDialog.visible = false">取消</el-button>
        <el-button type="success" :loading="exemptDialog.submitting" @click="confirmExempt">确定豁免</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Warning, User, Refresh, Clock, CircleCheck } from '@element-plus/icons-vue';
import api from '../api/axios';
import {
  getExpiryRules,
  createExpiryRule,
  updateExpiryRule,
  deleteExpiryRule,
  getMemberPointsSummary,
  getMemberLedgers,
  extendMemberPoints,
  exemptMemberPoints,
  getExpiryDashboard,
  runExpiryScan,
} from '../api/pointsExpiry';
import dayjs from 'dayjs';

const activeTab = ref('rules');
const ledgerTab = ref('active');
const selectedMemberId = ref(null);
const selectedLedgerIds = ref([]);
const members = ref([]);

const loading = reactive({
  rules: false,
  dashboard: false,
  ledgers: false,
  scan: false,
});

const rules = ref([]);
const dashboard = ref({});
const memberSummary = ref(null);
const activeLedgers = ref([]);

const sourceTypeOptions = [
  { value: 'CONSUMPTION', label: '消费获得' },
  { value: 'ACTIVITY', label: '活动赠送' },
  { value: 'SIGNIN', label: '签到获得' },
  { value: 'ADJUST', label: '手动调整' },
  { value: 'EXCHANGE_REFUND', label: '兑换退回' },
  { value: 'OTHER', label: '其他来源' },
];

const reminderDayOptions = [1, 3, 7, 15, 30, 60, 90];

const ruleFormRef = ref(null);
const ruleDialog = reactive({
  visible: false,
  submitting: false,
  reminderInput: null,
  form: {
    id: null,
    name: '',
    sourceType: 'CONSUMPTION',
    validDays: 365,
    reminderDays: [],
    handleType: 'CLEAR_ALL',
    isEnabled: true,
  },
});

const ruleRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  sourceType: [{ required: true, message: '请选择适用来源', trigger: 'change' }],
  validDays: [{ required: true, message: '请输入有效天数', trigger: 'blur' }],
  handleType: [{ required: true, message: '请选择过期处理方式', trigger: 'change' }],
};

const extendDialog = reactive({
  visible: false,
  submitting: false,
  selectedCount: 0,
  form: { ledgerIds: [], extendDays: 30, remark: '' },
});

const exemptDialog = reactive({
  visible: false,
  submitting: false,
  selectedCount: 0,
  form: { ledgerIds: [], remark: '' },
});

const getSourceTypeLabel = (t) => sourceTypeOptions.find((o) => o.value === t)?.label || t;
const getSourceTypeTag = (t) => {
  const map = { CONSUMPTION: '', ACTIVITY: 'warning', SIGNIN: 'success', ADJUST: 'info', EXCHANGE_REFUND: '', OTHER: 'info' };
  return map[t] || '';
};

const getHandleTypeLabel = (t) => {
  const map = { CLEAR_ALL: '整笔清零', FIFO_DEDUCT: 'FIFO 扣减', TRANSFER_FROZEN: '转入冻结池' };
  return map[t] || t;
};
const getHandleTypeTag = (t) => {
  const map = { CLEAR_ALL: 'danger', FIFO_DEDUCT: 'warning', TRANSFER_FROZEN: 'info' };
  return map[t] || '';
};

const formatDate = (d) => dayjs(d).format('YYYY-MM-DD');
const formatDateTime = (d) => dayjs(d).format('YYYY-MM-DD HH:mm');

const getExpireTagType = (d) => {
  const diff = dayjs(d).diff(dayjs(), 'day');
  if (diff <= 7) return 'danger';
  if (diff <= 30) return 'warning';
  return 'success';
};

const fetchRules = async () => {
  loading.rules = true;
  try {
    rules.value = await getExpiryRules();
  } finally {
    loading.rules = false;
  }
};

const fetchDashboard = async () => {
  loading.dashboard = true;
  try {
    dashboard.value = await getExpiryDashboard();
  } finally {
    loading.dashboard = false;
  }
};

const fetchMembers = async () => {
  try {
    members.value = await api.get('/members');
  } catch (e) {
    console.error(e);
  }
};

const fetchMemberSummary = async () => {
  if (!selectedMemberId.value) {
    memberSummary.value = null;
    activeLedgers.value = [];
    return;
  }
  loading.ledgers = true;
  try {
    memberSummary.value = await getMemberPointsSummary(selectedMemberId.value);
    activeLedgers.value = await getMemberLedgers(selectedMemberId.value, { status: 'ACTIVE' });
  } finally {
    loading.ledgers = false;
  }
};

const openRuleDialog = (row = null) => {
  ruleDialog.reminderInput = null;
  if (row) {
    ruleDialog.form = {
      id: row.id,
      name: row.name,
      sourceType: row.sourceType,
      validDays: row.validDays,
      reminderDays: [...(row.reminderDays || [])],
      handleType: row.handleType,
      isEnabled: row.isEnabled,
    };
  } else {
    ruleDialog.form = {
      id: null,
      name: '',
      sourceType: 'CONSUMPTION',
      validDays: 365,
      reminderDays: [],
      handleType: 'CLEAR_ALL',
      isEnabled: true,
    };
  }
  ruleDialog.visible = true;
};

const addReminderDay = () => {
  if (!ruleDialog.reminderInput) return;
  if (!ruleDialog.form.reminderDays) ruleDialog.form.reminderDays = [];
  if (!ruleDialog.form.reminderDays.includes(ruleDialog.reminderInput)) {
    ruleDialog.form.reminderDays.push(ruleDialog.reminderInput);
    ruleDialog.form.reminderDays.sort((a, b) => a - b);
  }
  ruleDialog.reminderInput = null;
};

const removeReminderDay = (d) => {
  ruleDialog.form.reminderDays = ruleDialog.form.reminderDays.filter((x) => x !== d);
};

const saveRule = async () => {
  if (!ruleFormRef.value) return;
  await ruleFormRef.value.validate(async (valid) => {
    if (!valid) return;
    ruleDialog.submitting = true;
    try {
      const data = {
        name: ruleDialog.form.name,
        sourceType: ruleDialog.form.sourceType,
        validDays: ruleDialog.form.validDays,
        reminderDays: ruleDialog.form.reminderDays || [],
        handleType: ruleDialog.form.handleType,
        isEnabled: ruleDialog.form.isEnabled,
      };
      if (ruleDialog.form.id) {
        await updateExpiryRule(ruleDialog.form.id, data);
        ElMessage.success('规则已更新');
      } else {
        await createExpiryRule(data);
        ElMessage.success('规则已创建');
      }
      ruleDialog.visible = false;
      await fetchRules();
    } finally {
      ruleDialog.submitting = false;
    }
  });
};

const toggleRuleStatus = async (row, val) => {
  try {
    await updateExpiryRule(row.id, { isEnabled: val });
    ElMessage.success(val ? '已启用' : '已禁用');
  } catch (e) {
    row.isEnabled = !val;
  }
};

const deleteRule = async (id) => {
  try {
    await deleteExpiryRule(id);
    ElMessage.success('已删除');
    await fetchRules();
  } catch (e) {
    console.error(e);
  }
};

const runScan = async () => {
  loading.scan = true;
  try {
    await runExpiryScan();
    ElMessage.success('过期扫描执行完成');
    await fetchDashboard();
  } finally {
    loading.scan = false;
  }
};

const handleExtend = (row) => {
  if (!row.memberId && !selectedMemberId.value) {
    selectedMemberId.value = row.memberId;
  }
  extendDialog.form.ledgerIds = [row.id];
  extendDialog.selectedCount = 1;
  extendDialog.form.extendDays = 30;
  extendDialog.form.remark = '';
  extendDialog.visible = true;
};

const handleExempt = (row) => {
  if (!row.memberId && !selectedMemberId.value) {
    selectedMemberId.value = row.memberId;
  }
  exemptDialog.form.ledgerIds = [row.id];
  exemptDialog.selectedCount = 1;
  exemptDialog.form.remark = '';
  exemptDialog.visible = true;
};

const openExtendDialog = () => {
  const ids = selectedLedgerIds.value.length > 0 ? selectedLedgerIds.value : null;
  extendDialog.form.ledgerIds = ids;
  extendDialog.selectedCount = ids ? ids.length : (activeLedgers.value?.length || 0);
  extendDialog.form.extendDays = 30;
  extendDialog.form.remark = '';
  extendDialog.visible = true;
};

const openExemptDialog = () => {
  const ids = selectedLedgerIds.value.length > 0 ? selectedLedgerIds.value : null;
  exemptDialog.form.ledgerIds = ids;
  exemptDialog.selectedCount = ids ? ids.length : (activeLedgers.value?.filter(l => l.status === 'ACTIVE').length || 0);
  exemptDialog.form.remark = '';
  exemptDialog.visible = true;
};

const confirmExtend = async () => {
  if (!selectedMemberId.value) return;
  extendDialog.submitting = true;
  try {
    await extendMemberPoints(selectedMemberId.value, {
      ledgerIds: extendDialog.form.ledgerIds?.length > 0 ? extendDialog.form.ledgerIds : undefined,
      extendDays: extendDialog.form.extendDays,
      remark: extendDialog.form.remark,
    });
    ElMessage.success('延期成功');
    extendDialog.visible = false;
    await Promise.all([fetchDashboard(), fetchMemberSummary()]);
  } finally {
    extendDialog.submitting = false;
  }
};

const confirmExempt = async () => {
  if (!selectedMemberId.value) return;
  exemptDialog.submitting = true;
  try {
    await exemptMemberPoints(selectedMemberId.value, {
      ledgerIds: exemptDialog.form.ledgerIds?.length > 0 ? exemptDialog.form.ledgerIds : undefined,
      remark: exemptDialog.form.remark,
    });
    ElMessage.success('豁免成功');
    exemptDialog.visible = false;
    await Promise.all([fetchDashboard(), fetchMemberSummary()]);
  } finally {
    exemptDialog.submitting = false;
  }
};

onMounted(() => {
  fetchRules();
  fetchDashboard();
  fetchMembers();
});
</script>

<style scoped>
.points-expiry {
  padding: 12px 24px;
}

.page-header {
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

.main-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

.tab-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.content-card {
  border-radius: 12px;
  border: none;
}

.stat-card {
  border-radius: 12px;
  border: none;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-value.danger { color: #ef4444; }
.stat-value.warning { color: #f97316; }

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
}

.stat-icon.red { background-color: #fef2f2; color: #ef4444; }
.stat-icon.orange { background-color: #fff7ed; color: #f97316; }
.stat-icon.blue { background-color: #eff6ff; color: #3b82f6; }

.mt-8 { margin-top: 8px; }
.mt-16 { margin-top: 16px; }
.mt-24 { margin-top: 24px; }
.mb-16 { margin-bottom: 16px; }

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

.rule-name {
  font-weight: 600;
  color: #1e293b;
}

.accent-text {
  font-weight: 600;
  color: #4f46e5;
}

.danger-text {
  font-weight: 600;
  color: #ef4444;
}

.warning-text {
  font-weight: 600;
  color: #f97316;
}

.muted-text {
  color: #94a3b8;
  font-size: 12px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-summary .summary-card {
  padding: 20px;
  border-radius: 12px;
  color: white;
}

.member-summary .summary-card.blue { background: linear-gradient(135deg, #667eea, #764ba2); }
.member-summary .summary-card.orange { background: linear-gradient(135deg, #f093fb, #f5576c); }
.member-summary .summary-card.purple { background: linear-gradient(135deg, #4facfe, #00f2fe); }

.summary-label {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 28px;
  font-weight: 700;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.ledger-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.reminder-days-input {
  display: flex;
  align-items: center;
}

.reminder-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.form-tip {
  margin-left: 8px;
  color: #64748b;
  font-size: 14px;
}
</style>
