<template>
  <div class="banner-wrap" v-if="data.length > 0">
    <div class="banner-scroll">
      <div
        v-for="campaign in data"
        :key="campaign.id"
        class="banner-item"
        @click="$router.push('/campaigns')"
      >
        <span class="banner-icon">🎁</span>
        <span class="banner-name">{{ campaign.name }}</span>
        <el-tag size="small" type="warning" effect="dark" class="banner-type">{{ getTypeLabel(campaign.type) }}</el-tag>
        <span class="banner-remaining">剩余 {{ getRemainingTime(campaign.endTime) }}</span>
      </div>
    </div>
  </div>
  <div v-else class="empty-banner">
    <el-empty :image-size="40" description="暂无进行中的活动" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { fetchCampaignBanner } from '../../api/dashboard';
import dayjs from 'dayjs';

const props = defineProps({
  component: { type: Object, required: true },
  refreshInterval: { type: Number, default: 300 },
});

const data = ref([]);
const tick = ref(0);
let timer = null;
let refreshTimer = null;

const getTypeLabel = (t) => {
  const map = {
    DOUBLE_POINTS: '双倍积分', SPEND_GIFT_POINTS: '满赠积分',
    LEVEL_BONUS: '等级加成', SIGNIN_DOUBLE: '签到翻倍',
    EXCHANGE_DISCOUNT: '兑换折扣',
  };
  return map[t] || t;
};

const getRemainingTime = (endTime) => {
  tick.value;
  const now = dayjs();
  const end = dayjs(endTime);
  const diffMs = end.diff(now);
  if (diffMs <= 0) return '已结束';
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分钟`;
};

const loadData = async () => {
  try {
    data.value = await fetchCampaignBanner();
  } catch (e) {
    console.error(e);
  }
};

onMounted(() => {
  loadData();
  timer = setInterval(() => { tick.value++; }, 60000);
  if (props.refreshInterval > 0) {
    refreshTimer = setInterval(loadData, props.refreshInterval * 1000);
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
.banner-wrap {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
  height: 100%;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}
.banner-scroll {
  display: flex;
  overflow-x: auto;
  gap: 4px;
  padding: 4px;
  height: 100%;
  align-items: center;
}
.banner-scroll::-webkit-scrollbar { display: none; }
.banner-item {
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  color: white;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
  height: 100%;
}
.banner-item:hover { background-color: rgba(255, 255, 255, 0.1); }
.banner-icon { font-size: 22px; }
.banner-name { font-weight: 600; font-size: 14px; white-space: nowrap; }
.banner-type { flex-shrink: 0; }
.banner-remaining { margin-left: auto; font-size: 12px; opacity: 0.9; white-space: nowrap; }
.empty-banner { height: 100%; display: flex; align-items: center; justify-content: center; }
</style>
