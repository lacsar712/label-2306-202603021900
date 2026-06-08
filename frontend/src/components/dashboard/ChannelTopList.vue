<template>
  <div class="channel-top-wrap">
    <div class="filter-bar" v-if="dashboardStore.filters.channelId">
      <el-tag closable @close="dashboardStore.clearFilters()" type="info">
        已按渠道过滤
      </el-tag>
    </div>
    <div class="top-list" v-if="listData.length > 0">
      <div
        v-for="(ch, idx) in listData"
        :key="ch.id"
        class="top-item"
        :class="{ active: dashboardStore.filters.channelId === ch.id }"
        @click="handleItemClick(ch)"
      >
        <span class="rank-badge" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
        <span class="ch-name">{{ ch.name }}</span>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: getPercent(ch.memberCount) + '%', backgroundColor: colors[idx % colors.length] }"
          />
        </div>
        <span class="ch-count">{{ ch.memberCount }}</span>
      </div>
    </div>
    <el-empty v-else :image-size="60" description="暂无渠道数据" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { fetchChannelTopList } from '../../api/dashboard';
import { useDashboardStore } from '../../stores/dashboard';
import { ElMessage } from 'element-plus';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 300 },
});

const dashboardStore = useDashboardStore();
const listData = ref([]);
let timer = null;

const colors = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#06b6d4', '#84cc16', '#f43f5e'];

const maxCount = computed(() => Math.max(...listData.value.map(c => c.memberCount), 1));
const getPercent = (count) => Math.round((count / maxCount.value) * 100);

const handleItemClick = (ch) => {
  if (dashboardStore.filters.channelId === ch.id) {
    dashboardStore.clearFilters();
    ElMessage.info('已清除渠道过滤');
  } else {
    dashboardStore.setFilter('channelId', ch.id);
    ElMessage.success(`已按渠道 [${ch.name}] 过滤联动`);
  }
};

const loadData = async () => {
  try {
    listData.value = await fetchChannelTopList();
  } catch (e) {
    console.error(e);
  }
};

watch(() => dashboardStore.filters.channelId, () => {});

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
.channel-top-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.filter-bar { margin-bottom: 12px; }
.top-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.top-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.top-item:hover { background: #f8fafc; }
.top-item.active { background: #eff6ff; }
.rank-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: #f1f5f9;
  color: #64748b;
  flex-shrink: 0;
}
.rank-badge.rank-1 { background: #fef3c7; color: #d97706; }
.rank-badge.rank-2 { background: #e2e8f0; color: #475569; }
.rank-badge.rank-3 { background: #ffedd5; color: #c2410c; }
.ch-name {
  font-size: 13px;
  color: #334155;
  width: 80px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress-bar {
  flex: 1;
  height: 8px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
.ch-count {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}
</style>
