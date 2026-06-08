<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑模板' : '新建模板'"
    width="1200px"
    destroy-on-close
    @update:model-value="(val) => $emit('update:modelValue', val)"
    @close="handleClose"
    class="template-edit-dialog"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <el-row :gutter="20">
        <el-col :span="14">
          <el-tabs v-model="activeTab" class="main-tabs">
            <el-tab-pane label="基本信息" name="basic">
              <el-form-item label="模板名称" prop="name">
                <el-input v-model="form.name" placeholder="请输入模板名称" maxlength="200" show-word-limit />
              </el-form-item>
              <el-form-item label="模板分类" prop="category">
                <el-select v-model="form.category" placeholder="请选择分类" style="width: 100%">
                  <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="适用渠道" prop="channels">
                <el-checkbox-group v-model="form.channels">
                  <el-checkbox value="SMS">短信</el-checkbox>
                  <el-checkbox value="EMAIL">邮件</el-checkbox>
                  <el-checkbox value="INAPP">站内信</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
              <el-divider content-position="left">变量管理</el-divider>
              <div class="variables-section">
                <div class="variables-header">
                  <span class="section-label">自定义变量</span>
                  <el-button type="primary" size="small" @click="addVariable">
                    <el-icon><Plus /></el-icon>
                    添加变量
                  </el-button>
                </div>
                <el-table :data="form.variables" size="small" border stripe max-height="240" class="variables-table">
                  <el-table-column label="变量名" min-width="140">
                    <template #default="{ row }">
                      <el-input v-model="row.name" size="small" placeholder="例如: userName" />
                    </template>
                  </el-table-column>
                  <el-table-column label="显示标签" min-width="140">
                    <template #default="{ row }">
                      <el-input v-model="row.label" size="small" placeholder="例如: 用户姓名" />
                    </template>
                  </el-table-column>
                  <el-table-column label="变量类型" width="140">
                    <template #default="{ row }">
                      <el-select v-model="row.type" size="small" style="width: 100%">
                        <el-option label="字符串" value="string" />
                        <el-option label="数字" value="number" />
                        <el-option label="日期" value="date" />
                        <el-option label="布尔" value="boolean" />
                      </el-select>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="70" align="center">
                    <template #default="{ $index }">
                      <el-button link type="danger" size="small" @click="removeVariable($index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-if="store.defaultVariables.length > 0" class="default-variables">
                  <div class="section-label muted">系统默认变量（可直接使用）</div>
                  <div class="default-vars-list">
                    <el-tag
                      v-for="v in store.defaultVariables"
                      :key="v.name"
                      type="info"
                      size="small"
                      class="default-var-tag"
                      effect="plain"
                    >
                      <span class="var-name">{{ v.name }}</span>
                      <span class="var-label">({{ v.label }})</span>
                    </el-tag>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="内容编辑" name="content">
              <el-form-item label="标题模板" prop="titleTemplate">
                <el-input
                  v-model="form.titleTemplate"
                  placeholder="请输入标题模板，例如：尊敬的{userName}，您好！"
                  ref="titleInputRef"
                  @click="updateCursor('title')"
                  @keyup="updateCursor('title')"
                />
              </el-form-item>
              <el-form-item label="内容模板" prop="contentTemplate">
                <el-input
                  v-model="form.contentTemplate"
                  type="textarea"
                  :rows="10"
                  placeholder="请输入内容模板，支持变量和条件语法"
                  ref="contentInputRef"
                  @click="updateCursor('content')"
                  @keyup="updateCursor('content')"
                />
              </el-form-item>
              <el-divider content-position="left">插入助手</el-divider>
              <div class="insert-assistant">
                <div class="assistant-section">
                  <span class="section-label">可用变量（点击插入）</span>
                  <div class="var-chips">
                    <el-tag
                      v-for="v in allVariables"
                      :key="v.name"
                      class="var-chip"
                      effect="light"
                      @click="insertVariable(v.name)"
                      style="cursor: pointer"
                    >
                      {{ '{' + v.name + '}' }}
                      <span class="chip-label">{{ v.label }}</span>
                    </el-tag>
                    <span v-if="allVariables.length === 0" class="muted">暂无变量</span>
                  </div>
                </div>
                <div class="assistant-section">
                  <span class="section-label">条件片段</span>
                  <div class="condition-buttons">
                    <el-button size="small" @click="insertCondition('if')">
                      插入 <span v-pre>{{if}}</span> 条件
                    </el-button>
                    <el-button size="small" @click="insertCondition('switch')">
                      插入 <span v-pre>{{switch}}</span> 分支
                    </el-button>
                  </div>
                </div>
                <el-collapse class="syntax-help">
                  <el-collapse-item title="语法帮助" name="syntax">
                    <div class="syntax-content" v-pre>
                      <h5>变量替换</h5>
                      <p>使用 <code>{变量名}</code> 格式插入变量，例如：</p>
                      <pre>尊敬的{userName}，您当前有{points}积分。</pre>

                      <h5>条件判断 - if</h5>
                      <p>使用 <code>{{if 条件}}...{{/if}}</code> 格式，例如：</p>
                      <pre>{{if level=="GOLD"}}
