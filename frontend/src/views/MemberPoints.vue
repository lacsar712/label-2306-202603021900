<template>
  <div class="member-points">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">会员积分管理</h2>
        <p class="page-subtitle">手动为会员增加或减少积分，自动匹配营销活动加成</p>
      </div>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <el-card class="points-card" shadow="never">
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top" class="points-form">
        <el-form-item label="选择会员" prop="memberId">
          <el-select
            v-model="form.memberId"
            placeholder="请选择会员"
            filterable
            class="w-full"
            :loading="loading"
          >
            <el-option
              v-for="item in members"
              :key="item.id"
              :label="`${item.name} (${item.phone})`"
              :value="item.id"
            >
              <div class="member-option">
                <span>{{ item.name }}</span>
                <span class="member-phone">{{ item.phone }}</span>
                <el-tag size="small" type="info" class="member-current-points">当前: {{ item.points }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="本次积分" prop="points">
          <template #label>
            <div class="form-label-with-tip">
              <span>本次积分</span>
              <span class="tip">输入正数为增加，负数为减少（正积分将自动匹配活动加成）</span>
            </div>
          </template>
          <el-input-number v-model="form.points" class="w-full" :precision="0" />
        </el-form-item>

        <el-form-item class="form-actions">
          <el-button type="primary" :loading="submitting" @click="handleSubmit" size="large" class="submit-btn">
            确定
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="lastResult" class="result-card" shadow="never">
      <div class="result-title">
        <el-icon class="result-icon success"><CircleCheck /></el-icon>
        <span>操作成功</span>
      </div>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="原始积分">{{ lastResult.originalPoints }}</el-descriptions-item>
        <el-descriptions-item label="活动加成">
          <span class="accent">+{{ lastResult.bonusPoints }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="实际变更" :span="2">
          <span class="strong">{{ lastResult.finalPoints > 0 ? '+' : '' }}{{ lastResult.finalPoints }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="命中活动" :span="2">
          <template v-if="lastResult.campaignsHit && lastResult.campaignsHit.length > 0">
            <el-tag v-for="c in lastResult.campaignsHit" :key="c.campaignId" type="warning" effect="light" style="margin-right: 6px;">
              {{ c.campaignName }}
            </el-tag>
          </template>
          <span v-else class="muted">未命中任何活动</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api/axios';
import { ElMessage } from 'element-plus';
import { CircleCheck } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const submitting = ref(false);
const members = ref([]);
const lastResult = ref(null);

const form = reactive({
  memberId: null,
  points: 0
});

const rules = {
  memberId: [{ required: true, message: '请选择会员', trigger: 'change' }],
  points: [{ required: true, message: '请输入积分', trigger: 'blur' }]
};

const fetchMembers = async () => {
  loading.value = true;
  try {
    members.value = await api.get('/members');
    if (route.query.memberId) {
      form.memberId = parseInt(route.query.memberId);
    }
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      if (form.points === 0) {
        ElMessage.warning('积分变动不能为0');
        return;
      }
      submitting.value = true;
      try {
        const result = await api.post(`/members/${form.memberId}/points`, { points: form.points });
        lastResult.value = result;
        ElMessage.success('积分更新成功');
        await fetchMembers();
      } finally {
        submitting.value = false;
      }
    }
  });
};

onMounted(() => {
  fetchMembers();
});
</script>

<style scoped>
.member-points {
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

.points-card, .result-card {
  max-width: 600px;
  margin: 0 auto 16px;
  border-radius: 12px;
  border: none;
  padding: 20px;
}

.w-full {
  width: 100%;
}

.member-option {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-phone {
  color: #94a3b8;
  font-size: 12px;
}

.member-current-points {
  margin-left: auto;
}

.form-label-with-tip {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.tip {
  font-size: 12px;
  font-weight: normal;
  color: #94a3b8;
}

.form-actions {
  margin-top: 32px;
  margin-bottom: 0;
}

.submit-btn {
  width: 100%;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 16px;
}

.result-icon.success {
  color: #22c55e;
  font-size: 20px;
}

.accent {
  color: #ef4444;
  font-weight: 600;
}

.strong {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.muted {
  color: #94a3b8;
}
</style>
