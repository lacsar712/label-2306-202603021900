<template>
  <div class="checkin-management">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">每日签到管理</h2>
        <p class="page-subtitle">会员签到、补签、日历展示与签到规则配置</p>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="签到日历" name="calendar">
        <div class="calendar-section">
          <el-card shadow="never" class="member-select-card">
            <el-form :inline="true" :model="filterForm" class="filter-form">
              <el-form-item label="选择会员">
                <el-select
                  v-model="filterForm.memberId"
                  placeholder="请选择会员"
                  filterable
                  style="width: 300px"
                  :loading="loadingMembers"
                  @change="handleMemberChange"
                >
                  <el-option
                    v-for="item in members"
                    :key="item.id"
                    :label="`${item.name} (${item.phone})`"
                    :value="item.id"
                  >
                    <div class="member-option">
                      <span>{{ item.name }}</span>
                      <span class="member-phone">{{ item.phone }}</span>
                      <el-tag size="small" type="info" class="member-points">积分: {{ item.points }}</el-tag>
                    </div>
                  </el-option>
                </el-select>
              </el-form-item>
            </el-form>
          </el-card>

          <div v-if="filterForm.memberId" class="calendar-container">
            <el-row :gutter="16">
              <el-col :span="16">
                <el-card shadow="never" class="calendar-card">
                  <div class="calendar-header">
                    <el-button :icon="ArrowLeft" circle @click="prevMonth" />
                    <span class="calendar-title">{{ currentYear }}年{{ currentMonth + 1 }}月</span>
                    <el-button :icon="ArrowRight" circle @click="nextMonth" />
                  </div>

                  <div class="calendar-legend">
                    <span class="legend-item"><span class="legend-dot signed"></span>已签到</span>
                    <span class="legend-item"><span class="legend-dot makeup"></span>已补签</span>
                    <span class="legend-item"><span class="legend-dot missed"></span>未签到</span>
                    <span class="legend-item"><span class="legend-dot future"></span>未到</span>
                  </div>

                  <div class="weekdays">
                    <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
                  </div>

                  <div class="calendar-grid">
                    <div
                      v-for="(day, idx) in calendarDays"
                      :key="idx"
                      class="calendar-day"
                      :class="[day.status, { 'is-today': day.isToday }]"
                      @click="handleDayClick(day)"
                    >
                      <span class="day-number">{{ day.day || '' }}</span>
                      <span v-if="day.points && day.status !== 'future'" class="day-points">
                        +{{ day.points }}
                      </span>
                      <el-tag v-if="day.isMakeup" size="small" type="warning" class="makeup-tag">补</el-tag>
                    </div>
                  </div>

                  <div class="calendar-summary">
                    <el-statistic title="当前连续签到" :value="calendarData.currentStreak" suffix="天" />
                    <el-statistic title="本月正常签到" :value="calendarData.totalSigned" suffix="天" />
                    <el-statistic title="本月补签次数" :value="calendarData.totalMakeup" suffix="次" />
                  </div>
                </el-card>
              </el-col>

              <el-col :span="8">
                <el-card shadow="never" class="action-card">
                  <div class="action-title">快捷操作</div>
                  <el-button type="primary" class="action-btn" size="large" :loading="signingIn" @click="handleSignin">
                    <el-icon><Calendar /></el-icon>
                    <span>今日签到</span>
                  </el-button>
                  <el-button type="warning" class="action-btn" size="large" :loading="makingUp" @click="openMakeupDialog">
                    <el-icon><EditPen /></el-icon>
                    <span>补签</span>
                  </el-button>

                  <div v-if="lastSigninResult" class="signin-result">
                    <div class="result-header">
                      <el-icon class="success-icon"><CircleCheck /></el-icon>
                      <span>签到成功</span>
                    </div>
                    <el-descriptions :column="1" border size="small">
                      <el-descriptions-item label="基础积分">{{ lastSigninResult.basePoints }}</el-descriptions-item>
                      <el-descriptions-item label="活动加成">
                        <span class="accent">+{{ lastSigninResult.bonusPoints }}</span>
                      </el-descriptions-item>
                      <el-descriptions-item label="实际获得">
                        <span class="strong">+{{ lastSigninResult.finalPoints }}</span>
                      </el-descriptions-item>
                      <el-descriptions-item label="连续签到">{{ lastSigninResult.consecutiveDays }}天</el-descriptions-item>
                      <el-descriptions-item label="命中活动" v-if="lastSigninResult.campaignsHit?.length">
                        <el-tag v-for="c in lastSigninResult.campaignsHit" :key="c.campaignId" type="warning" effect="light" style="margin-right:4px;">
                          {{ c.campaignName }}
                        </el-tag>
                      </el-descriptions-item>
                    </el-descriptions>
                  </div>
                </el-card>

                <el-card shadow="never" class="history-card">
                  <div class="history-header">
                    <span class="history-title">签到历史</span>
                  </div>
                  <el-timeline>
                    <el-timeline-item
                      v-for="item in historyList"
                      :key="item.id"
                      :timestamp="formatDate(item.signinDate)"
                      :type="item.isMakeup ? 'warning' : 'primary'"
                    >
                      <div class="history-item">
                        <span>{{ item.isMakeup ? '补签' : '签到' }}</span>
                        <span class="points">+{{ item.points }}积分</span>
                        <span class="streak">连续{{ item.consecutiveDays }}天</span>
                      </div>
                    </el-timeline-item>
                    <div v-if="historyList.length === 0" class="empty-history">暂无签到记录</div>
                  </el-timeline>
                </el-card>
              </el-col>
            </el-row>
          </div>

          <el-empty v-else description="请先选择会员查看签到日历" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="签到规则配置" name="config">
        <el-card shadow="never" class="config-card">
          <el-form :model="configForm" :rules="configRules" ref="configFormRef" label-width="160px" class="config-form">
            <el-form-item label="基础签到积分" prop="basePoints">
              <el-input-number v-model="configForm.basePoints" :min="1" :max="1000" />
              <span class="form-tip">会员每次正常签到获得的基础积分</span>
            </el-form-item>

            <el-form-item label="连续签到奖励" prop="consecutiveBonusRules">
              <div class="bonus-rules">
                <div v-for="(rule, idx) in configForm.consecutiveBonusRules" :key="idx" class="bonus-rule-row">
                  <span>连续</span>
                  <el-input-number v-model="rule.days" :min="1" :max="365" size="small" />
                  <span>天额外奖励</span>
                  <el-input-number v-model="rule.bonusPoints" :min="0" :max="1000" size="small" />
                  <span>积分</span>
                  <el-button link type="danger" @click="removeBonusRule(idx)">删除</el-button>
                </div>
                <el-button type="primary" plain size="small" @click="addBonusRule">
                  <el-icon><Plus /></el-icon>
                  添加奖励规则
                </el-button>
              </div>
            </el-form-item>

            <el-form-item label="每月补签上限" prop="monthlyMakeupLimit">
              <el-input-number v-model="configForm.monthlyMakeupLimit" :min="0" :max="31" />
              <span class="form-tip">每个会员每月最多允许补签次数</span>
            </el-form-item>

            <el-form-item label="补签消耗积分" prop="makeupCostPoints">
              <el-input-number v-model="configForm.makeupCostPoints" :min="0" :max="10000" />
              <span class="form-tip">每次补签需要消耗的会员积分</span>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="savingConfig" @click="handleSaveConfig">
                保存配置
              </el-button>
              <el-button @click="loadConfig">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="签到统计" name="stats">
        <el-card shadow="never" class="stats-card">
          <el-form :inline="true" :model="statsFilter" class="stats-filter">
            <el-form-item label="日期范围">
              <el-date-picker
                v-model="statsFilter.dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
              />
            </el-form-item>
            <el-form-item label="会员">
              <el-select
                v-model="statsFilter.memberId"
                placeholder="全部会员"
                filterable
                clearable
                style="width: 200px"
              >
                <el-option
                  v-for="item in members"
                  :key="item.id"
                  :label="`${item.name} (${item.phone})`"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadStats">查询</el-button>
              <el-button @click="handleExport">导出CSV</el-button>
            </el-form-item>
          </el-form>

          <el-row :gutter="16" class="stats-overview">
            <el-col :span="4">
              <el-card shadow="hover" class="stat-item">
                <el-statistic title="签到总次数" :value="statsData.totalSignins" />
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-item">
                <el-statistic title="正常签到" :value="statsData.normalSignins" />
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-item">
                <el-statistic title="补签次数" :value="statsData.makeupSignins" />
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-item">
                <el-statistic title="发放总积分" :value="statsData.totalPoints" />
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-item">
                <el-statistic title="签到会员数" :value="statsData.uniqueMembers" />
              </el-card>
            </el-col>
            <el-col :span="4">
              <el-card shadow="hover" class="stat-item">
                <el-statistic title="会员签到率" :value="statsData.signinRate" suffix="%" :precision="2" />
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="16" class="stats-detail">
            <el-col :span="12">
              <el-card shadow="never" class="streak-card">
                <div class="card-title">连续签到分布</div>
                <el-table :data="streakDistributionData" style="width: 100%">
                  <el-table-column prop="range" label="连续签到天数" />
                  <el-table-column prop="count" label="次数" />
                  <el-table-column label="占比">
                    <template #default="scope">
                      {{ ((scope.row.count / statsData.totalSignins) * 100).toFixed(1) }}%
                    </template>
                  </el-table-column>
                </el-table>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card shadow="never" class="trend-card">
                <div class="card-title">每日签到趋势</div>
                <el-table :data="statsData.dailyTrend || []" max-height="300" style="width: 100%">
                  <el-table-column prop="date" label="日期" width="120" />
                  <el-table-column prop="count" label="签到人数" />
                  <el-table-column prop="makeup" label="补签人数" />
                  <el-table-column prop="points" label="发放积分" />
                </el-table>
              </el-card>
            </el-col>
          </el-row>

          <el-card shadow="never" class="records-card">
            <div class="card-title">签到明细</div>
            <el-table :data="statsData.list || []" max-height="400" style="width: 100%">
              <el-table-column label="会员">
                <template #default="scope">
                  {{ scope.row.member?.name }} ({{ scope.row.member?.phone }})
                </template>
              </el-table-column>
              <el-table-column label="签到日期">
                <template #default="scope">
                  {{ formatDate(scope.row.signinDate) }}
                </template>
              </el-table-column>
              <el-table-column prop="points" label="获得积分" />
              <el-table-column prop="consecutiveDays" label="连续签到天数" />
              <el-table-column label="是否补签">
                <template #default="scope">
                  <el-tag :type="scope.row.isMakeup ? 'warning' : 'success'" size="small">
                    {{ scope.row.isMakeup ? '补签' : '正常' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="makeupCostPoints" label="补签消耗积分" />
            </el-table>
          </el-card>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="makeupDialogVisible" title="补签" width="500px">
      <el-form :model="makeupForm" :rules="makeupRules" ref="makeupFormRef" label-width="100px">
        <el-form-item label="选择日期" prop="signinDate">
          <el-date-picker
            v-model="makeupForm.signinDate"
            type="date"
            placeholder="请选择补签日期"
            :disabled-date="disabledMakeupDate"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <div v-if="configData" class="makeup-tips">
        <el-alert type="info" :closable="false" show-icon>
          <p>每月最多补签 {{ configData.monthlyMakeupLimit }} 次</p>
          <p>每次补签消耗 {{ configData.makeupCostPoints }} 积分</p>
        </el-alert>
      </div>
      <template #footer>
        <el-button @click="makeupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="makingUp" @click="handleMakeupSignin">确认补签</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft, ArrowRight, Calendar, EditPen, Plus, CircleCheck } from '@element-plus/icons-vue';
import api from '../api/axios';
import * as checkinApi from '../api/checkins';

const activeTab = ref('calendar');
const loadingMembers = ref(false);
const members = ref([]);
const signingIn = ref(false);
const makingUp = ref(false);
const savingConfig = ref(false);

const filterForm = reactive({
  memberId: null,
});

const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth());
const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
const calendarData = ref({ calendar: [], currentStreak: 0, totalSigned: 0, totalMakeup: 0 });
const lastSigninResult = ref(null);
const historyList = ref([]);

const configFormRef = ref(null);
const configData = ref(null);
const configForm = reactive({
  basePoints: 10,
  consecutiveBonusRules: [],
  monthlyMakeupLimit: 3,
  makeupCostPoints: 50,
});
const configRules = {
  basePoints: [{ required: true, message: '请输入基础签到积分', trigger: 'blur' }],
  monthlyMakeupLimit: [{ required: true, message: '请输入每月补签上限', trigger: 'blur' }],
  makeupCostPoints: [{ required: true, message: '请输入补签消耗积分', trigger: 'blur' }],
};

const makeupDialogVisible = ref(false);
const makeupFormRef = ref(null);
const makeupForm = reactive({
  signinDate: '',
});
const makeupRules = {
  signinDate: [{ required: true, message: '请选择补签日期', trigger: 'change' }],
};

const statsFilter = reactive({
  dateRange: [],
  memberId: null,
});
const statsData = ref({
  totalSignins: 0,
  normalSignins: 0,
  makeupSignins: 0,
  totalPoints: 0,
  uniqueMembers: 0,
  signinRate: 0,
  streakDistribution: {},
  dailyTrend: [],
  list: [],
});

const streakDistributionData = computed(() => {
  const ranges = ['1-2', '3-6', '7-14', '15-29', '30+'];
  return ranges.map((r) => ({
    range: r,
    count: statsData.value.streakDistribution?.[r] || 0,
  }));
});

const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: '', status: 'empty' });
  }

  const signinMap = {};
  for (const item of calendarData.value.calendar) {
    signinMap[item.day] = item;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const signin = signinMap[d] || {};
    days.push({
      day: d,
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      status: signin.status || (new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate()) ? 'missed' : 'future'),
      points: signin.points || 0,
      isMakeup: signin.isMakeup || false,
      isToday:
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === d,
    });
  }

  return days;
});

