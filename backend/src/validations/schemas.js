const { z } = require('zod');

const MemberSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  email: z.string().email().optional().nullable(),
  level: z.enum(['NORMAL', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  points: z.number().int().optional(),
  sourceChannelId: z.number().int().positive().optional().nullable(),
  firstTouchAt: z.string().datetime().optional().nullable(),
  utmSource: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
  referrerId: z.number().int().positive().optional().nullable(),
});

const ChannelSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
  parentId: z.number().int().positive().optional().nullable(),
  level: z.number().int().min(1).optional(),
  sortOrder: z.number().int().optional(),
  managerId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  budget: z.number().positive().optional().nullable(),
});

const ChannelUpdateSchema = ChannelSchema.partial();

const ChannelMergeSchema = z.object({
  sourceIds: z.array(z.number().int().positive()).min(2),
  targetId: z.number().int().positive(),
});

const PointsSourceTypeSchema = z.enum(['CONSUMPTION', 'ACTIVITY', 'SIGNIN', 'ADJUST', 'EXCHANGE_REFUND', 'OTHER']);
const ExpiryHandleTypeSchema = z.enum(['CLEAR_ALL', 'FIFO_DEDUCT', 'TRANSFER_FROZEN']);

const PointsExpiryRuleSchema = z.object({
  name: z.string().min(1).max(100),
  sourceType: PointsSourceTypeSchema,
  validDays: z.number().int().min(1),
  isEnabled: z.boolean().optional(),
  reminderDays: z.array(z.number().int().min(1)).optional(),
  handleType: ExpiryHandleTypeSchema.optional(),
});

const PointsExpiryRuleUpdateSchema = PointsExpiryRuleSchema.partial();

const PointsExtendSchema = z.object({
  ledgerIds: z.array(z.number().int().positive()).optional(),
  extendDays: z.number().int().min(1),
  remark: z.string().optional().nullable(),
});

const PointsExemptSchema = z.object({
  ledgerIds: z.array(z.number().int().positive()).optional(),
  remark: z.string().optional().nullable(),
});

const PointsLedgerQuerySchema = z.object({
  memberId: z.string().optional(),
  status: z.enum(['ACTIVE', 'CONSUMED', 'EXPIRED', 'FROZEN', 'EXEMPTED']).optional(),
  expiringSoon: z.enum(['true', 'false']).optional(),
  expired: z.enum(['true', 'false']).optional(),
});

const PointsUpdateSchema = z.object({
  points: z.number().int(),
});

const CreateUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const UpdateUserSchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const CreateTicketSchema = z.object({
  memberId: z.number().int().positive(),
  title: z.string().min(2).max(200),
  content: z.string().min(5),
  category: z.enum(['CONSULTATION', 'COMPLAINT', 'SUGGESTION', 'AFTERSALE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

const UpdateTicketSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  content: z.string().min(5).optional(),
  category: z.enum(['CONSULTATION', 'COMPLAINT', 'SUGGESTION', 'AFTERSALE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PENDING_ASSIGN', 'PENDING_PROCESS', 'PROCESSING', 'PENDING_REVIEW', 'CLOSED', 'REJECTED']).optional(),
  assigneeId: z.number().int().positive().optional().nullable(),
  satisfaction: z.number().int().min(1).max(5).optional().nullable(),
});

const TicketReplySchema = z.object({
  content: z.string().min(1),
  actionType: z.string().optional(),
  actionDetail: z.string().optional(),
});

const TicketAssignSchema = z.object({
  assigneeId: z.number().int().positive(),
});

const TicketCollaboratorSchema = z.object({
  userIds: z.array(z.number().int().positive()),
});

const AssignmentRuleSchema = z.object({
  category: z.enum(['CONSULTATION', 'COMPLAINT', 'SUGGESTION', 'AFTERSALE']),
  defaultAssigneeId: z.number().int().positive(),
  slaHours: z.number().int().positive().optional(),
});

const TicketListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['PENDING_ASSIGN', 'PENDING_PROCESS', 'PROCESSING', 'PENDING_REVIEW', 'CLOSED', 'REJECTED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.enum(['CONSULTATION', 'COMPLAINT', 'SUGGESTION', 'AFTERSALE']).optional(),
  assigneeId: z.string().optional(),
  memberId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  slaTimeout: z.enum(['true', 'false']).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const CampaignTypeSchema = z.enum(['DOUBLE_POINTS', 'SPEND_GIFT_POINTS', 'LEVEL_BONUS', 'SIGNIN_DOUBLE', 'EXCHANGE_DISCOUNT']);
const CampaignStatusSchema = z.enum(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'ENDED', 'VOID']);

const CampaignSchema = z.object({
  name: z.string().min(1).max(200),
  type: CampaignTypeSchema,
  ruleParams: z.record(z.any()),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  applicableLevels: z.array(z.enum(['NORMAL', 'SILVER', 'GOLD', 'PLATINUM'])).optional().nullable(),
  applicableTags: z.array(z.string()).optional().nullable(),
  applicableChannels: z.array(z.string()).optional().nullable(),
  participationLimit: z.number().int().min(0).optional(),
  mutualExclusionGroup: z.string().optional().nullable(),
  priority: z.number().int().optional(),
  status: CampaignStatusSchema.optional(),
  enabled: z.boolean().optional(),
});

const CampaignUpdateSchema = CampaignSchema.partial();

const CampaignStatusTransitionSchema = z.object({
  status: CampaignStatusSchema,
});

const SigninSchema = z.object({
  memberId: z.number().int().positive(),
});

const MakeupSigninSchema = z.object({
  memberId: z.number().int().positive(),
  signinDate: z.string(),
});

const SigninConfigSchema = z.object({
  basePoints: z.number().int().min(1),
  consecutiveBonusRules: z.array(z.object({
    days: z.number().int().min(1),
    bonusPoints: z.number().int().min(0),
  })),
  monthlyMakeupLimit: z.number().int().min(0),
  makeupCostPoints: z.number().int().min(0),
});

const SigninStatsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  memberId: z.string().optional(),
});

