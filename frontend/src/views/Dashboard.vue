<template>
  <div class="dashboard-new">
    <div class="dashboard-header">
      <div class="header-left">
        <h2 class="page-title">数据概览</h2>
        <div class="filter-status" v-if="dashboardStore.filters.channelId">
          <el-tag closable @close="dashboardStore.clearFilters()" type="primary" effect="light">
            已按渠道联动过滤，点击清除
          </el-tag>
        </div>
      </div>
      <div class="header-right">
        <el-button :icon="Refresh" plain @click="handleRefresh">刷新</el-button>
        <el-button :icon="RefreshLeft" plain @click="handleReset" v-if="!loading">恢复默认</el-button>
        <el-button type="primary" :icon="Setting" @click="$router.push('/dashboard/customize')">
          配置看板
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="dashboard-grid" :style="gridStyle">
      <template v-for="comp in visibleComponents" :key="comp.id">
        <div
          class="grid-item"
          :style="getItemStyle(comp)"
        >
          <el-card shadow="never" class="component-card" :body-style="{ padding: '16px', height: '100%' }">
            <template v-if="COMPONENT_MAP[comp.type]" #header>
              <div class="card-header">
                <span class="card-title">{{ comp.title }}</span>
                <span class="refresh-tag" v-if="comp.refreshInterval > 0">
                  <el-icon><Refresh /></el-icon>
                  {{ comp.refreshInterval }}s
                </span>
              </div>
            </template>
            <div class="component-body">
              <component
                :is="COMPONENT_MAP[comp.type]"
                :component="comp"
                :refresh-interval="comp.refreshInterval || 0"
              />
            </div>
          </el-card>
        </div>
      </template>
      <el-empty v-if="visibleComponents.length === 0 && !loading" description="暂无组件，请前往配置页添加" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useDashboardStore } from '../stores/dashboard';
import { COMPONENT_MAP } from '../components/dashboard';
import { Refresh, Setting, RefreshLeft } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const dashboardStore = useDashboardStore();
const loading = ref(false);

const visibleComponents = computed(() =>
  (dashboardStore.components || []).filter(c => c.visible).sort((a, b) => a.y - b.y || a.x - b.x)
);

const gridCols = 12;
const cellSize = 70;
const gap = 16;

const gridStyle = computed(() => {
  const maxY = visibleComponents.value.reduce((m, c) => Math.max(m, c.y + c.height), 0);
  return {
    position: 'relative',
    width: '100%',
    minHeight: `${maxY * cellSize + (maxY - 1) * gap}px`,
  };
});

const getItemStyle = (comp) => {
  const leftPct = (comp.x / gridCols) * 100;
  const widthPct = (comp.width / gridCols) * 100;
  const topPx = comp.y * (cellSize + gap);
  const heightPx = comp.height * cellSize + (comp.height - 1) * gap;
  return {
    position: 'absolute',
    left: `calc(${leftPct}% + ${(comp.x / gridCols) * gap * (gridCols - comp.width) / 2}px)`,
    top: `${topPx}px`,
    width: `calc(${widthPct}% - ${gap * (gridCols - comp.width) / gridCols}px)`,
    height: `${heightPx}px`,
  };
};

const loadConfig = async () => {
  loading.value = true;
  try {
    await dashboardStore.loadConfig();
  } finally {
    loading.value = false;
  }
};

const handleRefresh = () => {
  loadConfig();
  ElMessage.success('看板已刷新');
};

const handleReset = async () => {
  try {
    await ElMessageBox.confirm('确认恢复默认看板布局？当前个性化配置将丢失。', '恢复默认', {
      type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消',
    });
    await dashboardStore.reset();
    ElMessage.success('已恢复默认布局');
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
};

onMounted(() => {
  loadConfig();
});
</script>

<style scoped>
.dashboard-new { padding: 12px 24px 24px; }
.dashboard-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }
.header-right { display: flex; gap: 8px; }
.dashboard-grid { position: relative; }
.grid-item { transition: all 0.3s ease; }
.component-card {
  height: 100%;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: box-shadow 0.2s;
}
.component-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-size: 15px; font-weight: 600; color: #1e293b; }
.refresh-tag {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: #94a3b8;
}
.component-body { height: calc(100% - 40px); overflow: hidden; }
</style>
