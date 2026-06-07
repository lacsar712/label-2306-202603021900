<template>
  <div class="stat-card-wrap">
    <div class="stat-icon" :class="iconColor">
      <el-icon :size="24"><component :is="iconComp" /></el-icon>
    </div>
    <div class="stat-info">
      <div class="stat-label">{{ title || data.label }}</div>
      <div class="stat-value">{{ formatNumber(data.value) }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { fetchStatCard } from '../../api/dashboard';
import { useDashboardStore } from '../../stores/dashboard';
import { User, CircleCheck, Star, Calendar, Tickets, Present } from '@element-plus/icons-vue';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 60 },
});

const dashboardStore = useDashboardStore();
const data = ref({ value: 0, label: '' });
let timer = null;

const iconMap = {
  TOTAL_MEMBERS: { comp: User, color: 'blue' },
  ACTIVE_MEMBERS: { comp: CircleCheck, color: 'green' },
  TOTAL_POINTS: { comp: Star, color: 'purple' },
  TODAY_SIGNINS: { comp: Calendar, color: 'orange' },
  OPEN_TICKETS: { comp: Tickets, color: 'red' },
  PENDING_REVIEW_CAMPAIGNS: { comp: Present, color: 'pink' },
};

const statType = computed(() => props.component?.config?.statType || 'TOTAL_MEMBERS');
const title = computed(() => props.component?.title);
const iconComp = computed(() => iconMap[statType.value]?.comp || User);
const iconColor = computed(() => iconMap[statType.value]?.color || 'blue');

const formatNumber = (n) => {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString();
};

const loadData = async () => {
  try {
    const result = await fetchStatCard({
      statType: statType.value,
      channelId: dashboardStore.filters.channelId || undefined,
    });
    data.value = result;
  } catch (e) {
    console.error(e);
  }
};

watch(() => dashboardStore.filters.channelId, loadData);

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
.stat-card-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}
.stat-icon {
  width: 56px; height: 56px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.stat-icon.blue { background: #eff6ff; color: #3b82f6; }
.stat-icon.green { background: #f0fdf4; color: #22c55e; }
.stat-icon.purple { background: #faf5ff; color: #a855f7; }
.stat-icon.orange { background: #fff7ed; color: #f97316; }
.stat-icon.red { background: #fef2f2; color: #ef4444; }
.stat-icon.pink { background: #fdf2f8; color: #ec4899; }
.stat-info { display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
.stat-label { font-size: 13px; color: #64748b; }
.stat-value { font-size: 26px; font-weight: 700; color: #1e293b; line-height: 1; }
</style>
