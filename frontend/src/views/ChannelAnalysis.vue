<template>
  <div class="channel-analysis">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">渠道分析</h2>
        <p class="page-subtitle">分析各渠道会员来源、转化效果与 ROI</p>
      </div>
      <div class="header-actions">
        <el-select v-model="trendDays" @change="handleTrendDaysChange" class="mr-12">
          <el-option label="近30天" :value="30" />
          <el-option label="近60天" :value="60" />
          <el-option label="近90天" :value="90" />
        </el-select>
        <el-button type="primary" @click="showManageDialog = true">
          <el-icon class="mr-4"><Setting /></el-icon>渠道配置
        </el-button>
      </div>
    </div>

    <div v-if="channelStore.alerts.length > 0" class="alert-section">
      <el-alert
        v-for="(alert, idx) in channelStore.alerts"
        :key="idx"
        :title="alert.message"
        :type="alert.severity === 'high' ? 'error' : 'warning'"
        :closable="false"
        show-icon
        class="mb-8"
      />
    </div>

    <el-row :gutter="24">
      <el-col :span="8">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">渠道会员分布</span>
            </div>
          </template>
          <div class="pie-chart-wrapper">
            <svg viewBox="0 0 200 200" class="pie-svg">
              <path
                v-for="(slice, idx) in pieSlices"
                :key="idx"
                :d="slice.path"
                :fill="slice.color"
                @mouseenter="hoveredSlice = idx"
                @mouseleave="hoveredSlice = null"
                class="pie-slice"
                :class="{ active: hoveredSlice === idx }"
              />
              <circle cx="100" cy="100" r="50" fill="#fff" />
              <text x="100" y="95" text-anchor="middle" class="pie-label-total">
                {{ totalMembers }}
              </text>
              <text x="100" y="115" text-anchor="middle" class="pie-label-sub">
                总会员
              </text>
            </svg>
            <div class="pie-legend">
              <div
                v-for="(item, idx) in pieData"
                :key="item.id"
                class="legend-item"
                @mouseenter="hoveredSlice = idx"
                @mouseleave="hoveredSlice = null"
              >
                <span class="legend-color" :style="{ backgroundColor: getChannelColor(idx) }" />
                <span class="legend-name">{{ item.name }}</span>
                <span class="legend-value">{{ item.totalMembers }} ({{ item.percentage }}%)</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="16">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">新增趋势（{{ trendDays }}天）</span>
            </div>
          </template>
          <div class="trend-chart-wrapper">
            <svg :viewBox="`0 0 ${trendViewBox.width} ${trendViewBox.height}`" class="trend-svg">
              <line
                v-for="i in 5"
                :key="'h' + i"
                :x1="40"
                :x2="trendViewBox.width - 20"
                :y1="30 + (i - 1) * ((trendViewBox.height - 60) / 4)"
                :y2="30 + (i - 1) * ((trendViewBox.height - 60) / 4)"
                stroke="#f1f5f9"
                stroke-width="1"
              />
              <text
                v-for="i in 5"
                :key="'ht' + i"
                x="35"
                :y="34 + (i - 1) * ((trendViewBox.height - 60) / 4)"
                text-anchor="end"
                class="trend-axis-label"
              >
                {{ Math.round(trendMaxY - (i - 1) * (trendMaxY / 4)) }}
              </text>
              <g v-for="(trend, tIdx) in channelStore.statsTrend.trends" :key="trend.channelId">
                <polyline
                  :points="getTrendPoints(trend, tIdx)"
                  fill="none"
                  :stroke="getChannelColor(tIdx)"
                  stroke-width="2"
                  class="trend-line"
                />
                <circle
                  v-for="(p, pIdx) in trend.daily"
                  v-if="pIdx % Math.ceil(trend.daily.length / 10) === 0"
                  :key="pIdx"
                  :cx="40 + (pIdx / (trend.daily.length - 1)) * (trendViewBox.width - 70)"
                  :cy="30 + (1 - p.count / Math.max(trendMaxY, 1)) * (trendViewBox.height - 60)"
                  r="3"
                  :fill="getChannelColor(tIdx)"
                />
              </g>
              <text
                v-for="(d, dIdx) in channelStore.statsTrend.dates"
                v-if="dIdx % Math.ceil(channelStore.statsTrend.dates.length / 6) === 0"
                :key="'x' + dIdx"
                :x="40 + (dIdx / (channelStore.statsTrend.dates.length - 1)) * (trendViewBox.width - 70)"
                :y="trendViewBox.height - 10"
                text-anchor="middle"
                class="trend-axis-label"
              >
                {{ d.slice(5) }}
              </text>
            </svg>
            <div class="trend-legend">
              <div
                v-for="(trend, idx) in channelStore.statsTrend.trends"
                :key="trend.channelId"
                class="legend-item"
              >
                <span class="legend-line" :style="{ backgroundColor: getChannelColor(idx) }" />
                <span class="legend-name">{{ trend.channelName }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-24">
      <el-col :span="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">渠道转化漏斗</span>
            </div>
          </template>
          <div class="funnel-wrapper">
            <div
              v-for="(ch, idx) in topStats"
              :key="ch.id"
              class="funnel-item"
            >
              <div class="funnel-label">
                <span class="funnel-name">{{ ch.name }}</span>
              </div>
              <div class="funnel-bars">
                <div class="funnel-bar-row">
                  <span class="bar-label">注册</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill bar-register"
                      :style="{ width: (ch.totalMembers / maxTotal * 100) + '%' }"
                    />
                  </div>
                  <span class="bar-value">{{ ch.totalMembers }}</span>
                </div>
                <div class="funnel-bar-row">
                  <span class="bar-label">活跃</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill bar-active"
                      :style="{ width: (ch.activeRate / 100 * ch.totalMembers / maxTotal * 100) + '%' }"
                    />
                  </div>
                  <span class="bar-value">{{ Math.round(ch.totalMembers * ch.activeRate / 100) }} ({{ ch.activeRate }}%)</span>
                </div>
                <div class="funnel-bar-row">
                  <span class="bar-label">高等级</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill bar-high"
                      :style="{ width: (ch.conversionRate / 100 * ch.totalMembers / maxTotal * 100) + '%' }"
                    />
                  </div>
                  <span class="bar-value">{{ Math.round(ch.totalMembers * ch.conversionRate / 100) }} ({{ ch.conversionRate }}%)</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">渠道层级流转</span>
            </div>
          </template>
          <div class="sankey-wrapper">
            <svg :viewBox="`0 0 700 350`" class="sankey-svg">
              <defs>
                <linearGradient
                  v-for="(link, idx) in sankeyLinksWithPath"
                  :key="'g' + idx"
                  :id="'sankey-grad-' + idx"
                  gradientUnits="userSpaceOnUse"
                  :x1="link.x0" :x2="link.x1"
                >
                  <stop offset="0%" :stop-color="getChannelColor(link.sourceIdx)" stop-opacity="0.5" />
                  <stop offset="100%" :stop-color="getChannelColor(link.targetIdx)" stop-opacity="0.5" />
                </linearGradient>
              </defs>
              <path
                v-for="(link, idx) in sankeyLinksWithPath"
                :key="idx"
                :d="link.path"
                :fill="'url(#sankey-grad-' + idx + ')'"
                class="sankey-link"
              />
              <g v-for="(node, idx) in sankeyNodes" :key="'n' + idx">
                <rect
                  :x="node.x"
                  :y="node.y"
                  :width="12"
                  :height="node.height"
                  :fill="getChannelColor(node.colorIdx)"
                  rx="2"
                />
                <text
                  :x="node.x < 350 ? node.x + 18 : node.x - 6"
                  :y="node.y + node.height / 2 + 4"
                  :text-anchor="node.x < 350 ? 'start' : 'end'"
                  class="sankey-node-label"
                >
                  {{ node.name }} ({{ node.value }})
                </text>
              </g>
            </svg>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="mt-24">
      <el-col :span="24">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span class="card-title">渠道详细数据</span>
            </div>
          </template>
          <el-table
            :data="channelStore.statsOverview"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
          >
            <el-table-column prop="name" label="渠道名称" min-width="160">
              <template #default="{ row }">
                <div class="channel-name-cell">
                  <span class="channel-dot" :style="{ backgroundColor: getChannelColorByName(row.name) }" />
                  <span>{{ row.name }}</span>
                  <el-tag v-if="row.level > 1" size="small" type="info" effect="plain" class="level-tag">
                    Lv.{{ row.level }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="totalMembers" label="会员总数" min-width="100" align="right" sortable />
            <el-table-column label="占比" min-width="120">
              <template #default="{ row }">
                <div class="progress-cell">
                  <el-progress
                    :percentage="getPercentage(row.totalMembers)"
                    :stroke-width="8"
                    :show-text="false"
                    :color="getChannelColorByName(row.name)"
                  />
                  <span class="progress-text">{{ getPercentage(row.totalMembers) }}%</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="new30d" label="近30天新增" min-width="110" align="right" sortable />
            <el-table-column prop="new90d" label="近90天新增" min-width="110" align="right" sortable />
            <el-table-column label="7日变化" min-width="110" align="right">
              <template #default="{ row }">
                <el-tag
                  :type="row.change7d >= 0 ? 'success' : 'danger'"
                  size="small"
                  effect="plain"
                >
                  {{ row.change7d >= 0 ? '+' : '' }}{{ row.change7d }}%
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="avgPoints" label="平均积分" min-width="100" align="right" sortable />
            <el-table-column label="活跃率" min-width="100" align="right">
              <template #default="{ row }">
                <span>{{ row.activeRate }}%</span>
              </template>
            </el-table-column>
            <el-table-column label="转化率" min-width="100" align="right">
              <template #default="{ row }">
                <span>{{ row.conversionRate }}%</span>
              </template>
            </el-table-column>
            <el-table-column label="留存率" min-width="100" align="right">
              <template #default="{ row }">
                <span>{{ getRetentionRate(row.id) }}%</span>
              </template>
            </el-table-column>
            <el-table-column label="ROI" min-width="90" align="right">
              <template #default="{ row }">
                <el-tag v-if="row.roi !== null" size="small" :type="row.roi >= 1 ? 'success' : 'warning'">
                  {{ row.roi }}
                </el-tag>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <ChannelManage
      v-model="showManageDialog"
      @refresh="refreshAll"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useChannelStore } from '../stores/channel';
import { Setting } from '@element-plus/icons-vue';
import ChannelManage from '../components/ChannelManage.vue';

const channelStore = useChannelStore();
const trendDays = ref(30);
const showManageDialog = ref(false);
const hoveredSlice = ref(null);

const CHANNEL_COLORS = [
  '#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ef4444',
  '#06b6d4', '#eab308', '#ec4899', '#6366f1', '#14b8a6',
  '#f43f5e', '#84cc16'
];

const getChannelColor = (idx) => CHANNEL_COLORS[idx % CHANNEL_COLORS.length];
const getChannelColorByName = (name) => {
  const idx = channelStore.statsOverview.findIndex(c => c.name === name);
  return getChannelColor(idx >= 0 ? idx : 0);
};

const totalMembers = computed(() =>
  channelStore.statsOverview.reduce((s, c) => s + c.totalMembers, 0)
);

const pieData = computed(() => {
  const total = totalMembers.value || 1;
  return channelStore.statsOverview.map(c => ({
    ...c,
    percentage: Math.round((c.totalMembers / total) * 100)
  }));
});

const pieSlices = computed(() => {
  const total = totalMembers.value || 1;
  let currentAngle = -Math.PI / 2;
  const cx = 100, cy = 100, r = 80, ir = 50;
  return pieData.value.map((item, idx) => {
    const angle = (item.totalMembers / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    if (item.totalMembers === 0) return { path: '', color: getChannelColor(idx) };
    const x0 = cx + r * Math.cos(startAngle);
    const y0 = cy + r * Math.sin(startAngle);
    const x1 = cx + r * Math.cos(endAngle);
    const y1 = cy + r * Math.sin(endAngle);
    const x2 = cx + ir * Math.cos(endAngle);
    const y2 = cy + ir * Math.sin(endAngle);
    const x3 = cx + ir * Math.cos(startAngle);
    const y3 = cy + ir * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return {
      path: `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} L ${x2} ${y2} A ${ir} ${ir} 0 ${largeArc} 0 ${x3} ${y3} Z`,
      color: getChannelColor(idx)
    };
  });
});

const trendMaxY = computed(() => {
  let max = 0;
  channelStore.statsTrend.trends.forEach(t => {
    t.daily.forEach(d => { if (d.count > max) max = d.count; });
  });
  return max || 10;
});

const trendViewBox = computed(() => ({
  width: 760,
  height: 280
}));

const getTrendPoints = (trend, tIdx) => {
  const len = trend.daily.length;
  if (len === 0) return '';
  const width = trendViewBox.value.width - 70;
  const height = trendViewBox.value.height - 60;
  return trend.daily.map((p, i) => {
    const x = 40 + (i / (len - 1)) * width;
    const y = 30 + (1 - p.count / Math.max(trendMaxY.value, 1)) * height;
    return `${x},${y}`;
  }).join(' ');
};

const topStats = computed(() =>
  [...channelStore.statsOverview]
    .sort((a, b) => b.totalMembers - a.totalMembers)
    .slice(0, 5)
);

const maxTotal = computed(() =>
  Math.max(...channelStore.statsOverview.map(c => c.totalMembers), 1)
);

const getPercentage = (val) =>
  totalMembers.value > 0 ? Math.round((val / totalMembers.value) * 100) : 0;

const getRetentionRate = (channelId) => {
  const item = channelStore.statsRetention.find(r => r.id === channelId);
  return item ? item.retentionRate : 0;
};

const sankeyNodes = computed(() => {
  const nodes = [];
  const all = channelStore.statsSankey.nodes;
  const byLevel = {};
  all.forEach((n, i) => {
    if (!byLevel[n.level]) byLevel[n.level] = [];
    byLevel[n.level].push({ ...n, idx: i });
  });
  const levels = Object.keys(byLevel).map(Number).sort();
  levels.forEach((level, li) => {
    const items = byLevel[level];
    const total = items.reduce((s, n) => s + getNodeValue(n.idx), 0) || 1;
    const startX = 40 + li * ((700 - 80) / Math.max(levels.length - 1, 1));
    let yCursor = 20;
    items.forEach((n, ni) => {
      const value = getNodeValue(n.idx);
      const height = Math.max(20, (value / total) * 280);
      nodes.push({
        name: n.name,
        x: startX,
        y: yCursor,
        height,
        value,
        colorIdx: n.idx
      });
      yCursor += height + 10;
    });
  });
  return nodes;
});

const sankeyLinksWithPath = computed(() => {
  const nodes = sankeyNodes.value;
  const idxMap = {};
  channelStore.statsSankey.nodes.forEach((n, i) => { idxMap[i] = nodes.find(x => x.name === n.name); });
  return channelStore.statsSankey.links.map((l, i) => {
    const s = idxMap[l.source];
    const t = idxMap[l.target];
    if (!s || !t) return null;
    const x0 = s.x + 12;
    const x1 = t.x;
    const y0 = s.y + s.height / 2;
    const y1 = t.y + t.height / 2;
    const mx = (x0 + x1) / 2;
    return {
      path: `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`,
      x0, x1,
      sourceIdx: l.source,
      targetIdx: l.target,
      value: l.value
    };
  }).filter(Boolean);
});

const getNodeValue = (idx) => {
  const links = channelStore.statsSankey.links;
  let total = 0;
  links.forEach(l => {
    if (l.source === idx || l.target === idx) total += l.value;
  });
  const ch = channelStore.statsOverview.find(c => c.name === channelStore.statsSankey.nodes[idx]?.name);
  return ch?.totalMembers || total / 2 || 1;
};

const handleTrendDaysChange = () => {
  channelStore.fetchStatsTrend(trendDays.value);
};

const refreshAll = () => {
  channelStore.fetchChannels();
  channelStore.fetchFlatChannels();
  channelStore.fetchStatsOverview();
  channelStore.fetchStatsTrend(trendDays.value);
  channelStore.fetchStatsRetention();
  channelStore.fetchStatsSankey();
  channelStore.fetchAlerts();
};

onMounted(() => {
  refreshAll();
});
</script>

<style scoped>
.channel-analysis {
  padding: 12px 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
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

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.mr-12 { margin-right: 12px; }
.mr-4 { margin-right: 4px; }
.mr-8 { margin-right: 8px; }
.mb-8 { margin-bottom: 8px; }
.mt-24 { margin-top: 24px; }

.alert-section {
  margin-bottom: 16px;
}

.chart-card {
  border-radius: 12px;
  border: none;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pie-chart-wrapper {
  display: flex;
  align-items: center;
  gap: 24px;
}

.pie-svg {
  width: 220px;
  height: 220px;
  flex-shrink: 0;
}

.pie-slice {
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
  transform-origin: 100px 100px;
}

.pie-slice.active {
  opacity: 1;
  filter: brightness(1.1);
}

.pie-label-total {
  font-size: 28px;
  font-weight: 700;
  fill: #1e293b;
}

.pie-label-sub {
  font-size: 12px;
  fill: #64748b;
}

.pie-legend {
  flex: 1;
  max-height: 220px;
  overflow-y: auto;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.legend-item:hover {
  background-color: #f8fafc;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-line {
  width: 24px;
  height: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-name {
  font-size: 13px;
  color: #475569;
  flex: 1;
}

.legend-value {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.trend-chart-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trend-svg {
  width: 100%;
  height: 280px;
}

.trend-line {
  fill: none;
}

.trend-axis-label {
  font-size: 11px;
  fill: #94a3b8;
}

.trend-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 0 8px;
}

.funnel-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.funnel-item {
  padding: 12px;
  background-color: #f8fafc;
  border-radius: 8px;
}

.funnel-label {
  margin-bottom: 10px;
}

.funnel-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.funnel-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.funnel-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  width: 50px;
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 16px;
  background-color: #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: width 0.5s ease;
}

.bar-register { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.bar-active { background: linear-gradient(90deg, #22c55e, #4ade80); }
.bar-high { background: linear-gradient(90deg, #a855f7, #c084fc); }

.bar-value {
  width: 100px;
  font-size: 12px;
  color: #475569;
  text-align: right;
  flex-shrink: 0;
}

.sankey-wrapper {
  width: 100%;
  overflow-x: auto;
}

.sankey-svg {
  width: 100%;
  min-width: 700px;
  height: 350px;
}

.sankey-link {
  transition: opacity 0.2s;
}

.sankey-link:hover {
  opacity: 0.8;
}

.sankey-node-label {
  font-size: 12px;
  fill: #475569;
}

.channel-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.channel-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.level-tag {
  margin-left: 4px;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-text {
  font-size: 13px;
  color: #475569;
  min-width: 40px;
}

.text-muted {
  color: #94a3b8;
}

:deep(.el-table) {
  --el-table-border-color: #f1f5f9;
}
</style>
