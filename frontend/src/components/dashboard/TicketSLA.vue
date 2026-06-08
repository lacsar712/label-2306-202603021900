<template>
  <div class="sla-wrap">
    <div class="sla-summary">
      <div class="sla-stat total">
        <div class="sla-num">{{ data.totalOpen }}</div>
        <div class="sla-label">待处理</div>
      </div>
      <div class="sla-stat due" :class="{ danger: data.dueSoon > 0 }">
        <div class="sla-num">{{ data.dueSoon }}</div>
        <div class="sla-label">即将超时</div>
      </div>
      <div class="sla-stat overdue" :class="{ danger: data.overdue > 0 }">
        <div class="sla-num">{{ data.overdue }}</div>
        <div class="sla-label">已超时</div>
      </div>
    </div>
    <div class="priority-section" v-if="data.byPriority && data.byPriority.length > 0">
      <div class="section-title">按优先级分布</div>
      <div class="priority-list">
        <div v-for="p in data.byPriority" :key="p.priority" class="priority-item">
          <span class="priority-name">{{ getPriorityLabel(p.priority) }}</span>
          <el-progress
            :percentage="data.totalOpen > 0 ? (p._count / data.totalOpen) * 100 : 0"
            :stroke-width="8"
            :color="getPriorityColor(p.priority)"
            :show-text="false"
          />
          <span class="priority-count">{{ p._count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { fetchTicketSLA } from '../../api/dashboard';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 120 },
});

const timeRange = computed(() => props.component?.timeRange || null);
const data = reactive({ totalOpen: 0, overdue: 0, dueSoon: 0, byPriority: [] });
let timer = null;

const rangeLabel = computed(() => {
  const map = { today: '今日', '7days': '近 7 日', '30days': '近 30 日', '90days': '近 90 日' };
  return map[timeRange.value] || '全部';
});

const getPriorityLabel = (p) => ({ LOW: '低', MEDIUM: '中', HIGH: '高', URGENT: '紧急' }[p] || p);
const getPriorityColor = (p) => ({ LOW: '#94a3b8', MEDIUM: '#3b82f6', HIGH: '#f97316', URGENT: '#ef4444' }[p] || '#94a3b8');

const loadData = async () => {
  try {
    const result = await fetchTicketSLA({ timeRange: timeRange.value });
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
.sla-wrap { height: 100%; display: flex; flex-direction: column; }
.sla-summary { display: flex; gap: 12px; margin-bottom: 16px; }
.sla-stat {
  flex: 1; padding: 12px; border-radius: 8px;
  background: #f8fafc; text-align: center;
}
.sla-stat.due { background: #fffbeb; }
.sla-stat.overdue { background: #fef2f2; }
.sla-stat.danger .sla-num { color: #ef4444; animation: pulse 2s infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.sla-num { font-size: 24px; font-weight: 700; color: #1e293b; line-height: 1.2; }
.sla-label { font-size: 12px; color: #64748b; margin-top: 4px; }
.section-title { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 10px; }
.priority-section { flex: 1; }
.priority-list { display: flex; flex-direction: column; gap: 10px; }
.priority-item { display: flex; align-items: center; gap: 10px; }
.priority-name { font-size: 13px; color: #475569; width: 50px; flex-shrink: 0; }
.priority-count { font-size: 13px; font-weight: 600; color: #1e293b; width: 30px; text-align: right; flex-shrink: 0; }
.priority-item .el-progress { flex: 1; }
</style>