尊敬的黄金会员，专享8折优惠！
{{/if}}</pre>

                      <h5>多分支 - switch</h5>
                      <p>使用 <code>{{switch 变量}}{{case 值}}...{{default}}...{{/switch}}</code> 格式，例如：</p>
                      <pre>{{switch level}}
{{case NORMAL}}普通会员{{/case}}
{{case SILVER}}白银会员{{/case}}
{{case GOLD}}黄金会员{{/case}}
{{default}}尊贵会员{{/default}}
{{/switch}}</pre>

                      <h5>比较运算符</h5>
                      <p>支持 <code>==</code>、<code>!=</code>、<code>></code>、<code><</code>、<code>>=</code>、<code><=</code></p>

                      <h5>逻辑运算符</h5>
                      <p>支持 <code>&&</code>（与）、<code>||</code>（或）、<code>!</code>（非）</p>
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </el-tab-pane>

            <el-tab-pane label="渠道配置" name="channel">
              <div class="channel-config">
                <div v-for="channel in channelList" :key="channel.value" class="channel-item">
                  <div class="channel-header">
                    <el-switch
                      v-model="form.channelRules[channel.value].enabled"
                      :active-text="channel.label + '渠道'"
                    />
                  </div>
                  <div v-if="form.channelRules[channel.value].enabled" class="channel-body">
                    <el-form-item label="覆盖标题">
                      <el-input
                        v-model="form.channelRules[channel.value].titleTemplate"
                        placeholder="留空则使用默认标题模板"
                        clearable
                      />
                    </el-form-item>
                    <el-form-item label="覆盖内容">
                      <el-input
                        v-model="form.channelRules[channel.value].contentTemplate"
                        type="textarea"
                        :rows="4"
                        placeholder="留空则使用默认内容模板"
                        clearable
                      />
                    </el-form-item>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-col>

        <el-col :span="10">
          <div class="preview-panel">
            <div class="preview-header">
              <span class="preview-title">实时预览</span>
              <el-button size="small" @click="refreshPreview" :loading="previewLoading">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
            <div v-loading="previewLoading" class="preview-content">
              <el-empty v-if="!hasPreviewData" description="填写模板内容后自动预览" :image-size="80" />
              <template v-else>
                <div v-for="channel in form.channels" :key="channel" class="channel-preview">
                  <div class="channel-preview-header">
                    <el-tag :type="getChannelTagType(channel)" size="small">
                      {{ getChannelLabel(channel) }}
                    </el-tag>
                    <span v-if="form.channelRules[channel]?.titleTemplate || form.channelRules[channel]?.contentTemplate" class="override-badge">
                      已覆盖
                    </span>
                  </div>
                  <div class="preview-box" :class="channel.toLowerCase()">
                    <div v-if="previewData[channel]" class="preview-rendered">
                      <div class="preview-title-line" v-if="previewData[channel].title">
                        <span class="preview-label">标题：</span>
                        <span>{{ previewData[channel].title }}</span>
                      </div>
                      <div class="preview-content-line">
                        <span class="preview-label">内容：</span>
                        <div class="preview-text">{{ previewData[channel].content }}</div>
                      </div>
                    </div>
                    <el-result
                      v-else-if="previewErrors[channel]"
                      icon="error"
                      :title="'渲染失败'"
                      :sub-title="previewErrors[channel]"
                      size="small"
                    />
                    <el-skeleton v-else :rows="3" animated />
                  </div>
                </div>
              </template>
            </div>
            <div class="preview-sample">
              <span class="muted small">预览使用示例数据：</span>
              <el-tag size="small" type="info" effect="plain">GOLD 等级会员</el-tag>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useTemplateStore } from '../stores/template';
