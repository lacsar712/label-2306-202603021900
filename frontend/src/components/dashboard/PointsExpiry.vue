<template>
  <div class="expiry-wrap">
    <div class="expiry-stats">
      <div class="stat-card urgent">
        <div class="stat-icon">
          <el-icon :size="20"><WarningFilled /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ formatNumber(data.expiring7Days) }}</div>
          <div class="stat-label">7天内过期积分</div>
        </div>
      </div>
      <div class="stat-card warn">
        <div class="stat-icon">
          <el-icon :size="20"><Clock /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ formatNumber(data.expiring30Days) }}</div>
          <div class="stat-label">30天内过期积分</div>
        </div>
      </div>
      <div class="stat-card primary">
        <div class="stat-icon">
          <el-icon :size="20"><Calendar /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ formatNumber(data.expiringThisMonth) }}</div>
          <div class="stat-label">本月过期积分总量</div>
        </div>
      </div>
      <div class="stat-card info">
        <div class="stat-icon">
          <el-icon :size="20"><User /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ data.affectedMembersThisMonth || 0 }}</div>
          <div class="stat-label">本月受影响会员</div>
        </div>
      </div>
    </div>

    <div class="expiry-body">
      <div class="panel member-panel">
        <div class="panel-header">
          <span class="panel-title">即将过期 Top 会员</span>
          <el-button link type="primary" size="small" @click="$router.push('/points-expiry')">
            查看全部 →
          </el-button>
        </div>
        <div class="panel-content" v-if="data.topMembers && data.topMembers.length > 0">
          <div v-for="m in data.topMembers" :key="m.memberId" class="member-row">
            <el-avatar :size="30" class="member-avatar">
              {{ m.memberName?.charAt(0) || '会' }}
            </el-avatar>
            <div class="member-info">
              <div class="member-name">{{ m.memberName }}</div>
              <div class="member-phone">{{ m.memberPhone }}</div>
            </div>
            <div class="member-right">
              <div class="expire-points">-{{ formatNumber(m.points) }}</div>
              <div class="expire-date">{{ formatDate(m.expireAt) }} 到期</div>
            </div>
          </div>
        </div>
        <el-empty v-else :image-size="40" description="暂无即将过期积分" class="panel-empty" />
      </div>

      <div class="panel history-panel">
        <div class="panel-header">
          <span class="panel-title">过期执行历史</span>
          <el-button link type="primary" size="small" @click="$router.push('/points-expiry')">
            更多 →
          </el-button>
        </div>
        <div class="panel-content" v-if="data.executionHistory && data.executionHistory.length > 0">
          <div v-for="h in data.executionHistory" :key="h.id" class="history-row">
            <div class="history-date">{{ formatDate(h.executionDate) }}</div>
            <el-tag size="small" :type="getHandleTypeTag(h.handledType)" effect="light">
              {{ getHandleTypeLabel(h.handledType) }}
            </el-tag>
            <div class="history-points">
              <span class="expired">-{{ formatNumber(h.totalExpiredPoints) }}</span>
              <span v-if="h.totalFrozenPoints > 0" class="frozen">
                冻结 {{ formatNumber(h.totalFrozenPoints) }}
              </span>
            </div>
            <div class="history-members">{{ h.affectedMembers }} 人</div>
          </div>
        </div>
        <el-empty v-else :image-size="40" description="暂无执行历史" class="panel-empty" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, onUnmounted } from 'vue';
import { fetchPointsExpiry } from '../../api/dashboard';
import { WarningFilled, Clock, Calendar, User } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 3600 },
});

const timeRange = computed(() => props.component?.timeRange || null);

const data = reactive({
  expiring7Days: 0,
  expiring30Days: 0,
  expiringThisMonth: 0,
  affectedMembersThisMonth: 0,
  topMembers: [],
  executionHistory: [],
});

let timer = null;

const formatNumber = (n) => {
  if (!n) return 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  return n.toLocaleString();
};

const formatDate = (d) => dayjs(d).format('MM-DD');

const getHandleTypeLabel = (t) => {
  const map = { CLEAR_ALL: '整笔清零', FIFO_DEDUCT: 'FIFO扣减', TRANSFER_FROZEN: '转入冻结' };
  return map[t] || t;
};

const getHandleTypeTag = (t) => {
  const map = { CLEAR_ALL: 'danger', FIFO_DEDUCT: 'warning', TRANSFER_FROZEN: 'info' };
  return map[t] || '';
};

const loadData = async () => {
  try {
    const result = await fetchPointsExpiry({ timeRange: timeRange.value });
    Object.assign(data, result);
  } catch (e) {
    console.error(e);
  }
};

onMounted(() => {
  loadData();
  if (props.refreshInterval > 0) {
    timer = setInterval(loadData, props.refreshInterval * 1000);
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.expiry-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.expiry-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  flex-shrink: 0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  transition: transform 0.2s;
}

.stat-card:hover { transform: translateY(-2px); }

.stat-card.urgent { background: linear-gradient(135deg, #fef2f2, #fee2e2); }
.stat-card.urgent .stat-icon { background: #ef4444; color: #fff; }
.stat-card.urgent .stat-value { color: #b91c1c; }

.stat-card.warn { background: linear-gradient(135deg, #fffbeb, #fef3c7); }
.stat-card.warn .stat-icon { background: #f59e0b; color: #fff; }
.stat-card.warn .stat-value { color: #b45309; }

.stat-card.primary { background: linear-gradient(135deg, #eff6ff, #dbeafe); }
.stat-card.primary .stat-icon { background: #3b82f6; color: #fff; }
.stat-card.primary .stat-value { color: #1d4ed8; }

.stat-card.info { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
.stat-card.info .stat-icon { background: #22c55e; color: #fff; }
.stat-card.info .stat-value { color: #15803d; }

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-body { display: flex; flex-direction: column; min-width: 0; }
.stat-value { font-size: 18px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 11px; color: #64748b; margin-top: 2px; white-space: nowrap; }

.expiry-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  border-radius: 10px;
  overflow: hidden;
  min-height: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.panel-title { font-size: 13px; font-weight: 600; color: #1e293b; }

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 6px 8px;
}

.panel-empty { padding: 16px 0; }

.member-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background-color 0.15s;
}

.member-row:hover { background: #fff; }

.member-avatar {
  width: 30px;
  height: 30px;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  font-size: 13px;
  flex-shrink: 0;
}

.member-info { flex: 1; min-width: 0; }
.member-name { font-size: 12px; font-weight: 500; color: #1e293b; line-height: 1.3; }
.member-phone { font-size: 10px; color: #94a3b8; margin-top: 1px; }

.member-right { text-align: right; flex-shrink: 0; }
.expire-points { font-size: 13px; font-weight: 700; color: #ef4444; }
.expire-date { font-size: 10px; color: #94a3b8; margin-top: 1px; }

.history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  transition: background-color 0.15s;
}

.history-row:hover { background: #fff; }

.history-date { color: #475569; font-weight: 500; width: 58px; flex-shrink: 0; }
.history-points { flex: 1; display: flex; gap: 8px; min-width: 0; }
.history-points .expired { color: #ef4444; font-weight: 600; }
.history-points .frozen { color: #f97316; font-weight: 500; }
.history-members { color: #64748b; flex-shrink: 0; }
</style>
