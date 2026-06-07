<template>
  <div class="channel-pie-wrap">
    <div class="filter-bar" v-if="dashboardStore.filters.channelId">
      <el-tag closable @close="dashboardStore.clearFilters()" type="info">
        已按渠道过滤
      </el-tag>
    </div>
    <div class="chart-container" v-if="chartData.length > 0">
      <div class="pie-wrap">
        <div class="pie-center">
          <div class="pie-total">{{ total }}</div>
          <div class="pie-label">总会员</div>
        </div>
        <svg class="pie-svg" viewBox="0 0 200 200">
          <circle
            v-for="(seg, idx) in pieSegments"
            :key="idx"
            cx="100" cy="100" r="70"
            :fill="seg.color"
            :stroke="#fff"
            stroke-width="2"
            :stroke-dasharray="seg.dash + ' 9999'"
            :stroke-dashoffset="-seg.offset"
            transform="rotate(-90 100 100)"
            class="pie-slice"
            :class="{ active: dashboardStore.filters.channelId === seg.id }"
            @click="handleSliceClick(seg)"
            style="cursor: pointer;"
          />
        </svg>
      </div>
      <div class="legend-wrap">
        <div
          v-for="(item, idx) in chartData"
          :key="item.id"
          class="legend-item"
          :class="{ active: dashboardStore.filters.channelId === item.id }"
          @click="handleSliceClick(item)"
        >
          <span class="legend-dot" :style="{ backgroundColor: colors[idx % colors.length] }"></span>
          <span class="legend-name">{{ item.name }}</span>
          <span class="legend-value">{{ item.value }}</span>
        </div>
      </div>
    </div>
    <el-empty v-else :image-size="60" description="暂无数据" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { fetchChannelPie } from '../../api/dashboard';
import { useDashboardStore } from '../../stores/dashboard';
import { ElMessage } from 'element-plus';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 300 },
});

const dashboardStore = useDashboardStore();
const chartData = ref([]);
let timer = null;

const colors = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#06b6d4', '#84cc16', '#f43f5e'];

const total = computed(() => chartData.value.reduce((s, c) => s + c.value, 0));

const pieSegments = computed(() => {
  const circumference = 2 * Math.PI * 70;
  let offset = 0;
  return chartData.value.map((c, idx) => {
    const ratio = total.value > 0 ? c.value / total.value : 0;
    const dash = ratio * circumference;
    const seg = {
      ...c,
      color: colors[idx % colors.length],
      dash,
      offset,
    };
    offset += dash;
    return seg;
  });
});

const handleSliceClick = (item) => {
  if (dashboardStore.filters.channelId === item.id) {
    dashboardStore.clearFilters();
    ElMessage.info('已清除渠道过滤');
  } else {
    dashboardStore.setFilter('channelId', item.id);
    ElMessage.success(`已按渠道 [${item.name}] 过滤联动`);
  }
};

const loadData = async () => {
  try {
    chartData.value = await fetchChannelPie();
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
.channel-pie-wrap { height: 100%; display: flex; flex-direction: column; }
.filter-bar { margin-bottom: 12px; }
.chart-container { flex: 1; display: flex; gap: 16px; align-items: center; }
.pie-wrap { position: relative; width: 180px; height: 180px; flex-shrink: 0; }
.pie-svg { width: 100%; height: 100%; }
.pie-slice { transition: opacity 0.2s, transform 0.2s; transform-origin: 100px 100px; }
.pie-slice:hover { opacity: 0.85; }
.pie-slice.active { opacity: 1; filter: drop-shadow(0 0 4px currentColor); }
.pie-center {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  text-align: center;
}
.pie-total { font-size: 22px; font-weight: 700; color: #1e293b; }
.pie-label { font-size: 12px; color: #64748b; margin-top: 2px; }
.legend-wrap { flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.legend-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer;
  transition: background 0.2s;
}
.legend-item:hover { background: #f1f5f9; }
.legend-item.active { background: #eff6ff; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-name { flex: 1; font-size: 13px; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.legend-value { font-size: 13px; font-weight: 600; color: #1e293b; }
</style>
