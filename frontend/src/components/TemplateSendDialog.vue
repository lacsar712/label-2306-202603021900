<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="`发送通知 - ${template?.name || ''}`"
    width="720px"
    destroy-on-close
    @closed="resetState"
  >
    <div class="send-dialog" v-loading="loading">
      <el-descriptions :column="2" border size="small" class="version-info">
        <el-descriptions-item label="模板名称">
          {{ template?.name }}
        </el-descriptions-item>
        <el-descriptions-item label="当前版本">
          <el-tag size="small" type="primary">
            v{{ template?.currentVersion?.versionNumber || '-' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="版本备注" :span="2">
          {{ template?.currentVersion?.remark || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-form-item label="发送渠道" prop="channel">
          <el-radio-group v-model="form.channel">
            <el-radio
              v-for="ch in enabledChannels"
              :key="ch.value"
              :value="ch.value"
            >
              {{ ch.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="收件人选择">
          <el-radio-group v-model="recipientMode" @change="handleRecipientModeChange">
            <el-radio value="ids">指定会员ID</el-radio>
            <el-radio value="level">按会员等级</el-radio>
          </el-radio-group>
        </el-form-item>

        <template v-if="recipientMode === 'ids'">
          <el-form-item label="选择会员" prop="memberIds">
            <el-select
              v-model="form.memberIds"
              multiple
              filterable
              remote
              reserve-keyword
              placeholder="输入会员姓名或手机号搜索"
              :remote-method="searchMembers"
              :loading="memberLoading"
              style="width: 100%"
            >
              <el-option
                v-for="m in memberOptions"
                :key="m.id"
                :label="`${m.name} (${m.phone})`"
                :value="m.id"
              >
                <span style="float: left">{{ m.name }}</span>
                <span style="float: right; color: #8492a6; font-size: 13px">{{ m.phone }}</span>
              </el-option>
            </el-select>
            <div class="member-tip">
              <el-link type="primary" :underline="false" @click="showIdInput = !showIdInput">
                {{ showIdInput ? '收起手动输入' : '手动输入会员ID（逗号分隔）' }}
              </el-link>
            </div>
            <el-input
              v-if="showIdInput"
              v-model="manualMemberIds"
              placeholder="例如：1,2,3"
              @input="parseManualIds"
            />
          </el-form-item>
        </template>

        <template v-if="recipientMode === 'level'">
          <el-form-item label="会员等级" prop="memberLevel">
            <el-checkbox-group v-model="form.memberLevel">
              <el-checkbox value="NORMAL">普通会员</el-checkbox>
              <el-checkbox value="SILVER">白银会员</el-checkbox>
              <el-checkbox value="GOLD">黄金会员</el-checkbox>
              <el-checkbox value="PLATINUM">铂金会员</el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </template>

        <el-divider v-if="templateVariables.length > 0" />

        <template v-if="templateVariables.length > 0">
          <div class="section-title">变量填充</div>
          <el-row :gutter="16">
            <el-col :span="12" v-for="v in templateVariables" :key="v.name">
              <el-form-item :label="v.label || v.name">
                <el-input
                  v-model="form.variables[v.name]"
                  :placeholder="v.description || `请输入${v.label || v.name}`"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </template>

        <el-divider />

        <el-form-item label="发送时间">
          <el-radio-group v-model="timingMode">
            <el-radio value="immediate">立即发送</el-radio>
            <el-radio value="scheduled">定时发送</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item
          v-if="timingMode === 'scheduled'"
          label="定时时间"
          prop="scheduledAt"
        >
          <el-date-picker
            v-model="form.scheduledAt"
            type="datetime"
            placeholder="选择发送时间"
            style="width: 100%"
            :disabled-date="disabledPastDate"
          />
        </el-form-item>

        <el-divider />

        <div class="section-title">内容预览</div>
        <div class="preview-section">
          <div class="preview-label">标题：</div>
          <div class="preview-content preview-title">{{ previewResult.title || '-' }}</div>
          <div class="preview-label">内容：</div>
          <div class="preview-content preview-body">
            <pre>{{ previewResult.content || '-' }}</pre>
          </div>
        </div>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ timingMode === 'scheduled' ? '定时发送' : '立即发送' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { useTemplateStore } from '../stores/template';
import { useMemberStore } from '../stores/member';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  template: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['update:modelValue', 'success']);

const templateStore = useTemplateStore();
const memberStore = useMemberStore();

const formRef = ref(null);
const loading = ref(false);
const submitting = ref(false);
const memberLoading = ref(false);
const memberOptions = ref([]);
const recipientMode = ref('ids');
const timingMode = ref('immediate');
const showIdInput = ref(false);
const manualMemberIds = ref('');
const previewResult = reactive({ title: '', content: '', enabled: true });

const form = reactive({
  channel: '',
  memberIds: [],
  memberLevel: [],
  variables: {},
  scheduledAt: null
});

const rules = {
  channel: [{ required: true, message: '请选择发送渠道', trigger: 'change' }],
  memberIds: [
    {
      validator: (rule, value, callback) => {
        if (recipientMode.value === 'ids') {
          if (!value || value.length === 0) {
            callback(new Error('请选择或输入会员ID'));
          } else {
            callback();
          }
        } else {
          callback();
        }
      },
      trigger: 'change'
    }
  ],
  memberLevel: [
    {
      validator: (rule, value, callback) => {
        if (recipientMode.value === 'level') {
          if (!value || value.length === 0) {
            callback(new Error('请选择会员等级'));
          } else {
            callback();
          }
        } else {
          callback();
        }
      },
      trigger: 'change'
    }
  ],
  scheduledAt: [
    {
      validator: (rule, value, callback) => {
        if (timingMode.value === 'scheduled') {
          if (!value) {
            callback(new Error('请选择定时时间'));
          } else if (dayjs(value).isBefore(dayjs())) {
            callback(new Error('定时时间不能早于当前时间'));
          } else {
            callback();
          }
        } else {
          callback();
        }
      },
      trigger: 'change'
    }
  ]
};

const channelLabels = {
  SMS: '短信',
  EMAIL: '邮件',
  INAPP: '站内信'
};

const enabledChannels = computed(() => {
  const channels = props.template?.channels || [];
  return channels.map((c) => ({ value: c, label: channelLabels[c] || c }));
});

const templateVariables = computed(() => {
  const vars = props.template?.variables || [];
  if (Array.isArray(vars)) {
    return vars;
  }
  return [];
});

const handleRecipientModeChange = () => {
  form.memberIds = [];
  form.memberLevel = [];
  manualMemberIds.value = '';
};

const searchMembers = async (query) => {
  if (!query) {
    memberOptions.value = memberStore.members.slice(0, 50);
    return;
  }
  memberLoading.value = true;
  try {
    await memberStore.fetchMembers({ search: query, limit: 50 });
    memberOptions.value = memberStore.members;
  } finally {
    memberLoading.value = false;
  }
};

const parseManualIds = (val) => {
  if (!val) {
    form.memberIds = [];
    return;
  }
  const ids = val
    .split(/[,，\s]/)
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
  form.memberIds = [...new Set([...form.memberIds, ...ids])];
};

const disabledPastDate = (time) => {
  return time.getTime() < dayjs().startOf('day').valueOf();
};

const initVariables = () => {
  const vars = {};
  templateVariables.value.forEach((v) => {
    vars[v.name] = v.defaultValue !== undefined ? v.defaultValue : '';
  });
  form.variables = vars;
};

const updatePreview = async () => {
  if (!props.template?.currentVersion || !form.channel) {
    previewResult.title = '';
    previewResult.content = '';
    previewResult.enabled = true;
    return;
  }
  try {
    const result = await templateStore.previewTemplate({
      titleTemplate: props.template.currentVersion.titleTemplate,
      contentTemplate: props.template.currentVersion.contentTemplate,
      channelRules: props.template.currentVersion.channelRules,
      variables: form.variables,
      channel: form.channel
    });
    previewResult.title = result.title || '';
    previewResult.content = result.content || '';
    previewResult.enabled = result.enabled !== false;
  } catch (e) {
    previewResult.title = '预览失败';
    previewResult.content = e.message || '';
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      const data = {
        templateId: props.template.id,
        templateVersionId: props.template.currentVersionId,
        channel: form.channel,
        variables: form.variables
      };
      if (recipientMode.value === 'ids') {
        data.memberIds = form.memberIds;
      } else {
        data.memberLevel = form.memberLevel;
      }
      if (timingMode.value === 'scheduled' && form.scheduledAt) {
        data.scheduledAt = new Date(form.scheduledAt).toISOString();
      }
      await templateStore.sendNotification(data);
      ElMessage.success(timingMode.value === 'scheduled' ? '已加入定时发送队列' : '发送成功');
      emit('success');
      emit('update:modelValue', false);
    } finally {
      submitting.value = false;
    }
  });
};

const resetState = () => {
  form.channel = enabledChannels.value[0]?.value || '';
  form.memberIds = [];
  form.memberLevel = [];
  form.variables = {};
  form.scheduledAt = null;
  recipientMode.value = 'ids';
  timingMode.value = 'immediate';
  showIdInput.value = false;
  manualMemberIds.value = '';
  previewResult.title = '';
  previewResult.content = '';
  previewResult.enabled = true;
  if (formRef.value) {
    formRef.value.clearValidate();
  }
};

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      if (enabledChannels.value.length > 0) {
        form.channel = enabledChannels.value[0].value;
      }
      initVariables();
      if (memberStore.members.length === 0) {
        try {
          await memberStore.fetchMembers({ limit: 50 });
          memberOptions.value = memberStore.members;
        } catch (e) {
          // ignore
        }
      } else {
        memberOptions.value = memberStore.members;
      }
      updatePreview();
    }
  },
  { immediate: true }
);

watch(
  [() => form.channel, () => form.variables],
  () => {
    updatePreview();
  },
  { deep: true }
);
</script>

<style scoped>
.send-dialog {
  padding: 4px 0;
}

.version-info {
  margin-bottom: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 12px;
}

.member-tip {
  margin-top: 8px;
  font-size: 12px;
}

.preview-section {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
}

.preview-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
  font-weight: 500;
}

.preview-content {
  font-size: 14px;
  color: #1e293b;
  margin-bottom: 12px;
  line-height: 1.6;
}

.preview-title {
  font-weight: 600;
  font-size: 15px;
}

.preview-body {
  background: #fff;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.preview-body pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
</style>