const fetchMembers = async () => {
  loadingMembers.value = true;
  try {
    members.value = await api.get('/members');
  } finally {
    loadingMembers.value = false;
  }
};

const loadCalendar = async () => {
  if (!filterForm.memberId) return;
  try {
    const data = await checkinApi.getMemberCalendar(
      filterForm.memberId,
      currentYear.value,
      currentMonth.value
    );
    calendarData.value = data;
  } catch (e) {}
};

const loadHistory = async () => {
  if (!filterForm.memberId) return;
  try {
    const data = await checkinApi.getMemberSigninHistory(filterForm.memberId, 1, 10);
    historyList.value = data.list || [];
  } catch (e) {}
};

const loadConfig = async () => {
  try {
    const data = await checkinApi.getSigninConfig();
    configData.value = data;
    configForm.basePoints = data.basePoints;
    configForm.consecutiveBonusRules = data.consecutiveBonusRules?.length
      ? JSON.parse(JSON.stringify(data.consecutiveBonusRules))
      : [];
    configForm.monthlyMakeupLimit = data.monthlyMakeupLimit;
    configForm.makeupCostPoints = data.makeupCostPoints;
  } catch (e) {}
};

const loadStats = async () => {
  try {
    const params = {};
    if (statsFilter.dateRange?.[0]) params.startDate = statsFilter.dateRange[0];
    if (statsFilter.dateRange?.[1]) params.endDate = statsFilter.dateRange[1];
    if (statsFilter.memberId) params.memberId = statsFilter.memberId;
    statsData.value = await checkinApi.getSigninStats(params);
  } catch (e) {}
};

