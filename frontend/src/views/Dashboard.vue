<template>
  <div class="dashboard">
    <div v-if="activeCampaigns.length > 0" class="campaign-banner">
      <div class="banner-scroll">
        <div
          v-for="campaign in activeCampaigns"
          :key="campaign.id"
          class="banner-item"
          @click="$router.push('/campaigns')"
        >
          <span class="banner-icon">🎁</span>
          <span class="banner-name">{{ campaign.name }}</span>
          <el-tag size="small" type="warning" effect="dark" class="banner-type">{{ getTypeLabel(campaign.type) }}</el-tag>
          <span class="banner-remaining">剩余 {{ getRemainingTime(campaign.endTime) }}</span>
        </div>
      </div>
    </div>

    <el-row :gutter="24">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">总会员数</span>
              <span class="stat-value">{{ stats.total }}</span>
            </div>
            <div class="stat-icon blue">
              <el-icon><User /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">活跃会员</span>
              <span class="stat-value">{{ stats.active }}</span>
            </div>
            <div class="stat-icon green">
              <el-icon><CircleCheck /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">总积分</span>
              <span class="stat-value">{{ stats.totalPoints }}</span>
            </div>
            <div class="stat-icon purple">
              <el-icon><Star /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">系统运行状态</span>
              <span class="stat-value">正常</span>
            </div>
            <div class="stat-icon orange">
              <el-icon><Connection /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div v-if="stats.channelAlerts && stats.channelAlerts.length > 0" class="alert-banner mt-24">
      <el-alert
        v-for="(alert, idx) in stats.channelAlerts"
        :key="idx"
        :title="alert.message"
        :type="alert.severity === 'high' ? 'error' : 'warning'"
        show-icon
        :closable="false"
        class="mb-8"
      >
        <template #default>
          <el-button link type="primary" size="small" @click="$router.push('/channels')">
            查看详情 →
          </el-button>
        </template>
      </el-alert>
    </div>

    <el-row :gutter="24" class="mt-24">
      <el-col :span="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">等级分布</span>
            </div>
          </template>
          <div class="level-dist">
            <div v-for="item in stats.levelStats" :key="item.level" class="level-bar-item">
              <div class="level-info">
                <span class="level-name">{{ getLevelLabel(item.level) }}</span>
                <span class="level-count">{{ item._count }} 人</span>
              </div>
              <el-progress 
                :percentage="stats.total > 0 ? (item._count / stats.total) * 100 : 0" 
                :stroke-width="12"
                :color="getLevelColor(item.level)"
                :show-text="false"
              />
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">TOP5 获客渠道</span>
              <el-button link type="primary" size="small" @click="$router.push('/channels')">
                查看全部 →
              </el-button>
            </div>
          </template>
          <div class="channel-top-list">
            <div
              v-for="(ch, idx) in stats.topChannels || []"
              :key="ch.id"
              class="channel-top-item"
            >
              <span class="channel-rank" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
              <span class="channel-top-name">{{ ch.name }}</span>
              <div class="channel-top-bar">
                <div
                  class="channel-top-fill"
                  :style="{
                    width: getTopChannelPercent(ch.memberCount) + '%',
                    backgroundColor: getChannelColor(idx)
                  }"
                />
              </div>
              <span class="channel-top-count">{{ ch.memberCount }}</span>
            </div>
            <div v-if="!stats.topChannels || stats.topChannels.length === 0" class="empty-channels">
              <span>暂无渠道数据</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-24">
      <el-col :span="8">
        <el-card class="action-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">快捷操作</span>
            </div>
          </template>
          <div class="quick-actions">
            <div class="action-grid">
              <el-button type="primary" class="action-btn" @click="$router.push('/members')">
                管理会员
              </el-button>
              <el-button type="warning" class="action-btn" @click="$router.push('/points')">
                会员积分
              </el-button>
              <el-button type="success" class="action-btn" @click="$router.push('/channels')">
                渠道分析
              </el-button>
              <el-button type="info" class="action-btn" @click="$router.push('/campaigns')">
                营销活动
              </el-button>
            </div>
            <div class="tip-box">
              <h4 class="tip-title">💡 提示</h4>
              <p class="tip-content">黄金及以上等级会员本月活跃度提升了 15%。建议开展针对性营销活动。</p>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, computed, ref, onUnmounted } from 'vue';
