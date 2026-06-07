<template>
  <div class="birthday-wrap">
    <div class="birthday-header">
      <el-icon :size="18" color="#f43f5e"><Bell /></el-icon>
      <span class="header-title">近期生日会员</span>
    </div>
    <div class="birthday-list" v-if="data.length > 0">
      <div v-for="item in data" :key="item.id" class="birthday-item">
        <div class="avatar">
          <el-avatar :size="36" style="background: linear-gradient(135deg,#f43f5e,#fb923c);">
            {{ item.name?.charAt(0) || '会' }}
          </el-avatar>
        </div>
        <div class="info">
          <div class="name">{{ item.name }}</div>
          <div class="meta">
            <el-tag size="small" :type="getLevelTagType(item.level)">{{ getLevelLabel(item.level) }}</el-tag>
            <span class="phone">{{ item.phone }}</span>
          </div>
        </div>
        <div class="date">
          <el-icon color="#f43f5e"><Cake /></el-icon>
          <span>{{ formatDate(item.birthday) }}</span>
        </div>
      </div>
    </div>
    <el-empty v-else :image-size="60" description="暂无近期生日" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { fetchBirthdayReminder } from '../../api/dashboard';
import { Bell, Cake } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 3600 },
});

const data = ref([]);
let timer = null;

const getLevelLabel = (l) => ({ NORMAL: '普通', SILVER: '白银', GOLD: '黄金', PLATINUM: '铂金' }[l] || l);
const getLevelTagType = (l) => ({ NORMAL: 'info', SILVER: '', GOLD: 'warning', PLATINUM: 'danger' }[l] || 'info');
const formatDate = (d) => d ? dayjs(d).format('MM-DD') : '-';

const loadData = async () => {
  try {
    data.value = await fetchBirthdayReminder();
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
.birthday-wrap { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.birthday-header { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; flex-shrink: 0; }
.header-title { font-size: 14px; font-weight: 600; color: #1e293b; }
.birthday-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px; }
.birthday-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px; background: #f8fafc; border-radius: 8px;
  transition: background 0.2s;
}
.birthday-item:hover { background: #f1f5f9; }
.info { flex: 1; min-width: 0; }
.name { font-size: 14px; font-weight: 500; color: #1e293b; margin-bottom: 4px; }
.meta { display: flex; align-items: center; gap: 8px; }
.phone { font-size: 12px; color: #64748b; }
.date { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #f43f5e; font-weight: 500; flex-shrink: 0; }
</style>