const handleMemberChange = () => {
  lastSigninResult.value = null;
  loadCalendar();
  loadHistory();
};

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
  loadCalendar();
};

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
  loadCalendar();
};

const handleDayClick = (day) => {
  if (!day.day || day.status === 'future' || day.status === 'empty') return;
  if (day.status === 'missed') {
    makeupForm.signinDate = day.date;
    makeupDialogVisible.value = true;
  }
};

const handleSignin = async () => {
  if (!filterForm.memberId) {
    ElMessage.warning('请先选择会员');
    return;
  }
  signingIn.value = true;
  try {
    const result = await checkinApi.signin(filterForm.memberId);
    lastSigninResult.value = result;
    ElMessage.success('签到成功');
    loadCalendar();
    loadHistory();
    await fetchMembers();
  } catch (e) {}
  finally {
    signingIn.value = false;
  }
};

const openMakeupDialog = () => {
  if (!filterForm.memberId) {
    ElMessage.warning('请先选择会员');
    return;
  }
  makeupForm.signinDate = '';
  makeupDialogVisible.value = true;
};

const disabledMakeupDate = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
};

const handleMakeupSignin = async () => {
  if (!makeupFormRef.value) return;
  await makeupFormRef.value.validate(async (valid) => {
    if (!valid) return;
    makingUp.value = true;
    try {
      const result = await checkinApi.makeupSignin(filterForm.memberId, makeupForm.signinDate);
      ElMessage.success(`补签成功！获得${result.earnedPoints}积分，消耗${result.costPoints}积分，净得${result.netPoints}积分`);
      makeupDialogVisible.value = false;
      loadCalendar();
      loadHistory();
      await fetchMembers();
    } catch (e) {}
    finally {
      makingUp.value = false;
    }
  });
};

