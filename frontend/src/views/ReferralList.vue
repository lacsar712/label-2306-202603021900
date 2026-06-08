<template>
  <div class="referral-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">推荐关系管理</h2>
        <p class="page-subtitle">查看和管理会员推荐关系、奖励规则与异常检测</p>
      </div>
      <div class="header-actions">
        <el-button @click="activeTab = 'binds'">推荐关系</el-button>
        <el-button @click="activeTab = 'tree'">树形结构</el-button>
        <el-button @click="activeTab = 'leaderboard'">推荐排行</el-button>
        <el-button @click="activeTab = 'codes'">推荐码管理</el-button>
        <el-button @click="activeTab = 'rewards'">奖励规则</el-button>
        <el-button type="warning" @click="activeTab = 'anomalies'">
          异常检测
          <el-badge v-if="unmarkedAnomalyCount > 0" :value="unmarkedAnomalyCount" class="ml-8" />
        </el-button>
        <el-button type="primary" @click="activeTab = 'config'">系统配置</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="mb-24">
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">总推荐绑定数</div>
            <div class="stat-value">{{ overview?.totalBinds || 0 }}</div>
          </div>
          <el-icon class="stat-icon primary"><Connection /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">推荐人数</div>
            <div class="stat-value">{{ overview?.totalReferrers || 0 }}</div>
          </div>
          <el-icon class="stat-icon success"><UserFilled /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">已发放奖励积分</div>
            <div class="stat-value">{{ overview?.distributedPoints || 0 }}</div>
          </div>
          <el-icon class="stat-icon warning"><Coin /></el-icon>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-content">
            <div class="stat-label">本月新增推荐</div>
            <div class="stat-value">{{ overview?.newThisMonth || 0 }}</div>
          </div>
          <el-icon class="stat-icon info"><TrendCharts /></el-icon>
        </el-card>
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" class="referral-tabs">
      <el-tab-pane label="推荐关系列表" name="binds">
        <el-card shadow="never">
          <div class="filter-bar mb-16">
            <el-input
              v-model="bindFilter"
              placeholder="搜索推荐人/被推荐人姓名或手机号"
              clearable
              class="w-320"
              @clear="handleBindFilter"
              @keyup.enter="handleBindFilter"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" plain @click="handleBindFilter">搜索</el-button>
          </div>
          <el-table
            v-loading="referralStore.loading"
            :data="filteredBinds"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
            row-key="id"
          >
            <el-table-column label="推荐人" min-width="160">
              <template #default="{ row }">
                <div>
                  <div class="font-medium">{{ row.referrer?.name }}</div>
                  <div class="text-muted text-sm">{{ row.referrer?.phone }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="被推荐人" min-width="160">
              <template #default="{ row }">
                <div>
                  <div class="font-medium">{{ row.referee?.name }}</div>
                  <div class="text-muted text-sm">{{ row.referee?.phone }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="level" label="层级" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="getLevelTagType(row.level)">L{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="bindChannel" label="绑定渠道" width="140">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.bindChannel || '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="bindSource" label="绑定来源" width="120">
              <template #default="{ row }">
                <span>{{ row.bindSource || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="推荐码" width="160">
              <template #default="{ row }">
                <template v-if="row.referralCode">
                  <el-tag
                    size="small"
                    class="font-mono"
                    :type="row.referralCode.type === 'CAMPAIGN' ? 'warning' : 'primary'"
                    effect="plain"
                  >
                    {{ row.referralCode.code }}
                  </el-tag>
                  <div class="text-xs text-muted mt-4">
                    {{ row.referralCode.type === 'CAMPAIGN' ? '活动码' : '个人码' }}
                    <span v-if="row.referralCode.campaignName"> · {{ row.referralCode.campaignName }}</span>
                  </div>
                </template>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="奖励发放" min-width="240">
              <template #default="{ row }">
                <div class="reward-stages">
                  <div
                    v-for="stage in rewardStages"
                    :key="stage.key"
                    class="reward-stage-item"
                  >
                    <el-tooltip :content="getRewardTooltip(row, stage.key)">
                      <el-tag
                        size="small"
                        :type="getRewardStatusType(row, stage.key)"
                        effect="light"
                      >
                        {{ stage.label }}
                        <span class="ml-4">
                          {{ getRewardPoints(row, stage.key) }}
                        </span>
                      </el-tag>
                    </el-tooltip>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="绑定时间" width="170">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.isActive" type="success" size="small">有效</el-tag>
                <el-tag v-else type="info" size="small">已解除</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-popconfirm
                  v-if="row.isActive"
                  title="确定解除该推荐关系吗？"
                  @confirm="handleUnbind(row.refereeId)"
                >
                  <template #reference>
                    <el-button link type="danger">解除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="树形结构" name="tree">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-card shadow="never" class="h-full">
              <template #header>
                <div class="card-header">
                  <span>选择根节点会员</span>
                </div>
              </template>
              <el-input
                v-model="treeSearchKeyword"
                placeholder="输入姓名或手机号搜索"
                clearable
                class="mb-12"
                @input="handleTreeMemberSearch"
              >
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <div class="member-select-list" v-if="treeMemberCandidates.length > 0">
                <div
                  v-for="m in treeMemberCandidates"
                  :key="m.id"
                  class="member-select-item"
                  :class="{ active: selectedTreeMemberId === m.id }"
                  @click="selectTreeMember(m)"
                >
                  <div class="member-name">{{ m.name }}</div>
                  <div class="member-phone">{{ m.phone }}</div>
                  <el-tag size="small" v-if="m.referralCode">{{ m.referralCode }}</el-tag>
                </div>
              </div>
              <div v-else class="empty-tip text-muted">
                输入关键词搜索会员以查看推荐树
              </div>

              <el-divider v-if="selectedTreeMember" />
              <div v-if="selectedTreeMember" class="selected-info">
                <h4>推荐统计</h4>
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item label="直接下线">{{ currentStats?.directCount || 0 }}</el-descriptions-item>
                  <el-descriptions-item label="间接下线">{{ currentStats?.indirectCount || 0 }}</el-descriptions-item>
                  <el-descriptions-item label="累计奖励">{{ currentStats?.totalRewardPoints || 0 }} 积分</el-descriptions-item>
                  <el-descriptions-item label="待发放">{{ currentStats?.pendingRewardPoints || 0 }} 积分</el-descriptions-item>
                  <el-descriptions-item label="转化率">{{ currentStats?.conversionRate || 0 }}%</el-descriptions-item>
                  <el-descriptions-item label="本月新增">{{ currentStats?.newThisMonth || 0 }}</el-descriptions-item>
                </el-descriptions>
              </div>
            </el-card>
          </el-col>
          <el-col :span="16">
            <el-card shadow="never" class="h-full">
              <template #header>
                <div class="card-header">
                  <span>推荐关系树</span>
                  <el-select v-model="treeDepth" size="small" style="width: 120px" @change="loadTree">
                    <el-option label="1层" :value="1" />
                    <el-option label="2层" :value="2" />
                    <el-option label="3层" :value="3" />
                    <el-option label="5层" :value="5" />
                    <el-option label="全部" :value="null" />
                  </el-select>
                </div>
              </template>
              <el-tree
                v-if="treeData"
                :data="[treeData]"
                :props="{ label: 'name', children: 'children' }"
                node-key="id"
                default-expand-all
                class="referral-tree"
              >
                <template #default="{ node, data }">
                  <div class="tree-node-content">
                    <div class="node-main">
                      <span class="node-name">{{ data.name }}</span>
                      <el-tag size="small" class="ml-8" :type="getLevelTagType(data.referralLevel)">
                        L{{ data.referralLevel }}
                      </el-tag>
                      <span class="node-phone ml-8 text-muted">{{ data.phone }}</span>
                    </div>
                    <div class="node-stats">
                      <el-tag size="small" effect="plain" type="primary">直推 {{ data.directCount }}</el-tag>
                      <el-tag size="small" effect="plain" type="success">间推 {{ data.indirectCount }}</el-tag>
                      <el-tag size="small" effect="plain" type="warning">奖励 {{ data.totalRewardPoints }}</el-tag>
                    </div>
                  </div>
                </template>
              </el-tree>
              <el-empty v-else description="请选择一个会员查看推荐树" />
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <el-tab-pane label="推荐排行榜" name="leaderboard">
        <el-card shadow="never">
          <div class="filter-bar mb-16">
            <el-date-picker
              v-model="leaderboardDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              @change="loadLeaderboard"
            />
            <el-select v-model="leaderboardLimit" size="default" style="width: 140px" @change="loadLeaderboard">
              <el-option label="前20名" :value="20" />
              <el-option label="前50名" :value="50" />
              <el-option label="前100名" :value="100" />
            </el-select>
          </div>
          <el-table
            v-loading="referralStore.loading"
            :data="referralStore.leaderboard"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
          >
            <el-table-column label="排名" width="80" align="center">
              <template #default="{ $index }">
                <el-tag v-if="$index < 3" size="large" :type="['danger', 'warning', 'success'][$index]" effect="dark" round>
                  {{ $index + 1 }}
                </el-tag>
                <span v-else class="rank-num">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column label="会员" min-width="180">
              <template #default="{ row }">
                <div>
                  <div class="font-medium">{{ row.name }}</div>
                  <div class="text-muted text-sm">{{ row.phone }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="level" label="等级" width="100">
              <template #default="{ row }">
                <el-tag :type="getLevelTagTypeForMember(row.level)">{{ getLevelLabel(row.level) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="directCount" label="直接推荐" width="100" align="center" sortable />
            <el-table-column prop="indirectCount" label="间接推荐" width="100" align="center" sortable />
            <el-table-column label="转化率" width="100" align="center">
              <template #default="{ row }">
                {{ row.conversionRate || 0 }}%
              </template>
            </el-table-column>
            <el-table-column prop="newThisMonth" label="本月新增" width="100" align="center" sortable />
            <el-table-column prop="totalRewardPoints" label="累计奖励积分" width="140" align="center" sortable>
              <template #default="{ row }">
                <span class="text-warning font-medium">{{ row.totalRewardPoints }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="推荐码管理" name="codes">
        <el-card shadow="never">
          <div class="filter-bar mb-16">
            <el-select v-model="codeFilterType" placeholder="类型" clearable style="width: 160px" @change="loadCodes">
              <el-option label="个人推荐码" value="PERSONAL" />
              <el-option label="活动推荐码" value="CAMPAIGN" />
            </el-select>
            <el-select v-model="codeFilterActive" placeholder="状态" clearable style="width: 140px" @change="loadCodes">
              <el-option label="启用中" :value="true" />
              <el-option label="已停用" :value="false" />
            </el-select>
            <el-button type="primary" @click="showCodeDialog = true">
              <el-icon class="mr-4"><Plus /></el-icon>新建推荐码
            </el-button>
          </div>
          <el-table
            v-loading="referralStore.loading"
            :data="referralStore.codes"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
          >
            <el-table-column prop="code" label="推荐码" width="160">
              <template #default="{ row }">
                <span class="font-mono font-medium text-primary">{{ row.code }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="type" label="类型" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.type === 'PERSONAL'" type="primary" effect="plain">个人码</el-tag>
                <el-tag v-else type="warning" effect="plain">活动码</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="所属会员" min-width="160">
              <template #default="{ row }">
                <div v-if="row.member">
                  <div class="font-medium">{{ row.member.name }}</div>
                  <div class="text-muted text-sm">{{ row.member.phone }}</div>
                </div>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="campaignName" label="活动名称" width="160">
              <template #default="{ row }">
                <span>{{ row.campaignName || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="使用情况" width="120">
              <template #default="{ row }">
                <span>{{ row.usedCount }} / {{ row.maxUses || '∞' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="奖励" width="140">
              <template #default="{ row }">
                <div class="text-sm">
                  <div>推荐人: {{ row.bonusPoints }} 分</div>
                  <div>被推荐人: {{ row.refereeBonus }} 分</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="expiresAt" label="有效期" width="160">
              <template #default="{ row }">
                <span v-if="row.expiresAt">{{ formatDate(row.expiresAt) }}</span>
                <span v-else class="text-muted">永久有效</span>
              </template>
            </el-table-column>
            <el-table-column prop="isActive" label="状态" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.isActive" type="success" size="small">启用</el-tag>
                <el-tag v-else type="info" size="small">停用</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="handleCopyCode(row.code)">复制</el-button>
                <el-button link @click="handleEditCode(row)">编辑</el-button>
                <el-popconfirm title="确定删除该推荐码吗？" @confirm="handleDeleteCode(row.id)">
                  <template #reference>
                    <el-button link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="奖励规则" name="rewards">
        <el-card shadow="never">
          <div class="header-actions mb-16">
            <el-button type="primary" @click="showRewardDialog = true">
              <el-icon class="mr-4"><Plus /></el-icon>新增奖励规则
            </el-button>
          </div>
          <el-table
            :data="referralStore.rewardRules"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
          >
            <el-table-column prop="name" label="规则名称" min-width="160" />
            <el-table-column prop="stage" label="奖励阶段" width="140">
              <template #default="{ row }">
                <el-tag :type="getStageTagType(row.stage)">{{ getStageLabel(row.stage) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="points" label="奖励积分" width="100" />
            <el-table-column label="目标值" width="120">
              <template #default="{ row }">
                <span v-if="row.targetValue !== null">{{ row.targetValue }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="等级乘数" min-width="200">
              <template #default="{ row }">
                <span v-if="row.levelMultipliers" class="text-sm font-mono">
                  {{ JSON.stringify(row.levelMultipliers) }}
                </span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="200">
              <template #default="{ row }">
                <span>{{ row.description || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="isEnabled" label="状态" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.isEnabled" type="success" size="small">启用</el-tag>
                <el-tag v-else type="info" size="small">停用</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link @click="handleEditReward(row)">编辑</el-button>
                <el-popconfirm title="确定删除该奖励规则吗？" @confirm="handleDeleteReward(row.id)">
                  <template #reference>
                    <el-button link type="danger">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="异常检测" name="anomalies">
        <el-card shadow="never">
          <div class="filter-bar mb-16">
            <el-select v-model="anomalyFilterType" placeholder="异常类型" clearable style="width: 180px" @change="loadAnomalies">
              <el-option label="自推荐" value="SELF_REFERRAL" />
              <el-option label="循环推荐" value="CIRCULAR_REFERRAL" />
              <el-option label="跨级篡改" value="CROSS_LEVEL_TAMPER" />
              <el-option label="IP异常" value="IP_ANOMALY" />
              <el-option label="设备异常" value="DEVICE_ANOMALY" />
            </el-select>
            <el-select v-model="anomalyFilterMarked" placeholder="处理状态" clearable style="width: 140px" @change="loadAnomalies">
              <el-option label="未处理" :value="false" />
              <el-option label="已标记" :value="true" />
            </el-select>
          </div>
          <el-table
            v-loading="referralStore.loading"
            :data="referralStore.anomalies"
            style="width: 100%"
            :header-cell-style="{ background: '#f8fafc', color: '#64748b', fontWeight: '600' }"
            :row-class-name="({ row }) => row.isMarked ? 'anomaly-marked-row' : ''"
          >
            <el-table-column label="异常类型" width="140">
              <template #default="{ row }">
                <el-tag type="danger" effect="dark">{{ getAnomalyLabel(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="推荐人" min-width="160">
              <template #default="{ row }">
                <div>
                  <div class="font-medium">{{ row.referrer?.name }}</div>
                  <div class="text-muted text-sm">{{ row.referrer?.phone }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="被推荐人" min-width="160">
              <template #default="{ row }">
                <div>
                  <div class="font-medium">{{ row.referee?.name }}</div>
                  <div class="text-muted text-sm">{{ row.referee?.phone }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="level" label="层级" width="80" />
            <el-table-column label="详情" min-width="240">
              <template #default="{ row }">
                <span v-if="row.detail?.message">{{ row.detail.message }}</span>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="检测时间" width="170">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.isMarked" type="success" size="small">已处理</el-tag>
                <el-tag v-else type="warning" size="small">待处理</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="!row.isMarked"
                  link
                  type="primary"
                  @click="handleMarkAnomaly(row.id, true)"
                >
                  标记已处理
                </el-button>
                <el-button v-else link @click="handleMarkAnomaly(row.id, false)">
                  取消标记
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="系统配置" name="config">
        <el-card shadow="never">
          <el-form :model="configForm" label-width="180px" style="max-width: 600px">
            <el-form-item label="最大推荐层级">
              <el-input-number v-model="configForm.maxDepth" :min="1" :max="20" />
              <span class="ml-12 text-muted">建议设置 3-10 层</span>
            </el-form-item>
            <el-form-item label="循环引用检测">
              <el-switch v-model="configForm.enableCircularCheck" />
            </el-form-item>
            <el-form-item label="异常绑定检测">
              <el-switch v-model="configForm.enableAnomalyDetection" />
            </el-form-item>
            <el-form-item label="绑定有效期(小时)">
              <el-input-number v-model="configForm.bindExpireHours" :min="0" :max="720" />
              <span class="ml-12 text-muted">0 表示永久有效</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSaveConfig" :loading="savingConfig">
                保存配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="showCodeDialog"
      :title="editingCode ? '编辑推荐码' : '新建推荐码'"
      width="520px"
      destroy-on-close
      @closed="resetCodeForm"
    >
      <el-form :model="codeForm" :rules="codeRules" ref="codeFormRef" label-width="120px">
        <el-form-item label="推荐码" prop="code">
          <div class="code-input-group">
            <el-input v-model="codeForm.code" placeholder="请输入或自动生成" :disabled="codeForm.type === 'PERSONAL' && editingCode" />
            <el-button @click="generateRandomCode">生成</el-button>
          </div>
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="codeForm.type" @change="handleCodeTypeChange">
            <el-radio label="PERSONAL">个人推荐码</el-radio>
            <el-radio label="CAMPAIGN">活动推荐码</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="codeForm.type === 'PERSONAL'" label="所属会员" prop="memberId">
          <el-select
            v-model="codeForm.memberId"
            filterable
            remote
            placeholder="搜索会员姓名或手机号"
            :remote-method="handleMemberSearch"
            :loading="memberSearchLoading"
            class="w-full"
          >
            <el-option
              v-for="m in memberCandidates"
              :key="m.id"
              :label="`${m.name} - ${m.phone}`"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="codeForm.type === 'CAMPAIGN'" label="活动名称" prop="campaignName">
          <el-input v-model="codeForm.campaignName" placeholder="请输入活动名称" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="使用上限">
              <el-input-number v-model="codeForm.maxUses" :min="0" class="w-full" />
              <div class="text-muted text-xs mt-4">0 表示不限制</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="有效期">
              <el-date-picker
                v-model="codeForm.expiresAt"
                type="datetime"
                placeholder="选择过期时间"
                value-format="YYYY-MM-DDTHH:mm:ss"
                class="w-full"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="推荐人奖励">
              <el-input-number v-model="codeForm.bonusPoints" :min="0" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="被推荐人奖励">
              <el-input-number v-model="codeForm.refereeBonus" :min="0" class="w-full" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="是否启用">
          <el-switch v-model="codeForm.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCodeDialog = false">取消</el-button>
        <el-button type="primary" :loading="submittingCode" @click="submitCodeForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showRewardDialog"
      :title="editingReward ? '编辑奖励规则' : '新增奖励规则'"
      width="560px"
      destroy-on-close
      @closed="resetRewardForm"
    >
      <el-form :model="rewardForm" :rules="rewardRules" ref="rewardFormRef" label-width="120px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="rewardForm.name" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="奖励阶段" prop="stage">
          <el-select v-model="rewardForm.stage" class="w-full">
            <el-option label="注册奖励" value="REGISTER" />
            <el-option label="首单奖励" value="FIRST_ORDER" />
            <el-option label="累计消费达标" value="CONSUMPTION_TARGET" />
          </el-select>
        </el-form-item>
        <el-form-item label="奖励积分" prop="points">
          <el-input-number v-model="rewardForm.points" :min="0" class="w-full" />
        </el-form-item>
        <el-form-item v-if="rewardForm.stage === 'CONSUMPTION_TARGET'" label="目标金额">
          <el-input-number v-model="rewardForm.targetValue" :min="0" :precision="2" class="w-full" />
        </el-form-item>
        <el-form-item label="等级乘数(JSON)">
          <el-input
            v-model="rewardForm.levelMultipliersStr"
            type="textarea"
            :rows="3"
            placeholder='如: {"1": 1, "2": 0.5, "3": 0.3, "default": 0}'
          />
          <div class="text-muted text-xs mt-4">键为层级，值为乘数。default 为未指定层级的默认值</div>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="rewardForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="rewardForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRewardDialog = false">取消</el-button>
        <el-button type="primary" :loading="submittingReward" @click="submitRewardForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useReferralStore } from '../stores/referral';
import { useMemberStore } from '../stores/member';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Search, Connection, UserFilled, Coin, TrendCharts, Plus,
} from '@element-plus/icons-vue';

const referralStore = useReferralStore();
const memberStore = useMemberStore();

const activeTab = ref('binds');
const overview = ref(null);
const bindFilter = ref('');

const rewardStages = [
  { key: 'REGISTER', label: '注册' },
  { key: 'FIRST_ORDER', label: '首单' },
  { key: 'CONSUMPTION_TARGET', label: '消费达标' },
];

const filteredBinds = computed(() => {
  const keyword = bindFilter.value.trim().toLowerCase();
  if (!keyword) return referralStore.binds;
  return referralStore.binds.filter((b) =>
    b.referrer?.name?.toLowerCase().includes(keyword) ||
    b.referrer?.phone?.includes(keyword) ||
    b.referee?.name?.toLowerCase().includes(keyword) ||
    b.referee?.phone?.includes(keyword)
  );
});

const unmarkedAnomalyCount = computed(
  () => referralStore.anomalies.filter((a) => !a.isMarked).length
);

const treeSearchKeyword = ref('');
const treeMemberCandidates = ref([]);
const selectedTreeMemberId = ref(null);
const selectedTreeMember = ref(null);
const treeDepth = ref(3);
const treeData = ref(null);
const currentStats = ref(null);

const leaderboardDateRange = ref([]);
const leaderboardLimit = ref(50);

const codeFilterType = ref('');
const codeFilterActive = ref('');
const showCodeDialog = ref(false);
const editingCode = ref(null);
const submittingCode = ref(false);
const codeFormRef = ref(null);
const memberSearchLoading = ref(false);
const memberCandidates = ref([]);
const codeForm = reactive({
  id: null,
  code: '',
  type: 'PERSONAL',
  memberId: null,
  campaignId: null,
  campaignName: '',
  maxUses: 0,
  expiresAt: '',
  isActive: true,
  bonusPoints: 0,
  refereeBonus: 0,
});
const codeRules = {
  code: [{ required: true, message: '请输入推荐码', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

const showRewardDialog = ref(false);
const editingReward = ref(null);
const submittingReward = ref(false);
const rewardFormRef = ref(null);
const rewardForm = reactive({
  id: null,
  name: '',
  stage: 'REGISTER',
  points: 0,
  targetValue: null,
  levelMultipliers: null,
  levelMultipliersStr: '',
  description: '',
  isEnabled: true,
});
const rewardRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  stage: [{ required: true, message: '请选择奖励阶段', trigger: 'change' }],
  points: [{ required: true, message: '请输入奖励积分', trigger: 'blur' }],
};

const anomalyFilterType = ref('');
const anomalyFilterMarked = ref('');

const savingConfig = ref(false);
const configForm = reactive({
  maxDepth: 5,
  enableCircularCheck: true,
  enableAnomalyDetection: true,
  bindExpireHours: 0,
});

const formatDate = (d) => dayjs(d).format('YYYY-MM-DD HH:mm');

const getLevelTagType = (level) => {
  if (level === 1) return 'danger';
  if (level === 2) return 'warning';
  if (level === 3) return 'primary';
  return 'info';
};

const getLevelTagTypeForMember = (level) => {
  const map = { NORMAL: 'info', SILVER: 'primary', GOLD: 'warning', PLATINUM: 'success' };
  return map[level] || 'info';
};

const getLevelLabel = (level) => {
  const map = { NORMAL: '普通会员', SILVER: '白银会员', GOLD: '黄金会员', PLATINUM: '铂金会员' };
  return map[level] || level;
};

const getStageLabel = (stage) => {
  const map = { REGISTER: '注册奖励', FIRST_ORDER: '首单奖励', CONSUMPTION_TARGET: '消费达标' };
  return map[stage] || stage;
};

const getStageTagType = (stage) => {
  const map = { REGISTER: 'success', FIRST_ORDER: 'primary', CONSUMPTION_TARGET: 'warning' };
  return map[stage] || 'info';
};

const getRewardStatusType = (row, stage) => {
  const reward = row.rewards?.find((r) => r.stage === stage);
  if (!reward) return 'info';
  if (reward.status === 'DISTRIBUTED') return 'success';
  if (reward.status === 'PENDING') return 'warning';
  return 'info';
};

const getRewardPoints = (row, stage) => {
  const reward = row.rewards?.find((r) => r.stage === stage);
  return reward ? `${reward.points}分` : '-';
};

const getRewardTooltip = (row, stage) => {
  const reward = row.rewards?.find((r) => r.stage === stage);
  if (!reward) return '未创建';
  if (reward.status === 'DISTRIBUTED') return `已发放: ${reward.points} 积分 (${formatDate(reward.distributedAt)})`;
  if (reward.status === 'PENDING') return `待发放: ${reward.points} 积分`;
  return `已取消: ${reward.points} 积分`;
};

const getAnomalyLabel = (type) => {
  const map = {
    SELF_REFERRAL: '自推荐',
    CIRCULAR_REFERRAL: '循环推荐',
    CROSS_LEVEL_TAMPER: '跨级篡改',
    IP_ANOMALY: 'IP异常',
    DEVICE_ANOMALY: '设备异常',
  };
  return map[type] || type;
};

const handleBindFilter = () => {
  referralStore.fetchBinds();
};

const handleUnbind = async (refereeId) => {
  await referralStore.unbindReferral(refereeId);
  ElMessage.success('已解除推荐关系');
};

const handleTreeMemberSearch = async (val) => {
  if (!val.trim()) {
    treeMemberCandidates.value = [];
    return;
  }
  await memberStore.fetchMembers({ search: val.trim() });
  treeMemberCandidates.value = memberStore.members.slice(0, 20);
};

const selectTreeMember = async (member) => {
  selectedTreeMemberId.value = member.id;
  selectedTreeMember.value = member;
  await loadTree();
  currentStats.value = await referralStore.fetchStats(member.id);
};

const loadTree = async () => {
  if (!selectedTreeMemberId.value) return;
  treeData.value = await referralStore.fetchTree(selectedTreeMemberId.value, treeDepth.value);
};

const loadLeaderboard = async () => {
  const params = { limit: leaderboardLimit.value };
  if (leaderboardDateRange.value?.length === 2) {
    params.startDate = leaderboardDateRange.value[0];
    params.endDate = leaderboardDateRange.value[1];
  }
  await referralStore.fetchLeaderboard(params);
};

const loadCodes = async () => {
  const params = {};
  if (codeFilterType.value) params.type = codeFilterType.value;
  if (codeFilterActive.value !== '') params.isActive = codeFilterActive.value;
  await referralStore.fetchCodes(params);
};

const handleCopyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code);
    ElMessage.success('已复制到剪贴板');
  } catch {
    ElMessage.error('复制失败');
  }
};

const generateRandomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  codeForm.code = code;
};

const handleCodeTypeChange = () => {
  codeForm.memberId = null;
  codeForm.campaignName = '';
};

const handleMemberSearch = async (query) => {
  if (!query) {
    memberCandidates.value = [];
    return;
  }
  memberSearchLoading.value = true;
  try {
    await memberStore.fetchMembers({ search: query });
    memberCandidates.value = memberStore.members;
  } finally {
    memberSearchLoading.value = false;
  }
};

const handleEditCode = (row) => {
  editingCode.value = row;
  Object.assign(codeForm, row);
  showCodeDialog.value = true;
};

const resetCodeForm = () => {
  editingCode.value = null;
  Object.assign(codeForm, {
    id: null,
    code: '',
    type: 'PERSONAL',
    memberId: null,
    campaignId: null,
    campaignName: '',
    maxUses: 0,
    expiresAt: '',
    isActive: true,
    bonusPoints: 0,
    refereeBonus: 0,
  });
};

const submitCodeForm = async () => {
  if (!codeFormRef.value) return;
  await codeFormRef.value.validate(async (valid) => {
    if (valid) {
      submittingCode.value = true;
      try {
        if (editingCode.value) {
          await referralStore.updateCode(editingCode.value.id, codeForm);
          ElMessage.success('更新成功');
        } else {
          await referralStore.createCode(codeForm);
          ElMessage.success('创建成功');
        }
        showCodeDialog.value = false;
      } finally {
        submittingCode.value = false;
      }
    }
  });
};

const handleDeleteCode = async (id) => {
  await referralStore.deleteCode(id);
  ElMessage.success('删除成功');
};

const handleEditReward = (row) => {
  editingReward.value = row;
  Object.assign(rewardForm, row);
  rewardForm.levelMultipliersStr = row.levelMultipliers ? JSON.stringify(row.levelMultipliers) : '';
  showRewardDialog.value = true;
};

const resetRewardForm = () => {
  editingReward.value = null;
  Object.assign(rewardForm, {
    id: null,
    name: '',
    stage: 'REGISTER',
    points: 0,
    targetValue: null,
    levelMultipliers: null,
    levelMultipliersStr: '',
    description: '',
    isEnabled: true,
  });
};

const submitRewardForm = async () => {
  if (!rewardFormRef.value) return;
  await rewardFormRef.value.validate(async (valid) => {
    if (valid) {
      submittingReward.value = true;
      try {
        const data = { ...rewardForm };
        if (data.levelMultipliersStr.trim()) {
          try {
            data.levelMultipliers = JSON.parse(data.levelMultipliersStr);
          } catch {
            ElMessage.error('等级乘数 JSON 格式错误');
            return;
          }
        } else {
          data.levelMultipliers = null;
        }
        delete data.levelMultipliersStr;

        if (editingReward.value) {
          await referralStore.updateRewardRule(editingReward.value.id, data);
          ElMessage.success('更新成功');
        } else {
          await referralStore.createRewardRule(data);
          ElMessage.success('创建成功');
        }
        showRewardDialog.value = false;
      } finally {
        submittingReward.value = false;
      }
    }
  });
};

const handleDeleteReward = async (id) => {
  await referralStore.deleteRewardRule(id);
  ElMessage.success('删除成功');
};

const loadAnomalies = async () => {
  const params = {};
  if (anomalyFilterType.value) params.type = anomalyFilterType.value;
  if (anomalyFilterMarked.value !== '') params.isMarked = anomalyFilterMarked.value;
  await referralStore.fetchAnomalies(params);
};

const handleMarkAnomaly = async (id, isMarked) => {
  await referralStore.markAnomaly(id, { isMarked });
  ElMessage.success(isMarked ? '已标记为已处理' : '已取消标记');
};

const handleSaveConfig = async () => {
  savingConfig.value = true;
  try {
    await referralStore.updateConfig(configForm);
    ElMessage.success('配置保存成功');
  } finally {
    savingConfig.value = false;
  }
};

onMounted(async () => {
  overview.value = await referralStore.fetchOverview();
  await referralStore.fetchBinds();
  await referralStore.fetchCodes();
  await referralStore.fetchRewardRules();
  await referralStore.fetchAnomalies({ isMarked: false });
  await loadLeaderboard();

  const config = await referralStore.fetchConfig();
  if (config) Object.assign(configForm, config);
});

watch(activeTab, (val) => {
  if (val === 'anomalies') loadAnomalies();
  if (val === 'leaderboard') loadLeaderboard();
  if (val === 'codes') loadCodes();
});
</script>

<style scoped>
.referral-page {
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

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mb-16 { margin-bottom: 16px; }
.mb-24 { margin-bottom: 24px; }
.mr-4 { margin-right: 4px; }
.ml-4 { margin-left: 4px; }
.ml-8 { margin-left: 8px; }
.ml-12 { margin-left: 12px; }
.mt-4 { margin-top: 4px; }
.w-320 { width: 320px; }
.w-full { width: 100%; }

.stat-card {
  border-radius: 12px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-icon {
  font-size: 40px;
  padding: 12px;
  border-radius: 12px;
}

.stat-icon.primary { color: #3b82f6; background-color: #eff6ff; }
.stat-icon.success { color: #10b981; background-color: #ecfdf5; }
.stat-icon.warning { color: #f59e0b; background-color: #fffbeb; }
.stat-icon.info { color: #8b5cf6; background-color: #faf5ff; }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.referral-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

.font-medium { font-weight: 500; }
.text-muted { color: #94a3b8; }
.text-sm { font-size: 13px; }
.text-xs { font-size: 12px; }
.text-primary { color: #4f46e5; }
.text-warning { color: #f59e0b; }
.font-mono { font-family: monospace; }
.text-danger { color: #ef4444; }

.reward-stages {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.reward-stage-item {
  display: inline-flex;
}

.member-select-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.member-select-item {
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.member-select-item:hover {
  background-color: #f8fafc;
}

.member-select-item.active {
  background-color: #eff6ff;
}

.member-name {
  font-weight: 500;
  color: #1e293b;
}

.member-phone {
  font-size: 13px;
  color: #64748b;
}

.empty-tip {
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
}

.selected-info h4 {
  margin: 0 0 12px;
  color: #1e293b;
}

.rank-num {
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
}

.referral-tree {
  background: transparent;
}

.tree-node-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  flex: 1;
}

.node-main {
  display: flex;
  align-items: center;
}

.node-name {
  font-weight: 500;
  color: #1e293b;
}

.node-phone {
  font-size: 13px;
}

.node-stats {
  display: flex;
  gap: 6px;
}

.h-full {
  height: 100%;
  min-height: 500px;
}

.code-input-group {
  display: flex;
  gap: 8px;
  width: 100%;
}

.code-input-group :deep(.el-input) {
  flex: 1;
}

:deep(.anomaly-marked-row) {
  background-color: #f0fdf4 !important;
}

:deep(.el-table) {
  --el-table-border-color: #f1f5f9;
}

:deep(.el-tag) {
  border-radius: 6px;
  font-weight: 500;
  border: none;
}
</style>
