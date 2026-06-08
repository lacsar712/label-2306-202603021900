<template>
  <div class="customize-page">
    <div class="customize-header">
      <div class="header-left">
        <el-button link @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h2 class="page-title">看板配置</h2>
        <el-tag type="info">支持拖拽调整顺序、尺寸，点击编辑组件属性</el-tag>
      </div>
      <div class="header-right">
        <el-button :icon="RefreshLeft" plain @click="handleReset">恢复默认</el-button>
        <el-button v-if="isAdmin" :icon="Promotion" plain @click="handleSaveAsTemplate">
          设为默认模板
        </el-button>
        <el-button :icon="Close" plain @click="handleCancel">取消</el-button>
        <el-button type="primary" :icon="Check" @click="handleSave" :loading="saving">
          保存配置
        </el-button>
      </div>
    </div>

    <div class="customize-body">
      <div class="sidebar">
        <div class="sidebar-title">
          <el-icon><Grid /></el-icon>
          组件库
        </div>
        <div class="component-list">
          <div
            v-for="(meta, type) in COMPONENT_META"
            :key="type"
            class="comp-item"
            draggable="true"
            @dragstart="onDragNew($event, type)"
            @click="addComponent(type)"
          >
            <el-icon :size="18" class="comp-icon"><component :is="meta.icon" /></el-icon>
            <span class="comp-name">{{ meta.name }}</span>
            <el-icon class="comp-add"><Plus /></el-icon>
          </div>
        </div>

        <div class="sidebar-title mt-24">
          <el-icon><List /></el-icon>
          已添加组件
        </div>
        <div class="added-list">
          <div
            v-for="comp in sortedComponents"
            :key="comp.id"
            class="added-item"
            :class="{ inactive: !comp.visible, editing: editingId === comp.id }"
            @click="selectComponent(comp)"
          >
            <el-checkbox
              v-model="comp.visible"
              @click.stop
              @change="() => {}"
            />
            <span class="added-title">{{ comp.title }}</span>
            <span class="added-type">{{ COMPONENT_META[comp.type]?.name }}</span>
            <el-button link type="danger" size="small" @click.stop="removeComponent(comp.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div class="preview-area">
        <div class="preview-header">
          <span>实时预览</span>
          <span class="hint">提示：拖拽组件调整位置，拖拽右下角调整尺寸</span>
        </div>
        <div
          class="grid-canvas"
          ref="gridRef"
          :style="gridStyle"
          @dragover.prevent
          @drop="onDrop"
        >
          <div
            v-for="x in 12"
            :key="'v-'+x"
            class="grid-line grid-line-v"
            :style="{ left: ((x - 1) / 12 * 100) + '%' }"
          ></div>
          <div
            v-for="y in totalRows"
            :key="'h-'+y"
            class="grid-line grid-line-h"
            :style="{ top: ((y - 1) * (cellSize + gap)) + 'px' }"
          ></div>

          <div
            v-for="comp in components"
            :key="comp.id"
            class="grid-cell"
            :class="{ 'is-editing': editingId === comp.id, 'is-hidden': !comp.visible }"
            :style="getCellStyle(comp)"
            draggable="true"
            @dragstart="onDragStart($event, comp)"
            @dragend="onDragEnd"
            @click.stop="selectComponent(comp)"
          >
            <div class="cell-header">
              <span class="cell-title">{{ comp.title }}</span>
              <span class="cell-type">{{ COMPONENT_META[comp.type]?.name }}</span>
            </div>
            <div class="cell-body">
              <component
                v-if="comp.visible && COMPONENT_MAP[comp.type]"
                :is="COMPONENT_MAP[comp.type]"
                :component="comp"
                :refresh-interval="0"
              />
              <el-empty v-else-if="!comp.visible" description="已隐藏" :image-size="40" />
            </div>
            <div class="cell-resize" @mousedown.stop="startResize($event, comp)"></div>
          </div>
        </div>
      </div>

      <div class="config-panel" v-if="selectedComponent">
        <div class="panel-title">
          <el-icon><Setting /></el-icon>
          组件配置
        </div>
        <div class="panel-body">
          <el-form label-width="90px" label-position="left">
            <el-form-item label="标题">
              <el-input v-model="selectedComponent.title" maxlength="30" />
            </el-form-item>
            <el-form-item label="组件类型">
              <el-tag>{{ COMPONENT_META[selectedComponent.type]?.name }}</el-tag>
            </el-form-item>
            <el-form-item label="显示">
              <el-switch v-model="selectedComponent.visible" />
            </el-form-item>
            <el-form-item label="刷新频率">
              <el-select v-model="selectedComponent.refreshInterval">
                <el-option :value="0" label="不自动刷新" />
                <el-option :value="30" label="30 秒" />
                <el-option :value="60" label="1 分钟" />
                <el-option :value="120" label="2 分钟" />
                <el-option :value="300" label="5 分钟" />
                <el-option :value="600" label="10 分钟" />
                <el-option :value="3600" label="1 小时" />
              </el-select>
            </el-form-item>
            <el-form-item label="时间范围" v-if="supportsTimeRange(selectedComponent.type)">
              <el-select v-model="selectedComponent.timeRange" clearable>
                <el-option value="today" label="今日" />
                <el-option value="7days" label="近 7 天" />
                <el-option value="30days" label="近 30 天" />
                <el-option value="90days" label="近 90 天" />
              </el-select>
            </el-form-item>
            <el-form-item label="统计类型" v-if="selectedComponent.type === 'STAT_CARD'">
              <el-select v-model="statConfig.statType" @change="updateStatType">
                <el-option
                  v-for="opt in STAT_TYPES"
                  :key="opt.value"
                  :value="opt.value"
                  :label="opt.label"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="趋势天数" v-if="selectedComponent.type === 'CHECKIN_TREND'">
              <el-input-number v-model="trendConfig.days" :min="3" :max="30" @change="updateTrendDays" />
            </el-form-item>
            <el-form-item label="位置">
              <span class="dim-label">X: {{ selectedComponent.x }}，Y: {{ selectedComponent.y }}</span>
            </el-form-item>
            <el-form-item label="尺寸">
              <el-input-number v-model="selectedComponent.width" :min="getMeta(selectedComponent.type).minWidth" :max="getMeta(selectedComponent.type).maxWidth" size="small" />
              <span class="dim-label">×</span>
              <el-input-number v-model="selectedComponent.height" :min="getMeta(selectedComponent.type).minHeight" :max="getMeta(selectedComponent.type).maxHeight" size="small" />
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDashboardStore } from '../stores/dashboard';
import { useAuthStore } from '../stores/auth';
import { COMPONENT_MAP, COMPONENT_META, STAT_TYPES } from '../components/dashboard';
import {
  ArrowLeft, RefreshLeft, Close, Check, Plus, Delete,
  Grid, List, Setting, Promotion,
  DataLine, TrendCharts, PieChart, Trophy, Warning, Bell, Histogram, Tickets, Clock,
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const dashboardStore = useDashboardStore();
const authStore = useAuthStore();
const isAdmin = computed(() => authStore.isAdmin);

const components = ref([]);
const editingId = ref(null);
const selectedComponent = ref(null);
const saving = ref(false);
const gridRef = ref(null);

const gridCols = 12;
const cellSize = 60;
const gap = 10;

const sortedComponents = computed(() => [...components.value].sort((a, b) => a.order - b.order));

const totalRows = computed(() =>
  Math.max(components.value.reduce((m, c) => Math.max(m, c.y + c.height), 1), 8)
);

const gridStyle = computed(() => ({
  minHeight: `${totalRows.value * (cellSize + gap)}px`,
  '--cell-size': `${cellSize}px`,
  '--gap': `${gap}px`,
}));

const statConfig = computed({
  get: () => ({ statType: selectedComponent.value?.config?.statType || 'TOTAL_MEMBERS' }),
  set: (v) => {},
});
const trendConfig = computed({
  get: () => ({ days: selectedComponent.value?.config?.days || 7 }),
  set: (v) => {},
});

const getMeta = (type) => COMPONENT_META[type] || { minWidth: 2, maxWidth: 12, minHeight: 2, maxHeight: 12 };
const supportsTimeRange = (type) => ['CHECKIN_TREND', 'TICKET_SLA', 'POINTS_EXPIRY'].includes(type);

const updateStatType = (val) => {
  if (!selectedComponent.value) return;
  selectedComponent.value.config = { ...(selectedComponent.value.config || {}), statType: val };
  selectedComponent.value.title = STAT_TYPES.find(s => s.value === val)?.label || selectedComponent.value.title;
};
const updateTrendDays = (val) => {
  if (!selectedComponent.value) return;
  selectedComponent.value.config = { ...(selectedComponent.value.config || {}), days: val };
};

const getCellStyle = (comp) => {
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

let draggingComp = null;
let dragStartPos = null;
let dragStartXY = null;

const onDragNew = (e, type) => {
  e.dataTransfer.setData('new-type', type);
  e.dataTransfer.effectAllowed = 'copy';
};

const onDragStart = (e, comp) => {
  draggingComp = comp;
  dragStartPos = { x: e.clientX, y: e.clientY };
  dragStartXY = { x: comp.x, y: comp.y };
  e.dataTransfer.effectAllowed = 'move';
};

const onDragEnd = () => {
  draggingComp = null;
  dragStartPos = null;
  dragStartXY = null;
};

const onDrop = (e) => {
  const rect = gridRef.value.getBoundingClientRect();
  const relX = e.clientX - rect.left;
  const relY = e.clientY - rect.top;
  const cellW = rect.width / gridCols;
  const newX = Math.floor(relX / cellW);
  const newY = Math.floor(relY / (cellSize + gap));

  const newType = e.dataTransfer.getData('new-type');
  if (newType) {
    addComponent(newType, newX, newY);
    return;
  }

  if (draggingComp && dragStartPos) {
    const meta = getMeta(draggingComp.type);
    const dx = Math.round((e.clientX - dragStartPos.x) / cellW);
    const dy = Math.round((e.clientY - dragStartPos.y) / (cellSize + gap));
    let tx = Math.max(0, Math.min(gridCols - draggingComp.width, dragStartXY.x + dx));
    let ty = Math.max(0, dragStartXY.y + dy);
    resolveCollision(draggingComp.id, tx, ty, draggingComp.width, draggingComp.height);
  }
};

const resolveCollision = (selfId, newX, newY, w, h) => {
  const self = components.value.find(c => c.id === selfId);
  if (!self) return;
  const colliding = components.value.filter(c =>
    c.id !== selfId && c.visible &&
    !(newX + w <= c.x || newX >= c.x + c.width || newY + h <= c.y || newY >= c.y + c.height)
  );
  if (colliding.length === 0) {
    self.x = newX;
    self.y = newY;
    reorder();
    return;
  }
  let targetY = newY;
  while (true) {
    const hasCollision = components.value.some(c =>
      c.id !== selfId && c.visible &&
      !(newX + w <= c.x || newX >= c.x + c.width || targetY + h <= c.y || targetY >= c.y + c.height)
    );
    if (!hasCollision) break;
    targetY++;
    if (targetY > 100) return;
  }
  self.x = newX;
  self.y = targetY;
  reorder();
};

const reorder = () => {
  const sorted = [...components.value].sort((a, b) => a.y - b.y || a.x - b.x);
  sorted.forEach((c, i) => { c.order = i; });
};

let resizingComp = null;
let resizeStart = null;

const startResize = (e, comp) => {
  resizingComp = comp;
  resizeStart = {
    x: e.clientX, y: e.clientY,
    w: comp.width, h: comp.height,
  };
  const onMove = (ev) => {
    if (!resizingComp || !resizeStart) return;
    const meta = getMeta(resizingComp.type);
    const rect = gridRef.value.getBoundingClientRect();
    const cellW = rect.width / gridCols;
    const dw = Math.round((ev.clientX - resizeStart.x) / cellW);
    const dh = Math.round((ev.clientY - resizeStart.y) / (cellSize + gap));
    let newW = Math.max(meta.minWidth, Math.min(meta.maxWidth, Math.min(gridCols - resizingComp.x, resizeStart.w + dw)));
    let newH = Math.max(meta.minHeight, Math.min(meta.maxHeight, resizeStart.h + dh));
    const hasCollision = components.value.some(c =>
      c.id !== resizingComp.id && c.visible &&
      !(resizingComp.x + newW <= c.x || resizingComp.x >= c.x + c.width ||
        resizingComp.y + newH <= c.y || resizingComp.y >= c.y + c.height)
    );
    if (!hasCollision) {
      resizingComp.width = newW;
      resizingComp.height = newH;
    }
  };
  const onUp = () => {
    resizingComp = null;
    resizeStart = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};

const genId = () => Date.now() + Math.floor(Math.random() * 10000);

const addComponent = (type, x = 0, y = null) => {
  const meta = getMeta(type);
  const order = components.value.length;
  let targetY = y;
  if (targetY === null) {
    targetY = components.value.reduce((m, c) => Math.max(m, c.y + c.height), 0);
  }
  let targetX = x;
  const newComp = {
    id: genId(),
    type,
    title: meta.name,
    x: targetX,
    y: targetY,
    width: meta.defaultWidth,
    height: meta.defaultHeight,
    visible: true,
    refreshInterval: 60,
    timeRange: null,
    config: { ...(meta.config || {}) },
    order,
  };
  resolveCollision(newComp.id, targetX, targetY, newComp.width, newComp.height);
  components.value.push(newComp);
  reorder();
  selectComponent(newComp);
};

const removeComponent = (id) => {
  components.value = components.value.filter(c => c.id !== id);
  if (selectedComponent.value?.id === id) {
    selectedComponent.value = null;
    editingId.value = null;
  }
  reorder();
};

const selectComponent = (comp) => {
  selectedComponent.value = comp;
  editingId.value = comp.id;
};

const handleSave = async () => {
  saving.value = true;
  try {
    await dashboardStore.saveConfig(components.value);
    ElMessage.success('看板配置已保存');
    router.push('/');
  } finally {
    saving.value = false;
  }
};

const handleCancel = () => {
  router.back();
};

const handleReset = async () => {
  try {
    await ElMessageBox.confirm('确认恢复默认布局？当前修改将丢失。', '恢复默认', {
      type: 'warning',
    });
    const data = await dashboardStore.reset();
    components.value = JSON.parse(JSON.stringify(data.components || []));
    selectedComponent.value = null;
    editingId.value = null;
    ElMessage.success('已恢复默认布局');
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
};

const handleSaveAsTemplate = async () => {
  try {
    await ElMessageBox.confirm('确认将当前布局设为所有新用户的默认模板？', '设为默认模板', {
      type: 'warning',
    });
    await dashboardStore.setDefaultTemplate(components.value);
    ElMessage.success('已设为默认模板');
  } catch (e) {
    if (e !== 'cancel') console.error(e);
  }
};

onMounted(async () => {
  if (dashboardStore.components.length === 0) {
    await dashboardStore.loadConfig();
  }
  components.value = JSON.parse(JSON.stringify(dashboardStore.components || []));
  reorder();
});
</script>

<style scoped>
.customize-page {
  padding: 12px 24px 24px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  overflow: hidden;
}
.customize-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 20px; font-weight: 700; color: #1e293b; margin: 0; }
.header-right { display: flex; gap: 8px; }

.customize-body {
  flex: 1; display: flex; gap: 16px; margin-top: 16px; min-height: 0;
}

.sidebar {
  width: 240px; flex-shrink: 0;
  background: #fff; border-radius: 12px; padding: 16px;
  border: 1px solid #e2e8f0; overflow-y: auto;
  display: flex; flex-direction: column;
}
.sidebar-title {
  font-size: 13px; font-weight: 600; color: #475569;
  display: flex; align-items: center; gap: 6px; margin-bottom: 12px;
}
.mt-24 { margin-top: 24px; }

.component-list, .added-list {
  display: flex; flex-direction: column; gap: 6px;
}
.comp-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  background: #f8fafc; cursor: pointer;
  transition: all 0.2s; border: 1px dashed transparent;
}
.comp-item:hover {
  background: #eff6ff; border-color: #3b82f6;
}
.comp-icon { color: #4f46e5; }
.comp-name { flex: 1; font-size: 13px; color: #1e293b; }
.comp-add { color: #94a3b8; font-size: 16px; }

.added-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  transition: background 0.2s;
}
.added-item:hover { background: #f1f5f9; }
.added-item.inactive { opacity: 0.5; }
.added-item.editing { background: #eff6ff; }
.added-title { flex: 1; font-size: 13px; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.added-type { font-size: 11px; color: #94a3b8; flex-shrink: 0; }

.preview-area {
  flex: 1; background: #fff; border-radius: 12px;
  border: 1px solid #e2e8f0; display: flex; flex-direction: column;
  overflow: hidden; min-width: 0;
}
.preview-header {
  padding: 12px 16px; border-bottom: 1px solid #e2e8f0;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 14px; font-weight: 600; color: #1e293b; flex-shrink: 0;
}
.hint { font-size: 12px; color: #94a3b8; font-weight: 400; }

.grid-canvas {
  flex: 1; padding: 12px; overflow: auto; position: relative;
  background: #fafbfc;
}
.grid-line {
  position: absolute; background: #e2e8f0; opacity: 0.5; z-index: 0;
}
.grid-line-v { width: 1px; height: 100%; top: 0; }
.grid-line-h { height: 1px; width: calc(100% - 24px); left: 12px; }

.grid-cell {
  background: #fff; border: 2px solid #e2e8f0; border-radius: 10px;
  cursor: move; overflow: hidden; z-index: 1;
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex; flex-direction: column;
}
.grid-cell:hover { border-color: #3b82f6; }
.grid-cell.is-editing { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.15); }
.grid-cell.is-hidden { opacity: 0.4; }

.cell-header {
  padding: 8px 12px; background: #f8fafc;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
}
.cell-title { font-size: 13px; font-weight: 600; color: #1e293b; }
.cell-type { font-size: 11px; color: #94a3b8; }
.cell-body { flex: 1; padding: 8px; overflow: hidden; min-height: 0; }
.cell-resize {
  position: absolute; right: 0; bottom: 0;
  width: 18px; height: 18px; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #4f46e5 50%);
  border-bottom-right-radius: 8px;
}

.config-panel {
  width: 300px; flex-shrink: 0;
  background: #fff; border-radius: 12px;
  border: 1px solid #e2e8f0; overflow-y: auto;
  display: flex; flex-direction: column;
}
.panel-title {
  padding: 16px; border-bottom: 1px solid #e2e8f0;
  font-size: 14px; font-weight: 600; color: #1e293b;
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.panel-body { padding: 16px; flex: 1; }
.dim-label { font-size: 13px; color: #64748b; margin: 0 6px; }
</style>
