const { z } = require('zod');

const MemberSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  email: z.string().email().optional().nullable(),
  level: z.enum(['NORMAL', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  points: z.number().int().optional(),
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
};
