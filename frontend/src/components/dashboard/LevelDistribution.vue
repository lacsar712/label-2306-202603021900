<template>
  <div class="level-dist-wrap">
    <div class="filter-bar" v-if="dashboardStore.filters.channelId">
      <el-tag closable @close="dashboardStore.clearFilters()" type="info">
        已按渠道过滤
      </el-tag>
    </div>
    <div class="level-list">
      <div v-for="item in levelStats" :key="item.level" class="level-item">
        <div class="level-row">
          <span class="level-name">{{ getLevelLabel(item.level) }}</span>
          <span class="level-count">{{ item._count }} 人</span>
        </div>
        <el-progress
          :percentage="data.total > 0 ? (item._count / data.total) * 100 : 0"
          :stroke-width="10"
          :color="getLevelColor(item.level)"
          :show-text="false"
        />
      </div>
      <el-empty v-if="levelStats.length === 0" :image-size="60" description="暂无数据" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { fetchLevelDistribution } from '../../api/dashboard';
import { useDashboardStore } from '../../stores/dashboard';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 300 },
});

const dashboardStore = useDashboardStore();
const data = ref({ levelStats: [], total: 0 });
let timer = null;

const levelStats = computed(() => data.value.levelStats || []);

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getLevelColor = (level) => {
  const map = { NORMAL: '#94a3b8', SILVER: '#60a5fa', GOLD: '#f59e0b', PLATINUM: '#8b5cf6' };
  return map[level] || '#94a3b8';
};

const loadData = async () => {
  try {
    const result = await fetchLevelDistribution({
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
.level-dist-wrap { height: 100%; display: flex; flex-direction: column; }
.filter-bar { margin-bottom: 12px; }
.level-list { flex: 1; display: flex; flex-direction: column; gap: 16px; }
.level-item { display: flex; flex-direction: column; gap: 8px; }
.level-row { display: flex; justify-content: space-between; align-items: center; }
.level-name { font-size: 14px; color: #475569; }
.level-count { font-size: 14px; font-weight: 600; color: #1e293b; }
</style>
