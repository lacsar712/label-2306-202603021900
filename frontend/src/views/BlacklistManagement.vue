<template>
  <div class="blacklist-management">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">黑名单管理</h2>
        <p class="page-subtitle">管理黑名单会员、审批列入/解除申请、查看拦截审计日志</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showAddDialog = true">
          <el-icon class="mr-4"><Plus /></el-icon>列入黑名单
        </el-button>
        <el-button type="warning" plain @click="showBatchDialog = true">批量列入</el-button>
        <el-button type="success" plain @click="showImportDialog = true">导入CSV</el-button>
        <el-button @click="handleExport">导出CSV</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="mb-24">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">生效中</div>
            <div class="stat-value text-danger">{{ stats?.active || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">待审批</div>
            <div class="stat-value text-warning">{{ stats?.pendingApproval || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">平均黑名单时长</div>
            <div class="stat-value text-primary">{{ stats?.avgDurationDays || 0 }} 天</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card
          shadow="never"
          class="stat-card stat-card-clickable"
          :class="{ 'stat-card-empty': !stats?.repeatOffenders }"
          @click="stats?.repeatOffenders > 0 && (showRepeatDialog = true)"
        >
          <div class="stat-content">
            <div class="stat-label">
              重复列入会员
              <el-icon v-if="stats?.repeatOffenders > 0" class="stat-arrow"><ArrowRight /></el-icon>
            </div>
            <div class="stat-value text-info">{{ stats?.repeatOffenders || 0 }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" class="blacklist-tabs">
      <el-tab-pane label="黑名单记录" name="list">
        <el-card class="filter-card mb-24" shadow="never">
          <div class="filter-header">
            <div class="search-group">
              <el-input
                v-model="search"
                placeholder="搜索手机号、姓名或原因"
                class="search-input"
                clearable
                @clear="handleSearch"
                @keyup.enter="handleSearch"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-select v-model="filterStatus" placeholder="状态" clearable @change="handleSearch" class="status-select">
                <el-option label="待审批" value="PENDING_APPROVAL" />
                <el-option label="已生效" value="ACTIVE" />
                <el-option label="已解除" value="RELEASED" />
                <el-option label="已驳回" value="REJECTED" />
              </el-select>
              <el-select v-model="filterCategory" placeholder="原因分类" clearable @change="handleSearch" class="category-select">
                <el-option label="欺诈" value="FRAUD" />
                <el-option label="恶意投诉" value="MALICIOUS_COMPLAINT" />
                <el-option label="违规兑换" value="VIOLATION_EXCHANGE" />
                <el-option label="滥用行为" value="ABUSIVE_BEHAVIOR" />
                <el-option label="其他" value="OTHER" />
              </el-select>
              <el-date-picker
                v-model="dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                @change="handleSearch"
                class="date-range"
              />
              <el-button type="primary" plain @click="handleSearch">搜索</el-button>
            </div>
          </div>
        </el-card>

        <el-card class="table-card" shadow="never">
          <div class="table-toolbar">
            <div class="selected-info" v-if="selectedIds.length > 0">
              已选择 {{ selectedIds.length }} 项
              <el-button v-if="authStore.isAdmin" type="danger" size="small" @click="handleBatchRelease">
                批量解除
              </el-button>
              <el-button size="small" @click="clearSelection">取消选择</el-button>
            </div>
          </div>
          <el-table
            v-loading="blacklistStore.loading"
            :data="blacklistStore.list"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
            row-class-name="blacklist-row"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="50" />
            <el-table-column prop="memberName" label="姓名" min-width="100">
              <template #default="{ row }">
                <span>{{ row.memberName || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="phone" label="手机号" min-width="120" />
            <el-table-column prop="category" label="原因分类" min-width="120">
              <template #default="{ row }">
                <el-tag :type="getCategoryTagType(row.category)">{{ getCategoryLabel(row.category) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="列入原因" min-width="160" show-overflow-tooltip />
            <el-table-column prop="status" label="状态" min-width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="列入时间" min-width="160">
              <template #default="{ row }">
                {{ formatDate(row.addedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作人" min-width="100">
              <template #default="{ row }">
                {{ row.addedByUser?.username || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="预计解除" min-width="160">
              <template #default="{ row }">
                {{ row.expectedReleaseAt ? formatDate(row.expectedReleaseAt) : '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="280">
              <template #default="{ row }">
                <template v-if="row.status === 'PENDING_APPROVAL' && authStore.isAdmin">
                  <el-button link type="success" @click="handleApprove(row)">审批通过</el-button>
                  <el-button link type="danger" @click="handleReject(row)">驳回</el-button>
                </template>
                <template v-if="row.status === 'ACTIVE' && authStore.isAdmin">
                  <el-button link type="success" @click="handleRelease(row)">解除</el-button>
                </template>
                <el-button link @click="handleViewEvidence(row)" v-if="row.evidence">证据</el-button>
                <el-button link type="primary" @click="handleViewAudit(row)">拦截记录</el-button>
                <el-popconfirm
                  v-if="row.status !== 'ACTIVE'"
                  title="确定删除该记录吗？"
                  @confirm="handleDelete(row.id)"
                >
                  <template #reference>
                    <el-button link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :total="blacklistStore.total"
              :current-page="blacklistStore.page"
              :page-size="blacklistStore.pageSize"
              :page-sizes="[10, 20, 50, 100]"
              @size-change="handleSizeChange"
              @current-change="handlePageChange"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="拦截审计日志" name="audit">
        <el-card class="filter-card mb-24" shadow="never">
          <div class="filter-header">
            <div class="search-group">
              <el-input
                v-model="auditFilter.phone"
                placeholder="搜索手机号"
                class="search-input"
                clearable
                @keyup.enter="handleSearchAudit"
              />
              <el-select v-model="auditFilter.actionType" placeholder="拦截场景" clearable class="status-select">
                <el-option label="积分调整" value="POINTS_ADJUST" />
                <el-option label="签到" value="SIGNIN" />
                <el-option label="商城兑换" value="EXCHANGE" />
                <el-option label="优惠券" value="COUPON" />
                <el-option label="活动参与" value="CAMPAIGN" />
              </el-select>
              <el-button type="primary" plain @click="handleSearchAudit">搜索</el-button>
            </div>
          </div>
        </el-card>

        <el-card class="table-card" shadow="never">
          <el-table
            :data="blacklistStore.auditLogs"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
          >
            <el-table-column prop="phone" label="手机号" min-width="120" />
            <el-table-column prop="memberId" label="会员ID" min-width="100">
              <template #default="{ row }">
                <span>{{ row.memberId || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="actionType" label="拦截场景" min-width="120">
              <template #default="{ row }">
                <el-tag type="warning" effect="plain">{{ getActionLabel(row.actionType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="actionDetail" label="操作详情" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作人" min-width="100">
              <template #default="{ row }">
                {{ row.operator?.username || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="拦截时间" min-width="160">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="原因分类占比" name="stats">
        <el-card shadow="never">
          <div class="stats-container">
            <div v-if="stats?.categoryStats?.length" class="category-stats">
              <div v-for="cat in stats.categoryStats" :key="cat.category" class="category-stat-item">
                <div class="category-row">
                  <el-tag :type="getCategoryTagType(cat.category)" size="large">
                    {{ getCategoryLabel(cat.category) }}
                  </el-tag>
                  <span class="category-count">{{ cat.count }} 条</span>
                  <span class="category-percentage">{{ cat.percentage }}%</span>
                </div>
                <el-progress :percentage="parseFloat(cat.percentage)" :color="getProgressColor(cat.category)" />
              </div>
            </div>
            <el-empty v-else description="暂无数据" />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="系统设置" name="config" v-if="authStore.isAdmin">
        <el-card shadow="never">
          <el-form :model="configForm" label-width="200px" class="config-form">
            <el-form-item label="启用到期自动解除">
              <el-switch v-model="configForm.autoReleaseEnabled" />
              <div class="form-tip">开启后，系统将在每天凌晨自动解除到期的黑名单记录</div>
            </el-form-item>
            <el-form-item label="自动解除时恢复会员状态">
              <el-switch v-model="configForm.restoreOnAutoRelease" />
              <div class="form-tip">开启后，解除黑名单时将自动将会员状态从停用恢复为活跃</div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="configSaving" @click="saveConfig">保存设置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="showAddDialog"
      title="列入黑名单"
      width="520px"
      destroy-on-close
      @closed="resetAddForm"
    >
      <el-form :model="addForm" :rules="addRules" ref="addFormRef" label-position="top">
        <el-form-item label="会员手机号" prop="phone">
          <el-input v-model="addForm.phone" placeholder="请输入会员手机号" @blur="handlePhoneBlur" />
        </el-form-item>
        <el-form-item v-if="addForm.memberName" label="匹配会员">
          <el-tag type="success" effect="plain">{{ addForm.memberName }}</el-tag>
        </el-form-item>
        <el-form-item label="原因分类" prop="category">
          <el-select v-model="addForm.category" class="w-full">
            <el-option label="欺诈" value="FRAUD" />
            <el-option label="恶意投诉" value="MALICIOUS_COMPLAINT" />
            <el-option label="违规兑换" value="VIOLATION_EXCHANGE" />
            <el-option label="滥用行为" value="ABUSIVE_BEHAVIOR" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="列入原因" prop="reason">
          <el-input v-model="addForm.reason" type="textarea" :rows="3" placeholder="请详细说明列入原因" />
        </el-form-item>
        <el-form-item label="证据备注">
          <el-input v-model="addForm.evidence" type="textarea" :rows="2" placeholder="可附加证据截图说明、订单号等（选填）" />
        </el-form-item>
        <el-form-item label="预计解除时间">
          <el-date-picker
            v-model="addForm.expectedReleaseAt"
            type="datetime"
            placeholder="选择预计解除时间，不选则永久有效"
            class="w-full"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="解除时恢复会员状态">
          <el-switch v-model="addForm.restoreOnRelease" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAddForm">
          {{ authStore.isAdmin ? '直接列入' : '提交审批' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showBatchDialog"
      title="批量列入黑名单"
      width="560px"
      destroy-on-close
      @closed="resetBatchForm"
    >
      <el-form :model="batchForm" :rules="batchRules" ref="batchFormRef" label-position="top">
        <el-form-item label="手机号列表（每行一个）" prop="phones">
          <el-input
            v-model="batchForm.phones"
            type="textarea"
            :rows="6"
            placeholder="每行一个手机号，例如：&#10;13800138000&#10;13900139000"
          />
        </el-form-item>
        <el-form-item label="原因分类" prop="category">
          <el-select v-model="batchForm.category" class="w-full">
            <el-option label="欺诈" value="FRAUD" />
            <el-option label="恶意投诉" value="MALICIOUS_COMPLAINT" />
            <el-option label="违规兑换" value="VIOLATION_EXCHANGE" />
            <el-option label="滥用行为" value="ABUSIVE_BEHAVIOR" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="列入原因" prop="reason">
          <el-input v-model="batchForm.reason" type="textarea" :rows="2" placeholder="请说明列入原因" />
        </el-form-item>
        <el-form-item label="预计解除时间">
          <el-date-picker
            v-model="batchForm.expectedReleaseAt"
            type="datetime"
            placeholder="选择预计解除时间（选填）"
            class="w-full"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatchDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitBatchForm">
          {{ authStore.isAdmin ? '批量列入' : '提交审批' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showImportDialog"
      title="CSV导入黑名单"
      width="560px"
      destroy-on-close
    >
      <el-alert
        type="info"
        :closable="false"
        class="mb-16"
      >
        <template #title>
          CSV格式说明：第一行为表头，支持列名：手机号/phone、姓名/name、原因分类/category、列入原因/reason、证据备注/evidence、预计解除时间/expectedReleaseAt
        </template>
      </el-alert>
      <el-upload
        ref="uploadRef"
        class="upload-area"
        drag
        :auto-upload="false"
        :on-change="handleFileChange"
        accept=".csv"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将CSV文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">仅支持 CSV 格式文件</div>
        </template>
      </el-upload>
      <el-divider v-if="parsedRecords.length > 0">预览数据（前10条）</el-divider>
      <el-table v-if="parsedRecords.length > 0" :data="parsedRecords.slice(0, 10)" size="small" border>
        <el-table-column prop="phone" label="手机号" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="category" label="原因分类" />
        <el-table-column prop="reason" label="原因" show-overflow-tooltip />
      </el-table>
      <div v-if="parsedRecords.length > 0" class="mt-12 text-muted">
        共解析到 {{ parsedRecords.length }} 条记录
      </div>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="parsedRecords.length === 0" @click="submitImport">
          确认导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showReleaseDialog"
      title="解除黑名单"
      width="480px"
      destroy-on-close
    >
      <el-form :model="releaseForm" :rules="releaseRules" ref="releaseFormRef" label-position="top">
        <el-form-item label="解除原因" prop="releaseReason">
          <el-input v-model="releaseForm.releaseReason" type="textarea" :rows="3" placeholder="请说明解除原因" />
        </el-form-item>
        <el-form-item label="恢复会员状态">
          <el-switch v-model="releaseForm.restoreOnRelease" />
          <div class="form-tip">将会员状态从停用恢复为活跃</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReleaseDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReleaseForm">确认解除</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showRejectDialog"
      title="驳回列入申请"
      width="480px"
      destroy-on-close
    >
      <el-form :model="rejectForm" :rules="rejectRules" ref="rejectFormRef" label-position="top">
        <el-form-item label="驳回原因" prop="rejectReason">
          <el-input v-model="rejectForm.rejectReason" type="textarea" :rows="3" placeholder="请说明驳回原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRejectDialog = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="submitRejectForm">确认驳回</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showEvidenceDialog"
      title="证据备注"
      width="480px"
      destroy-on-close
    >
      <div class="evidence-content">{{ currentEvidence }}</div>
    </el-dialog>

    <el-dialog
      v-model="showAuditDialog"
      title="拦截记录"
      width="720px"
      destroy-on-close
    >
      <el-table
        :data="currentAuditLogs"
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
      >
        <el-table-column prop="actionType" label="拦截场景" min-width="120">
          <template #default="{ row }">
            <el-tag type="warning" effect="plain">{{ getActionLabel(row.actionType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="actionDetail" label="操作详情" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作人" min-width="100">
          <template #default="{ row }">
            {{ row.operator?.username || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="拦截时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="currentAuditLogs.length === 0" description="暂无拦截记录" />
    </el-dialog>

    <el-dialog
      v-model="showRepeatDialog"
      title="重复列入会员明细"
      width="900px"
      destroy-on-close
    >
      <div v-if="stats?.repeatOffenderList?.length" class="repeat-tip">
        共 <b>{{ stats.repeatOffenderList.length }}</b> 位会员被多次列入黑名单（按列入次数降序）
      </div>
      <el-table
        v-if="stats?.repeatOffenderList?.length"
        :data="stats.repeatOffenderList"
        style="width: 100%"
        :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
        row-key="key"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-wrapper">
              <div class="expand-title">列入记录明细（共 {{ row.records.length }} 次）</div>
              <el-table
                :data="row.records"
                size="small"
                :header-cell-style="{ background: '#f1f5f9', color: '#64748b' }"
              >
                <el-table-column prop="category" label="原因分类" min-width="110">
                  <template #default="{ row: r }">
                    <el-tag :type="getCategoryTagType(r.category)" size="small">{{ getCategoryLabel(r.category) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="reason" label="列入原因" min-width="180" show-overflow-tooltip />
                <el-table-column label="列入时间" min-width="150">
                  <template #default="{ row: r }">
                    {{ formatDate(r.addedAt) }}
                  </template>
                </el-table-column>
                <el-table-column label="解除时间" min-width="150">
                  <template #default="{ row: r }">
                    {{ r.releasedAt ? formatDate(r.releasedAt) : '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="预计解除" min-width="150">
                  <template #default="{ row: r }">
                    {{ r.expectedReleaseAt ? formatDate(r.expectedReleaseAt) : '-' }}
                  </template>
                </el-table-column>
                <el-table-column prop="status" label="状态" min-width="90">
                  <template #default="{ row: r }">
                    <el-tag :type="getStatusTagType(r.status)" size="small">{{ getStatusLabel(r.status) }}</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="memberName" label="姓名" min-width="100">
          <template #default="{ row }">
            <span>{{ row.memberName || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" min-width="130" />
        <el-table-column label="列入次数" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag type="danger" effect="dark" round>{{ row.count }} 次</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近列入" min-width="160">
          <template #default="{ row }">
            {{ row.lastAddedAt ? formatDate(row.lastAddedAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="当前状态" min-width="110" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.currentActive" type="danger" effect="plain">仍在黑名单</el-tag>
            <el-tag v-else type="success" effect="plain">已解除</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无重复列入会员" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useBlacklistStore } from '../stores/blacklist';
import { useAuthStore } from '../stores/auth';
import { useMemberStore } from '../stores/member';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, UploadFilled, ArrowRight } from '@element-plus/icons-vue';

const blacklistStore = useBlacklistStore();
const authStore = useAuthStore();
const memberStore = useMemberStore();

const activeTab = ref('list');
const search = ref('');
const filterStatus = ref('');
const filterCategory = ref('');
const dateRange = ref([]);
const selectedIds = ref([]);
const submitting = ref(false);
const configSaving = ref(false);

const stats = computed(() => blacklistStore.stats);

const showAddDialog = ref(false);
const showBatchDialog = ref(false);
const showImportDialog = ref(false);
const showReleaseDialog = ref(false);
const showRejectDialog = ref(false);
const showEvidenceDialog = ref(false);
const showAuditDialog = ref(false);
const showRepeatDialog = ref(false);

const addFormRef = ref(null);
const batchFormRef = ref(null);
const releaseFormRef = ref(null);
const rejectFormRef = ref(null);
const uploadRef = ref(null);

const currentRow = ref(null);
const currentEvidence = ref('');
const currentAuditLogs = ref([]);
const parsedRecords = ref([]);

const auditFilter = reactive({
  phone: '',
  actionType: '',
});

const configForm = reactive({
  autoReleaseEnabled: true,
  restoreOnAutoRelease: true,
});

const addForm = reactive({
  memberId: null,
  phone: '',
  memberName: '',
  category: '',
  reason: '',
  evidence: '',
  expectedReleaseAt: '',
  restoreOnRelease: true,
});

const batchForm = reactive({
  phones: '',
  category: '',
  reason: '',
  expectedReleaseAt: '',
});

const releaseForm = reactive({
  releaseReason: '',
  restoreOnRelease: true,
});

const rejectForm = reactive({
  rejectReason: '',
});

const addRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' },
  ],
  category: [{ required: true, message: '请选择原因分类', trigger: 'change' }],
  reason: [{ required: true, message: '请输入列入原因', trigger: 'blur' }],
};

const batchRules = {
  phones: [{ required: true, message: '请输入手机号列表', trigger: 'blur' }],
  category: [{ required: true, message: '请选择原因分类', trigger: 'change' }],
  reason: [{ required: true, message: '请输入列入原因', trigger: 'blur' }],
};

const releaseRules = {
  releaseReason: [{ required: true, message: '请输入解除原因', trigger: 'blur' }],
};

const rejectRules = {
  rejectReason: [{ required: true, message: '请输入驳回原因', trigger: 'blur' }],
};

const formatDate = (date) => dayjs(date).format('YYYY-MM-DD HH:mm');

const getCategoryLabel = (cat) => {
  const map = {
    FRAUD: '欺诈',
    MALICIOUS_COMPLAINT: '恶意投诉',
    VIOLATION_EXCHANGE: '违规兑换',
    ABUSIVE_BEHAVIOR: '滥用行为',
    OTHER: '其他',
  };
  return map[cat] || cat;
};

const getCategoryTagType = (cat) => {
  const map = {
    FRAUD: 'danger',
    MALICIOUS_COMPLAINT: 'warning',
    VIOLATION_EXCHANGE: 'info',
    ABUSIVE_BEHAVIOR: 'primary',
    OTHER: 'success',
  };
  return map[cat] || 'info';
};

const getStatusLabel = (status) => {
  const map = {
    PENDING_APPROVAL: '待审批',
    ACTIVE: '已生效',
    RELEASED: '已解除',
    REJECTED: '已驳回',
  };
  return map[status] || status;
};

const getStatusTagType = (status) => {
  const map = {
    PENDING_APPROVAL: 'warning',
    ACTIVE: 'danger',
    RELEASED: 'success',
    REJECTED: 'info',
  };
  return map[status] || 'info';
};

const getActionLabel = (action) => {
  const map = {
    POINTS_ADJUST: '积分调整',
    SIGNIN: '签到',
    EXCHANGE: '商城兑换',
    COUPON: '优惠券',
    CAMPAIGN: '活动参与',
  };
  return map[action] || action;
};

const getProgressColor = (cat) => {
  const map = {
    FRAUD: '#ef4444',
    MALICIOUS_COMPLAINT: '#f97316',
    VIOLATION_EXCHANGE: '#3b82f6',
    ABUSIVE_BEHAVIOR: '#8b5cf6',
    OTHER: '#10b981',
  };
  return map[cat] || '#4f46e5';
};

const handleSearch = () => {
  blacklistStore.page = 1;
  blacklistStore.fetchList({
    search: search.value,
    status: filterStatus.value,
    category: filterCategory.value,
    dateFrom: dateRange.value?.[0],
    dateTo: dateRange.value?.[1],
  });
};

const handleSearchAudit = () => {
  blacklistStore.fetchAuditLogs({
    phone: auditFilter.phone,
    actionType: auditFilter.actionType,
  });
};

const handlePageChange = (page) => {
  blacklistStore.page = page;
  handleSearch();
};

const handleSizeChange = (size) => {
  blacklistStore.pageSize = size;
  blacklistStore.page = 1;
  handleSearch();
};

const handleSelectionChange = (selection) => {
  selectedIds.value = selection.map((r) => r.id);
};

const clearSelection = () => {
  selectedIds.value = [];
};

const handlePhoneBlur = async () => {
  if (!addForm.phone) return;
  try {
    const members = await memberStore.fetchMembers();
    const member = members.find((m) => m.phone === addForm.phone);
    if (member) {
      addForm.memberId = member.id;
      addForm.memberName = member.name;
    } else {
      addForm.memberId = null;
      addForm.memberName = '';
    }
  } catch {
  }
};

const resetAddForm = () => {
  addForm.memberId = null;
  addForm.phone = '';
  addForm.memberName = '';
  addForm.category = '';
  addForm.reason = '';
  addForm.evidence = '';
  addForm.expectedReleaseAt = '';
  addForm.restoreOnRelease = true;
};

const resetBatchForm = () => {
  batchForm.phones = '';
  batchForm.category = '';
  batchForm.reason = '';
  batchForm.expectedReleaseAt = '';
};

const submitAddForm = async () => {
  if (!addFormRef.value) return;
  await addFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        await blacklistStore.addBlacklist({ ...addForm });
        ElMessage.success(authStore.isAdmin ? '已列入黑名单' : '已提交审批');
        showAddDialog.value = false;
      } finally {
        submitting.value = false;
      }
    }
  });
};

const submitBatchForm = async () => {
  if (!batchFormRef.value) return;
  await batchFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        const phones = batchForm.phones.split('\n').map((p) => p.trim()).filter((p) => /^1[3-9]\d{9}$/.test(p));
        if (phones.length === 0) {
          ElMessage.warning('未检测到有效的手机号');
          return;
        }
        const items = phones.map((phone) => ({
          phone,
          category: batchForm.category,
          reason: batchForm.reason,
          expectedReleaseAt: batchForm.expectedReleaseAt || null,
        }));
        const result = await blacklistStore.batchAddBlacklist({ items });
        ElMessage.success(`成功处理: ${result.created?.length || result.created || 0} 条，跳过: ${result.skipped?.length || 0} 条`);
        showBatchDialog.value = false;
      } finally {
        submitting.value = false;
      }
    }
  });
};

const parseCSV = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || '';
    });
    records.push(record);
  }
  return records;
};

const handleFileChange = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const records = parseCSV(text);
      parsedRecords.value = records.filter((r) => r.phone || r.手机号);
      if (parsedRecords.value.length === 0) {
        ElMessage.warning('未解析到有效数据，请检查CSV格式');
      }
    } catch {
      ElMessage.error('CSV解析失败，请检查文件格式');
    }
  };
  reader.onerror = () => {
    ElMessage.error('文件读取失败');
  };
  reader.readAsText(file.raw, 'UTF-8');
};

const submitImport = async () => {
  if (parsedRecords.value.length === 0) return;
  submitting.value = true;
  try {
    const result = await blacklistStore.importCSV({ records: parsedRecords.value });
    ElMessage.success(`成功导入: ${result.created || 0} 条，失败: ${result.failed?.length || 0} 条`);
    parsedRecords.value = [];
    showImportDialog.value = false;
  } finally {
    submitting.value = false;
  }
};

const handleExport = () => {
  blacklistStore.exportBlacklist({
    search: search.value,
    status: filterStatus.value,
    category: filterCategory.value,
    dateFrom: dateRange.value?.[0],
    dateTo: dateRange.value?.[1],
  });
};

const handleApprove = async (row) => {
  try {
    await ElMessageBox.confirm('确定审批通过该列入申请？', '确认审批', { type: 'warning' });
    await blacklistStore.approveBlacklist(row.id, {});
    ElMessage.success('已通过审批');
  } catch {
  }
};

const handleReject = (row) => {
  currentRow.value = row;
  rejectForm.rejectReason = '';
  showRejectDialog.value = true;
};

const submitRejectForm = async () => {
  if (!rejectFormRef.value) return;
  await rejectFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        await blacklistStore.approveBlacklist(currentRow.value.id, { rejectReason: rejectForm.rejectReason });
        ElMessage.success('已驳回申请');
        showRejectDialog.value = false;
      } finally {
        submitting.value = false;
      }
    }
  });
};

const handleRelease = (row) => {
  currentRow.value = row;
  releaseForm.releaseReason = '';
  releaseForm.restoreOnRelease = true;
  showReleaseDialog.value = true;
};

const submitReleaseForm = async () => {
  if (!releaseFormRef.value) return;
  await releaseFormRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true;
      try {
        await blacklistStore.releaseBlacklist(currentRow.value.id, { ...releaseForm });
        ElMessage.success('已解除黑名单');
        showReleaseDialog.value = false;
      } finally {
        submitting.value = false;
      }
    }
  });
};

const handleBatchRelease = async () => {
  if (selectedIds.value.length === 0) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入解除原因', '批量解除', {
      confirmButtonText: '确认解除',
      inputPlaceholder: '解除原因',
      type: 'warning',
      inputValidator: (v) => !!v?.trim() || '请输入解除原因',
    });
    submitting.value = true;
    const result = await blacklistStore.batchReleaseBlacklist({
      ids: selectedIds.value,
      releaseReason: value,
      restoreOnRelease: true,
    });
    ElMessage.success(`成功解除: ${result.released || 0} 条，失败: ${result.failed?.length || 0} 条`);
    clearSelection();
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error);
    }
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (id) => {
  await blacklistStore.deleteBlacklist(id);
  ElMessage.success('已删除');
};

const handleViewEvidence = (row) => {
  currentEvidence.value = row.evidence || '';
  showEvidenceDialog.value = true;
};

const handleViewAudit = async (row) => {
  currentAuditLogs.value = [];
  showAuditDialog.value = true;
  try {
    const data = await blacklistStore.fetchAuditLogs({ phone: row.phone });
    currentAuditLogs.value = data.list;
  } catch {
  }
};

const saveConfig = async () => {
  configSaving.value = true;
  try {
    await blacklistStore.updateConfig({ ...configForm });
    ElMessage.success('设置已保存');
  } finally {
    configSaving.value = false;
  }
};

onMounted(async () => {
  await Promise.all([
    blacklistStore.fetchList(),
    blacklistStore.fetchStats(),
    blacklistStore.fetchConfig(),
    blacklistStore.fetchAuditLogs(),
  ]);
  if (blacklistStore.config) {
    configForm.autoReleaseEnabled = blacklistStore.config.autoReleaseEnabled;
    configForm.restoreOnAutoRelease = blacklistStore.config.restoreOnAutoRelease;
  }
});
</script>

<style scoped>
.blacklist-management {
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

.header-actions {
  display: flex;
  gap: 12px;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #64748b;
}

.mb-24 {
  margin-bottom: 24px;
}

.mb-16 {
  margin-bottom: 16px;
}

.mt-12 {
  margin-top: 12px;
}

.mr-4 {
  margin-right: 4px;
}

.stat-card {
  border-radius: 12px;
  border: none;
  height: 100%;
}

.stat-content {
  padding: 8px 0;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-card-clickable {
  cursor: pointer;
  transition: all 0.25s ease;
}

.stat-card-clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08) !important;
  border-color: #0ea5e9 !important;
}

.stat-card-empty {
  cursor: default;
}

.stat-card-empty:hover {
  transform: none;
  box-shadow: none !important;
  border-color: transparent !important;
}

.stat-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-arrow {
  opacity: 0.5;
  font-size: 14px;
}

.text-danger { color: #ef4444; }
.text-warning { color: #f97316; }
.text-primary { color: #4f46e5; }
.text-info { color: #0ea5e9; }

.blacklist-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

.filter-card, .table-card {
  border-radius: 12px;
  border: none;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-group {
  display: flex;
  gap: 12px;
  flex: 1;
  flex-wrap: wrap;
}

.search-input {
  max-width: 320px;
}

.status-select, .category-select {
  width: 160px;
}

.date-range {
  width: 280px;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #4f46e5;
  font-weight: 500;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.blacklist-row) {
  transition: background-color 0.2s;
}

:deep(.blacklist-row:hover) {
  background-color: #f8fafc !important;
}

:deep(.el-table) {
  --el-table-border-color: #f1f5f9;
}

:deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
  border: none;
}

.w-full {
  width: 100%;
}

.text-muted {
  color: #94a3b8;
}

.evidence-content {
  padding: 16px;
  background-color: #f8fafc;
  border-radius: 8px;
  white-space: pre-wrap;
  line-height: 1.6;
}

.upload-area {
  padding: 20px 0;
}

.config-form {
  max-width: 600px;
}

.form-tip {
  color: #94a3b8;
  font-size: 12px;
  margin-top: 4px;
}

.stats-container {
  padding: 24px;
}

.category-stats {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.category-stat-item {
  max-width: 600px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.category-count {
  font-weight: 600;
  color: #1e293b;
}

.category-percentage {
  font-weight: 600;
  color: #4f46e5;
  margin-left: auto;
}

.repeat-tip {
  padding: 8px 16px;
  background-color: #eff6ff;
  color: #1e40af;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.expand-wrapper {
  padding: 12px 24px;
  background-color: #fafafa;
  border-radius: 8px;
}

.expand-title {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 12px;
}
</style>