const addBonusRule = () => {
  configForm.consecutiveBonusRules.push({ days: 3, bonusPoints: 5 });
};

const removeBonusRule = (idx) => {
  configForm.consecutiveBonusRules.splice(idx, 1);
};

const handleSaveConfig = async () => {
  if (!configFormRef.value) return;
  await configFormRef.value.validate(async (valid) => {
    if (!valid) return;
    savingConfig.value = true;
    try {
      await checkinApi.updateSigninConfig({ ...configForm });
      ElMessage.success('配置保存成功');
      await loadConfig();
    } catch (e) {}
    finally {
      savingConfig.value = false;
    }
  });
};

const handleExport = () => {
  const params = {};
  if (statsFilter.dateRange?.[0]) params.startDate = statsFilter.dateRange[0];
  if (statsFilter.dateRange?.[1]) params.endDate = statsFilter.dateRange[1];
  if (statsFilter.memberId) params.memberId = statsFilter.memberId;
  checkinApi.exportSigninRecords(params);
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

onMounted(async () => {
  await fetchMembers();
  await loadConfig();
  loadStats();
});
</script>

<style scoped>
.checkin-management {
  padding: 12px 24px;
}

.page-header {
  margin-bottom: 20px;
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

.main-tabs {
  background: #fff;
  border-radius: 12px;
  padding: 0 16px;
}

.member-select-card {
  margin-bottom: 16px;
  border-radius: 12px;
}

.filter-form {
  margin: 0;
}

.member-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-phone {
  color: #94a3b8;
  font-size: 12px;
}

.member-points {
  margin-left: auto;
}

.calendar-container {
  width: 100%;
}

.calendar-card {
  border-radius: 12px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 16px;
}

.calendar-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.calendar-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}

.legend-dot.signed {
  background: #22c55e;
}

.legend-dot.makeup {
  background: #f59e0b;
}

.legend-dot.missed {
  background: #e2e8f0;
}

.legend-dot.future {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  padding: 8px 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.calendar-day {
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
  padding: 4px;
}

.calendar-day.empty {
  cursor: default;
}

.calendar-day.missed {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.calendar-day.missed:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.calendar-day.signed {
  background: #dcfce7;
  border: 1px solid #22c55e;
}

.calendar-day.makeup {
  background: #fef3c7;
  border: 1px solid #f59e0b;
}

.calendar-day.future {
  background: #fafafa;
  color: #cbd5e1;
  cursor: default;
}

.calendar-day.is-today {
  box-shadow: 0 0 0 2px #4f46e5;
}

.day-number {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.calendar-day.future .day-number {
  color: #cbd5e1;
}

.day-points {
  font-size: 11px;
  color: #22c55e;
  font-weight: 500;
  margin-top: 2px;
}

.calendar-day.makeup .day-points {
  color: #b45309;
}

.makeup-tag {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 0 4px;
  height: 16px;
  line-height: 16px;
  font-size: 10px;
}

.calendar-summary {
  display: flex;
  justify-content: space-around;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f1f5f9;
}

.action-card {
  border-radius: 12px;
  margin-bottom: 16px;
}

.action-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 16px;
}

.action-btn {
  width: 100%;
  margin-bottom: 12px;
  justify-content: center;
  gap: 8px;
}

.signin-result {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 12px;
}

.success-icon {
  color: #22c55e;
  font-size: 20px;
}

.accent {
  color: #ef4444;
  font-weight: 600;
}

.strong {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.history-card {
  border-radius: 12px;
}

.history-header {
  margin-bottom: 16px;
}

.history-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-item .points {
  color: #22c55e;
  font-weight: 600;
}

.history-item .streak {
  color: #64748b;
  font-size: 12px;
}

.empty-history {
  text-align: center;
  color: #94a3b8;
  padding: 20px 0;
}

.config-card {
  border-radius: 12px;
  max-width: 700px;
}

.config-form {
  padding: 8px;
}

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: #94a3b8;
}

.bonus-rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bonus-rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #475569;
}

.stats-card {
  border-radius: 12px;
}

.stats-filter {
  margin-bottom: 20px;
}

.stats-overview {
  margin-bottom: 20px;
}

.stat-item {
  border-radius: 10px;
  text-align: center;
}

.stats-detail {
  margin-bottom: 20px;
}

.streak-card, .trend-card, .records-card {
  border-radius: 12px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 16px;
}

.makeup-tips {
  margin-bottom: 8px;
}

.makeup-tips :deep(.el-alert__description) p {
  margin: 4px 0;
}
</style>
