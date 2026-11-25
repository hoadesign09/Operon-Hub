import { z } from 'zod';

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có định dạng YYYY-MM-DD')
  .nullable()
  .optional();

const colorHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Mã màu phải có định dạng #RRGGBB')
  .default('#2563EB');

export const createProjectSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Mã dự án tối thiểu 2 ký tự')
    .max(24, 'Mã dự án tối đa 24 ký tự')
    .regex(/^[A-Za-z0-9-]+$/, 'Mã dự án chỉ gồm chữ cái không dấu, số và dấu gạch ngang'),
  name: z.string().trim().min(2, 'Tên dự án tối thiểu 2 ký tự').max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  branchId: z.coerce.number().int().positive(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  ownerEmployeeId: z.coerce.number().int().positive(),
  managerEmployeeId: z.coerce.number().int().positive(),
  methodology: z.enum(['KANBAN', 'SCRUM', 'WATERFALL', 'HYBRID']).default('KANBAN'),
  visibility: z
    .enum(['PUBLIC_COMPANY', 'BRANCH', 'DEPARTMENT', 'PRIVATE_INVITE'])
    .default('BRANCH'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  startDate: isoDateString,
  targetEndDate: isoDateString,
  plannedBudget: z.coerce.number().min(0).default(0),
  colorHex: colorHexSchema.optional(),
  templateId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  ownerEmployeeId: z.coerce.number().int().positive().optional(),
  managerEmployeeId: z.coerce.number().int().positive().optional(),
  methodology: z.enum(['KANBAN', 'SCRUM', 'WATERFALL', 'HYBRID']).optional(),
  visibility: z.enum(['PUBLIC_COMPANY', 'BRANCH', 'DEPARTMENT', 'PRIVATE_INVITE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  healthStatus: z.enum(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).optional(),
  startDate: isoDateString,
  targetEndDate: isoDateString,
  plannedBudget: z.coerce.number().min(0).optional(),
  progressPercent: z.coerce.number().min(0).max(100).optional(),
  colorHex: colorHexSchema.optional(),
});

export const transitionProjectStatusSchema = z.object({
  targetStatus: z.enum([
    'DRAFT',
    'PENDING_APPROVAL',
    'PLANNING',
    'ACTIVE',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
  ]),
  reason: z.string().trim().max(1000).nullable().optional(),
});

export const addProjectMemberSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  projectRole: z
    .enum(['PROJECT_OWNER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'MEMBER', 'VIEWER'])
    .default('MEMBER'),
  allocationPercent: z.coerce.number().int().min(0).max(100).default(100),
  hourlyCostRate: z.coerce.number().min(0).default(0),
});

export const updateProjectMemberSchema = z.object({
  projectRole: z
    .enum(['PROJECT_OWNER', 'PROJECT_MANAGER', 'TEAM_LEAD', 'MEMBER', 'VIEWER'])
    .optional(),
  allocationPercent: z.coerce.number().int().min(0).max(100).optional(),
  hourlyCostRate: z.coerce.number().min(0).optional(),
});

export const createBoardColumnSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_]+$/, 'Mã cột chỉ gồm chữ, số và dấu gạch dưới'),
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().max(120).nullable().optional(),
  statusCategory: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']),
  colorHex: colorHexSchema.optional(),
  wipLimit: z.coerce.number().int().min(1).max(500).nullable().optional(),
  isDefaultInitial: z.boolean().optional(),
  isDoneColumn: z.boolean().optional(),
});

export const updateBoardColumnSchema = z.object({
  columnId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(120).optional(),
  nameEn: z.string().trim().max(120).nullable().optional(),
  statusCategory: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']).optional(),
  colorHex: colorHexSchema.optional(),
  wipLimit: z.coerce.number().int().min(1).max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isDefaultInitial: z.boolean().optional(),
  isDoneColumn: z.boolean().optional(),
  archive: z.boolean().optional(),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colorHex: colorHexSchema.optional(),
});

export const updateLabelSchema = z.object({
  labelId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(80).optional(),
  colorHex: colorHexSchema.optional(),
  archive: z.boolean().optional(),
});

// --- Task Schemas (P2-TASK-02..05) ---

export const createTaskSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  parentTaskId: z.coerce.number().int().positive().nullable().optional(),
  columnId: z.coerce.number().int().positive().optional(),
  sprintId: z.coerce.number().int().positive().nullable().optional(),
  milestoneId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(2, 'Tiêu đề công việc tối thiểu 2 ký tự').max(255),
  description: z.string().max(20000).nullable().optional(),
  taskType: z.enum(['EPIC', 'TASK', 'BUG', 'FEATURE', 'IMPROVEMENT']).default('TASK'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  startDate: isoDateString,
  dueDate: isoDateString,
  estimatedHours: z.coerce.number().min(0).max(9999).default(0),
  storyPoints: z.coerce.number().min(0).max(500).nullable().optional(),
  assigneeEmployeeIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
  watcherEmployeeIds: z.array(z.coerce.number().int().positive()).max(30).optional(),
  labelIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
});

export const updateTaskSchema = z.object({
  parentTaskId: z.coerce.number().int().positive().nullable().optional(),
  columnId: z.coerce.number().int().positive().optional(),
  sprintId: z.coerce.number().int().positive().nullable().optional(),
  milestoneId: z.coerce.number().int().positive().nullable().optional(),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().max(20000).nullable().optional(),
  taskType: z.enum(['EPIC', 'TASK', 'BUG', 'FEATURE', 'IMPROVEMENT']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  startDate: isoDateString,
  dueDate: isoDateString,
  estimatedHours: z.coerce.number().min(0).max(9999).optional(),
  storyPoints: z.coerce.number().min(0).max(500).nullable().optional(),
  progressPercent: z.coerce.number().int().min(0).max(100).optional(),
  isBlocked: z.boolean().optional(),
  blockedReason: z.string().trim().max(500).nullable().optional(),
  assigneeEmployeeIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
  watcherEmployeeIds: z.array(z.coerce.number().int().positive()).max(30).optional(),
  labelIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const moveTaskSchema = z.object({
  targetColumnId: z.coerce.number().int().positive(),
  prevRank: z.string().max(64).nullable().optional(),
  nextRank: z.string().max(64).nullable().optional(),
  sprintId: z.coerce.number().int().positive().nullable().optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const createChecklistSchema = z.object({
  title: z.string().trim().min(1).max(255),
  assigneeEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  dueDate: isoDateString,
});

export const updateChecklistSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  isCompleted: z.boolean().optional(),
  assigneeEmployeeId: z.coerce.number().int().positive().nullable().optional(),
  dueDate: isoDateString,
  archive: z.boolean().optional(),
});

export const createDependencySchema = z.object({
  predecessorTaskId: z.coerce.number().int().positive(),
  dependencyType: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
  lagDays: z.coerce.number().int().min(-365).max(365).default(0),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Nội dung bình luận không được để trống').max(5000),
  parentCommentId: z.coerce.number().int().positive().nullable().optional(),
  mentionedEmployeeIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000).optional(),
  isResolved: z.boolean().optional(),
  archive: z.boolean().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type TransitionProjectStatusInput = z.infer<typeof transitionProjectStatusSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>;
export type CreateBoardColumnInput = z.infer<typeof createBoardColumnSchema>;
export type UpdateBoardColumnInput = z.infer<typeof updateBoardColumnSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