const ExchangeSchema = z.object({
  memberId: z.number().int().positive(),
  itemName: z.string().min(1),
  points: z.number().int().positive(),
});

const ReferralBindSchema = z.object({
  referrerId: z.number().int().positive(),
  refereeId: z.number().int().positive(),
  bindChannel: z.string().optional().nullable(),
  referralCodeId: z.number().int().positive().optional().nullable(),
  bindSource: z.string().optional().nullable(),
});

const ReferralBindByCodeSchema = z.object({
  refereeId: z.number().int().positive(),
  referralCode: z.string().min(4).max(32),
  bindChannel: z.string().optional().nullable(),
  bindSource: z.string().optional().nullable(),
});

const ReferralBindByPhoneSchema = z.object({
  refereeId: z.number().int().positive(),
  referrerPhone: z.string().regex(/^1[3-9]\d{9}$/),
  bindChannel: z.string().optional().nullable(),
  bindSource: z.string().optional().nullable(),
});

const ReferralCodeSchema = z.object({
  code: z.string().min(4).max(32),
  type: z.enum(['PERSONAL', 'CAMPAIGN']),
  memberId: z.number().int().positive().optional().nullable(),
  campaignId: z.number().int().positive().optional().nullable(),
  campaignName: z.string().max(100).optional().nullable(),
  maxUses: z.number().int().min(0).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  bonusPoints: z.number().int().min(0).optional(),
  refereeBonus: z.number().int().min(0).optional(),
});

const ReferralCodeUpdateSchema = ReferralCodeSchema.partial();

const ReferralRewardRuleSchema = z.object({
  name: z.string().min(1).max(100),
  stage: z.enum(['REGISTER', 'FIRST_ORDER', 'CONSUMPTION_TARGET']),
  points: z.number().int().min(0),
  targetValue: z.number().positive().optional().nullable(),
  isEnabled: z.boolean().optional(),
  levelMultipliers: z.record(z.any()).optional().nullable(),
  description: z.string().optional().nullable(),
});

const ReferralRewardRuleUpdateSchema = ReferralRewardRuleSchema.partial();

const ReferralConfigSchema = z.object({
  maxDepth: z.number().int().min(1).max(20),
  enableCircularCheck: z.boolean().optional(),
  enableAnomalyDetection: z.boolean().optional(),
  bindExpireHours: z.number().int().min(0).optional(),
});

const ReferralAnomalyMarkSchema = z.object({
  isMarked: z.boolean(),
  markedBy: z.number().int().positive().optional().nullable(),
});

const ReferralSearchSchema = z.object({
  phone: z.string().optional(),
  code: z.string().optional(),
});

const ReferralLeaderboardSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().optional(),
});

module.exports = {
  MemberSchema,
  PointsUpdateSchema,
  CreateUserSchema,
  UpdateUserSchema,
  CreateTicketSchema,
  UpdateTicketSchema,
  TicketReplySchema,
  TicketAssignSchema,
  TicketCollaboratorSchema,
  AssignmentRuleSchema,
  TicketListQuerySchema,
  CampaignSchema,
  CampaignUpdateSchema,
  CampaignStatusTransitionSchema,
  SigninSchema,
  MakeupSigninSchema,
  SigninConfigSchema,
  SigninStatsQuerySchema,
  ExchangeSchema,
  ChannelSchema,
  ChannelUpdateSchema,
  ChannelMergeSchema,
  PointsExpiryRuleSchema,
  PointsExpiryRuleUpdateSchema,
  PointsExtendSchema,
  PointsExemptSchema,
  PointsLedgerQuerySchema,
  ReferralBindSchema,
  ReferralBindByCodeSchema,
  ReferralBindByPhoneSchema,
  ReferralCodeSchema,
  ReferralCodeUpdateSchema,
  ReferralRewardRuleSchema,
  ReferralRewardRuleUpdateSchema,
  ReferralConfigSchema,
  ReferralAnomalyMarkSchema,
  ReferralSearchSchema,
  ReferralLeaderboardSchema,
};