import { ElMessage } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  template: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'success']);

const store = useTemplateStore();
const formRef = ref(null);
const titleInputRef = ref(null);
const contentInputRef = ref(null);
const activeTab = ref('basic');
const submitting = ref(false);
const previewLoading = ref(false);
const previewData = ref({});
const previewErrors = ref({});
const lastCursorTarget = ref('content');

const isEdit = computed(() => !!props.template?.id);

const categoryOptions = [
  { value: 'SYSTEM', label: '系统通知' },
  { value: 'BIRTHDAY', label: '生日祝福' },
  { value: 'POINTS_EXPIRY', label: '积分到期' },
  { value: 'CAMPAIGN', label: '营销活动' },
  { value: 'TICKET', label: '工单通知' },
  { value: 'OTHER', label: '其他' },
];

const channelList = [
  { value: 'SMS', label: '短信' },
  { value: 'EMAIL', label: '邮件' },
  { value: 'INAPP', label: '站内信' },
];

const form = reactive({
  name: '',
  category: 'OTHER',
  channels: [],
  variables: [],
  titleTemplate: '',
  contentTemplate: '',
  channelRules: {
    SMS: { enabled: false, titleTemplate: '', contentTemplate: '' },
    EMAIL: { enabled: false, titleTemplate: '', contentTemplate: '' },
    INAPP: { enabled: false, titleTemplate: '', contentTemplate: '' },
  },
});

const rules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择模板分类', trigger: 'change' }],
  channels: [
    {
      type: 'array',
      required: true,
      message: '请至少选择一个渠道',
      trigger: 'change',
      validator: (rule, value, callback) => {
        if (!value || value.length === 0) {
          callback(new Error('请至少选择一个渠道'));
        } else {
          callback();
        }
      },
    },
  ],
  titleTemplate: [{ required: true, message: '请输入标题模板', trigger: 'blur' }],
  contentTemplate: [{ required: true, message: '请输入内容模板', trigger: 'blur' }],
};

const allVariables = computed(() => {
  return [...(store.defaultVariables || []), ...form.variables];
});

const hasPreviewData = computed(() => {
  return form.channels.length > 0 && Object.keys(previewData.value).length > 0;
});

const getChannelLabel = (c) => channelList.find((o) => o.value === c)?.label || c;
const getChannelTagType = (c) => {
  const map = { SMS: 'success', EMAIL: 'primary', INAPP: 'warning' };
  return map[c] || 'info';
};

const addVariable = () => {
  form.variables.push({ name: '', label: '', type: 'string' });
};

const removeVariable = (index) => {
  form.variables.splice(index, 1);
};

const updateCursor = (target) => {
  lastCursorTarget.value = target;
};

const insertVariable = (varName) => {
  const text = `{${varName}}`;
  insertAtCursor(text);
};

const insertCondition = (type) => {
  let text = '';
  if (type === 'if') {
    text = '{{if level=="GOLD"}}\n黄金会员专属内容\n{{/if}}';
  } else if (type === 'switch') {
    text = '{{switch level}}\n{{case GOLD}}黄金会员内容{{/case}}\n{{case SILVER}}白银会员内容{{/case}}\n{{default}}普通会员内容{{/default}}\n{{/switch}}';
  }
  insertAtCursor(text);
};

