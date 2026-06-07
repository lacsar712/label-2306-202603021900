<template>
  <div class="expiry-wrap">
    <div class="expiry-summary">
      <div class="summary-card urgent">
        <div class="card-icon">
          <el-icon :size="24"><Warning /></el-icon>
        </div>
        <div class="card-info">
          <div class="card-value">{{ formatNumber(data.expiring7Days) }}</div>
          <div class="card-label">7天内过期积分</div>
        </div>
      </div>
      <div class="summary-card warn">
        <div class="card-icon">
          <el-icon :size="24"><Clock /></el-icon>
        </div>
        <div class="card-info">
          <div class="card-value">{{ formatNumber(data.expiring30Days) }}</div>
          <div class="card-label">30天内过期积分</div>
        </div>
      </div>
    </div>
    <div class="member-list" v-if="data.topMembers && data.topMembers.length > 0">
      <div class="list-header">
        <span class="list-title">即将过期 Top 会员</span>
        <el-button link type="primary" size="small" @click="$router.push('/points-expiry')">查看全部 →</el-button>
      </div>
      <div class="list-body">
        <div v-for="m in data.topMembers" :key="m.memberId" class="member-item">
          <el-avatar :size="32" style="background: linear-gradient(135deg,#f59e0b,#ef4444);">
            {{ m.memberName?.charAt(0) || '会' }}
          </el-avatar>
          <div class="member-info">
            <div class="member-name">{{ m.memberName }}</div>
            <div class="member-phone">{{ m.memberPhone }}</div>
          </div>
          <div class="expire-info">
            <div class="points">-{{ formatNumber(m.points) }}</div>
            <div class="date">{{ formatDate(m.expireAt) }}</div>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-else :image-size="50" description="暂无即将过期积分" />
  </div>
</template>

<script setup>
import { reactive, onMounted, onUnmounted } from 'vue';
import { fetchPointsExpiry } from '../../api/dashboard';
import { Warning, Clock } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 3600 },
});

const data = reactive({ expiring7Days: 0, expiring30Days: 0, topMembers: [] });
let timer = null;

const formatNumber = (n) => {
  if (!n) return 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  return n.toLocaleString();
};
const formatDate = (d) => dayjs(d).format('MM-DD');

const loadData = async () => {
  try {
    const result = await fetchPointsExpiry();
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
.expiry-wrap { height: 100%; display: flex; flex-direction: column; }
.expiry-summary { display: flex; gap: 12px; margin-bottom: 16px; }
.summary-card {
  flex: 1; display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-radius: 10px;
}
.summary-card.urgent { background: linear-gradient(135deg, #fef2f2, #fee2e2); }
.summary-card.urgent .card-icon { background: #ef4444; color: #fff; }
.summary-card.urgent .card-value { color: #b91c1c; }
.summary-card.warn { background: linear-gradient(135deg, #fffbeb, #fef3c7); }
.summary-card.warn .card-icon { background: #f59e0b; color: #fff; }
.summary-card.warn .card-value { color: #b45309; }
.card-icon {
  width: 44px; height: 44px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.card-info { display: flex; flex-direction: column; }
.card-value { font-size: 22px; font-weight: 700; line-height: 1.2; }
.card-label { font-size: 12px; color: #64748b; margin-top: 2px; }
.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.list-title { font-size: 13px; font-weight: 600; color: #1e293b; }
.list-body { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; padding-right: 4px; }
.member-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; background: #f8fafc; border-radius: 8px;
}
.member-info { flex: 1; min-width: 0; }
.member-name { font-size: 13px; font-weight: 500; color: #1e293b; }
.member-phone { font-size: 11px; color: #64748b; margin-top: 2px; }
.expire-info { text-align: right; flex-shrink: 0; }
.points { font-size: 14px; font-weight: 700; color: #ef4444; }
.date { font-size: 11px; color: #64748b; margin-top: 2px; }
</style>
