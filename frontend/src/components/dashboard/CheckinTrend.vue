<template>
  <div class="trend-wrap">
    <div class="trend-header">
      <span class="trend-title">{{ displayRangeLabel }}签到</span>
      <span class="trend-total">累计: {{ total }} 次</span>
    </div>
    <div class="chart-area" v-if="data.length > 0">
      <svg class="trend-svg" viewBox="0 0 400 140" preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path :d="areaPath" fill="url(#areaGrad)" />
        <path :d="linePath" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <circle
          v-for="(p, idx) in points"
          :key="idx"
          :cx="p.x" :cy="p.y" r="3"
          fill="#fff" stroke="#3b82f6" stroke-width="2"
          class="trend-point"
        />
      </svg>
      <div class="x-axis">
        <span v-for="(item, idx) in data" :key="idx" :class="{ show: shouldShow(idx) }">
          {{ formatDate(item.date) }}
        </span>
      </div>
    </div>
    <el-empty v-else :image-size="60" description="暂无数据" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { fetchCheckinTrend } from '../../api/dashboard';
import dayjs from 'dayjs';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 300 },
});

const days = computed(() => props.component?.config?.days || 7);
const timeRange = computed(() => props.component?.timeRange || null);
const data = ref([]);
let timer = null;

const resolvedDays = computed(() => {
  const map = { today: 1, '7days': 7, '30days': 30, '90days': 90 };
  return map[timeRange.value] ?? days.value;
});

const displayRangeLabel = computed(() => {
  const map = { today: '今日', '7days': '近 7 日', '30days': '近 30 日', '90days': '近 90 日' };
  return map[timeRange.value] || `近 ${resolvedDays.value} 日`;
});

const total = computed(() => data.value.reduce((s, i) => s + i.count, 0));
const max = computed(() => Math.max(...data.value.map(i => i.count), 1));

const chartWidth = 400;
const chartHeight = 120;
const paddingX = 10;
const paddingY = 10;

const points = computed(() => {
  const n = data.value.length;
  if (n === 0) return [];
  const step = n > 1 ? (chartWidth - paddingX * 2) / (n - 1) : 0;
  return data.value.map((item, idx) => ({
    x: paddingX + idx * step,
    y: paddingY + chartHeight - (item.count / max.value) * (chartHeight - paddingY * 2) - paddingY,
  }));
});

const linePath = computed(() => {
  if (points.value.length === 0) return '';
  return points.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
});

const areaPath = computed(() => {
  if (points.value.length === 0) return '';
  const pts = points.value;
  return linePath.value + ` L ${pts[pts.length - 1].x} ${chartHeight} L ${pts[0].x} ${chartHeight} Z`;
});

const formatDate = (d) => dayjs(d).format('MM/DD');
const shouldShow = (idx) => {
  const n = data.value.length;
  if (n <= 7) return true;
  return idx % Math.ceil(n / 7) === 0 || idx === n - 1;
};

const loadData = async () => {
  try {
    data.value = await fetchCheckinTrend({ days: resolvedDays.value, timeRange: timeRange.value });
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
.trend-wrap { height: 100%; display: flex; flex-direction: column; }
.trend-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.trend-title { font-size: 13px; font-weight: 600; color: #1e293b; }
.trend-total { font-size: 12px; color: #64748b; }
.chart-area { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.trend-svg { width: 100%; flex: 1; min-height: 0; }
.trend-point { transition: all 0.2s; }
.x-axis {
  display: flex; justify-content: space-between; padding: 0 10px;
  font-size: 10px; color: #94a3b8; margin-top: 4px;
}
.x-axis span { opacity: 0; }
.x-axis span.show { opacity: 1; }
</style>