import { useMemberStore } from '../stores/member';
import { useCampaignStore } from '../stores/campaign';
import { User, CircleCheck, Star, Connection } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';

const memberStore = useMemberStore();
const campaignStore = useCampaignStore();
const stats = computed(() => memberStore.stats);
const activeCampaigns = computed(() => campaignStore.activeCampaigns);
const tick = ref(0);
let timer = null;

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getLevelColor = (level) => {
  const map = { NORMAL: '#94a3b8', SILVER: '#60a5fa', GOLD: '#f59e0b', PLATINUM: '#8b5cf6' };
  return map[level] || '#94a3b8';
};

const getTypeLabel = (t) => {
  const map = {
    DOUBLE_POINTS: '双倍积分',
    SPEND_GIFT_POINTS: '满赠积分',
    LEVEL_BONUS: '等级加成',
    SIGNIN_DOUBLE: '签到翻倍',
    EXCHANGE_DISCOUNT: '兑换折扣',
  };
  return map[t] || t;
};

const getRemainingTime = (endTime) => {
  tick.value;
  const now = dayjs();
  const end = dayjs(endTime);
  const diffMs = end.diff(now);
  if (diffMs <= 0) return '已结束';
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分钟`;
};

const CHANNEL_COLORS = [
  '#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ef4444'
];

const getChannelColor = (idx) => CHANNEL_COLORS[idx % CHANNEL_COLORS.length];

const getTopChannelPercent = (count) => {
  const max = Math.max(...(stats.value.topChannels || []).map(c => c.memberCount), 1);
  return Math.round((count / max) * 100);
};

onMounted(() => {
  memberStore.fetchStats();
  campaignStore.fetchActiveCampaigns();
  timer = setInterval(() => {
    tick.value++;
  }, 60000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.dashboard {
  padding: 12px 24px;
}

.campaign-banner {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 0;
  margin-bottom: 20px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.banner-scroll {
  display: flex;
  overflow-x: auto;
  gap: 4px;
  padding: 4px;
}

.banner-scroll::-webkit-scrollbar {
  display: none;
}

.banner-item {
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  color: white;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.banner-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.banner-icon {
  font-size: 22px;
}

.banner-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

.banner-type {
  flex-shrink: 0;
}

.banner-remaining {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.9;
  white-space: nowrap;
}


.stat-card {
  border-radius: 12px;
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
}

.stat-icon.blue { background-color: #eff6ff; color: #3b82f6; }
.stat-icon.green { background-color: #f0fdf4; color: #22c55e; }
.stat-icon.purple { background-color: #faf5ff; color: #a855f7; }
.stat-icon.orange { background-color: #fff7ed; color: #f97316; }

.mt-24 { margin-top: 24px; }

.chart-card, .action-card {
  border-radius: 12px;
  border: none;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.level-dist {
  padding: 8px 0;
}

.level-bar-item {
  margin-bottom: 20px;
}

.level-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.level-name {
  font-size: 14px;
  color: #475569;
}

.level-count {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.quick-actions {
  display: flex;
  flex-direction: column;
}

.action-grid {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
}

.action-btn {
  flex: 1;
  height: 40px;
  border-radius: 8px;
  margin: 0 !important;
}

.tip-box {
  margin-top: 20px;
  padding: 16px;
  background-color: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.tip-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #1e293b;
}

.tip-content {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}

.alert-banner {
  margin-bottom: 4px;
}

.mb-8 { margin-bottom: 8px; }

.channel-top-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

.channel-top-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-rank {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background-color: #f1f5f9;
  color: #64748b;
  flex-shrink: 0;
}

.channel-rank.rank-1 { background-color: #fef3c7; color: #d97706; }
.channel-rank.rank-2 { background-color: #e2e8f0; color: #475569; }
.channel-rank.rank-3 { background-color: #ffedd5; color: #c2410c; }

.channel-top-name {
  font-size: 14px;
  color: #334155;
  width: 100px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-top-bar {
  flex: 1;
  height: 8px;
  background-color: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

.channel-top-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.channel-top-count {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  width: 50px;
  text-align: right;
  flex-shrink: 0;
}

.empty-channels {
  padding: 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}
</style>
