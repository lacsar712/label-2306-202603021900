<template>
  <div class="channel-alerts-wrap">
    <div class="alerts-list" v-if="alerts.length > 0">
      <el-alert
        v-for="(alert, idx) in alerts"
        :key="alert.channelId"
        :type="alert.type === 'DROP' ? 'error' : 'warning'"
        :title="alert.type === 'DROP' ? '📉 渠道新增骤降' : '📈 渠道新增激增'"
        show-icon
        :closable="false"
      >
        <template #default>
          <div class="alert-content">
            <span class="alert-channel">{{ alert.channelName }}</span>
            <span class="alert-msg">{{ alert.message }}</span>
            <el-button link type="primary" size="small" @click="goToChannel(alert)">
              查看详情 →
            </el-button>
          </div>
        </template>
      </el-alert>
    </div>
    <div v-else class="all-good">
      <el-icon class="good-icon"><CircleCheck /></el-icon>
      <span class="good-text">暂无异常波动，各渠道数据稳定</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { fetchChannelAlerts } from '../../api/dashboard';
import { CircleCheck } from '@element-plus/icons-vue';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 1800 },
});

const router = useRouter();
const alerts = ref([]);
let timer = null;

const goToChannel = (alert) => {
  router.push('/channels');
};

const loadData = async () => {
  try {
    alerts.value = await fetchChannelAlerts();
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
.channel-alerts-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}
.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
:deep(.el-alert) {
  border-radius: 8px;
}
.alert-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.alert-channel {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  background: rgba(255, 255, 255, 0.7);
  padding: 2px 10px;
  border-radius: 12px;
}
.alert-msg {
  font-size: 13px;
  color: #475569;
  flex: 1;
}
.all-good {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
}
.good-icon {
  font-size: 20px;
  color: #22c55e;
}
.good-text {
  font-size: 14px;
  color: #15803d;
}
</style>