const insertAtCursor = (text) => {
  const target = lastCursorTarget.value;
  const inputRef = target === 'title' ? titleInputRef.value : contentInputRef.value;
  const modelKey = target === 'title' ? 'titleTemplate' : 'contentTemplate';

  if (inputRef && inputRef.textareaRef) {
    const textarea = inputRef.textareaRef;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = form[modelKey] || '';
    form[modelKey] = content.substring(0, start) + text + content.substring(end);
    const newPos = start + text.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  } else if (inputRef && inputRef.input) {
    const input = inputRef.input;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const content = form[modelKey] || '';
    form[modelKey] = content.substring(0, start) + text + content.substring(end);
    const newPos = start + text.length;
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newPos, newPos);
    }, 0);
  } else {
    form[modelKey] = (form[modelKey] || '') + text;
  }
};

let previewTimer = null;
const debouncedPreview = () => {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    refreshPreview();
  }, 500);
};

const refreshPreview = async () => {
  if (!form.titleTemplate && !form.contentTemplate) {
    previewData.value = {};
    previewErrors.value = {};
    return;
  }
  if (form.channels.length === 0) {
    previewData.value = {};
    previewErrors.value = {};
    return;
  }

  previewLoading.value = true;
  previewData.value = {};
  previewErrors.value = {};

  const sampleVars = {};
  allVariables.value.forEach((v) => {
    if (v.type === 'NUMBER') {
      sampleVars[v.name] = 100;
    } else if (v.type === 'DATE') {
      sampleVars[v.name] = '2026-06-08';
    } else if (v.type === 'BOOLEAN') {
      sampleVars[v.name] = true;
    } else {
      const samples = {
        userName: '张三',
        name: '张三',
        level: 'GOLD',
        points: 2580,
        phone: '13800138000',
        email: 'zhangsan@example.com',
      };
      sampleVars[v.name] = samples[v.name] || `示例${v.label || v.name}`;
    }
  });

  try {
    for (const channel of form.channels) {
      const rule = form.channelRules[channel] || {};
      const previewPayload = {
        channel,
        titleTemplate: rule.titleTemplate || form.titleTemplate,
        contentTemplate: rule.contentTemplate || form.contentTemplate,
        variables: sampleVars,
      };
      try {
        const result = await store.previewTemplate(previewPayload);
        previewData.value[channel] = result;
      } catch (e) {
        previewErrors.value[channel] = e?.response?.data?.message || e.message || '渲染失败';
      }
    }
  } finally {
    previewLoading.value = false;
  }
};

watch(
  () => [form.titleTemplate, form.contentTemplate, form.channels, JSON.stringify(form.channelRules), JSON.stringify(form.variables)],
  () => {
    debouncedPreview();
  },
  { deep: true }
);

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      initForm();
      store.fetchDefaultVariables();
    }
  }
);

const initForm = () => {
  form.name = '';
  form.category = 'OTHER';
  form.channels = [];
  form.variables = [];
  form.titleTemplate = '';
  form.contentTemplate = '';
  form.channelRules = {
    SMS: { enabled: false, titleTemplate: '', contentTemplate: '' },
    EMAIL: { enabled: false, titleTemplate: '', contentTemplate: '' },
    INAPP: { enabled: false, titleTemplate: '', contentTemplate: '' },
  };
  previewData.value = {};
  previewErrors.value = {};
  activeTab.value = 'basic';

  if (props.template) {
    const t = props.template;
    form.name = t.name || '';
    form.category = t.category || 'OTHER';
    form.channels = t.channels ? [...t.channels] : [];
    form.variables = t.variables ? JSON.parse(JSON.stringify(t.variables)) : [];

    const version = t.currentVersion || {};
    form.titleTemplate = version.titleTemplate || '';
    form.contentTemplate = version.contentTemplate || '';

    const channelRules = version.channelRules ? JSON.parse(JSON.stringify(version.channelRules)) : {};
    for (const ch of ['SMS', 'EMAIL', 'INAPP']) {
      if (channelRules[ch]) {
        form.channelRules[ch] = {
          enabled: !!channelRules[ch].enabled !== false,
          titleTemplate: channelRules[ch].titleTemplate || channelRules[ch].overrideTitle || '',
          contentTemplate: channelRules[ch].contentTemplate || channelRules[ch].overrideContent || '',
        };
      }
      if (form.channels.includes(ch)) {
        form.channelRules[ch].enabled = true;
      }
    }
  }
};

const handleClose = () => {
  emit('update:modelValue', false);
  if (formRef.value) {
    formRef.value.clearValidate();
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    if (!form.channels || form.channels.length === 0) {
      ElMessage.warning('请至少选择一个渠道');
      return;
    }

    submitting.value = true;
    try {
      const channelRules = {};
      for (const ch of form.channels) {
        const rule = form.channelRules[ch] || {};
        channelRules[ch] = {
          enabled: true,
          titleTemplate: rule.titleTemplate || null,
          contentTemplate: rule.contentTemplate || null,
        };
      }

      const data = {
        name: form.name,
        category: form.category,
        channels: form.channels,
        variables: form.variables,
        titleTemplate: form.titleTemplate,
        contentTemplate: form.contentTemplate,
        channelRules,
      };

      if (isEdit.value) {
        await store.updateTemplate(props.template.id, data);
        ElMessage.success('模板已更新');
      } else {
        await store.createTemplate(data);
        ElMessage.success('模板已创建');
      }

      emit('success');
      emit('update:modelValue', false);
    } finally {
      submitting.value = false;
    }
  });
};

onMounted(() => {
  store.fetchDefaultVariables();
});
</script>

<style scoped>
.template-edit-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.main-tabs {
  margin-top: 8px;
}

.variables-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.variables-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.section-label.muted {
  font-weight: 500;
  color: #94a3b8;
}

.variables-table {
  margin-top: 4px;
}

.default-variables {
  margin-top: 4px;
}

.default-vars-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.default-var-tag {
  font-family: monospace;
}

.default-var-tag .var-name {
  font-weight: 600;
}

.default-var-tag .var-label {
  color: #94a3b8;
  margin-left: 2px;
}

.muted {
  color: #94a3b8;
}

.insert-assistant {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.assistant-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.var-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.var-chip {
  font-family: monospace;
  user-select: none;
}

.var-chip .chip-label {
  color: #64748b;
  font-family: system-ui;
  font-size: 12px;
  margin-left: 4px;
}

.condition-buttons {
  display: flex;
  gap: 8px;
}

.syntax-help {
  margin-top: 4px;
}

.syntax-content h5 {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.syntax-content h5:first-child {
  margin-top: 0;
}

.syntax-content p {
  margin: 0 0 6px;
  color: #475569;
  font-size: 13px;
}

.syntax-content code {
  background-color: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #be123c;
}

.syntax-content pre {
  background-color: #f8fafc;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #334155;
  overflow-x: auto;
  margin: 0;
  border: 1px solid #e2e8f0;
}

.channel-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.channel-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 16px;
  background-color: #fafafa;
}

.channel-header {
  margin-bottom: 8px;
}

.channel-body {
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

.preview-panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f8fafc;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #fff;
  border-radius: 8px 8px 0 0;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.preview-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.channel-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.channel-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.override-badge {
  font-size: 11px;
  color: #f59e0b;
  background-color: #fef3c7;
  padding: 1px 6px;
  border-radius: 4px;
}

.preview-box {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.preview-box.sms {
  border-left: 4px solid #10b981;
  max-width: 320px;
}

.preview-box.email {
  border-left: 4px solid #3b82f6;
}

.preview-box.inapp {
  border-left: 4px solid #f59e0b;
}

.preview-rendered {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-title-line,
.preview-content-line {
  display: flex;
  gap: 4px;
  font-size: 13px;
}

.preview-label {
  color: #94a3b8;
  flex-shrink: 0;
}

.preview-title-line :not(.preview-label) {
  font-weight: 600;
  color: #1e293b;
}

.preview-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  color: #334155;
  flex: 1;
}

.preview-sample {
  padding: 8px 16px;
  border-top: 1px solid #e2e8f0;
  background-color: #fff;
  border-radius: 0 0 8px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.small {
  font-size: 12px;
}
</style>
