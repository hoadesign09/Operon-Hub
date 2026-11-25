import { z } from 'zod';

const isoDateOptional = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng ngày phải là YYYY-MM-DD')
  .nullable()
  .optional();

// --- Sprints (P2-TASK-06) ---
export const createSprintSchema = z.object({
  name: z.string().trim().min(2).max(150),
  goal: z.string().trim().max(1000).nullable().optional(),
  startDate: isoDateOptional,
  endDate: isoDateOptional,
});

export const updateSprintSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  goal: z.string().trim().max(1000).nullable().optional(),
  startDate: isoDateOptional,
  endDate: isoDateOptional,
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

export const startSprintSchema = z.object({
  startDate: isoDateOptional,
  endDate: isoDateOptional,
});

export const completeSprintSchema = z.object({
  carryoverAction: z.enum(['BACKLOG', 'NEXT_SPRINT']).default('BACKLOG'),
  targetSprintId: z.number().int().positive().nullable().optional(),
});

// --- Milestones & Gantt (P2-TASK-07) ---
export const createMilestoneSchema = z.object({
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1500).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requiresSignoff: z.boolean().default(false),
  ownerEmployeeId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateMilestoneSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().max(1500).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z
    .enum(['UPCOMING', 'IN_PROGRESS', 'PENDING_SIGNOFF', 'COMPLETED', 'DELAYED', 'CANCELLED'])
    .optional(),
  requiresSignoff: z.boolean().optional(),
  ownerEmployeeId: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const rescheduleGanttTaskSchema = z.object({
  taskId: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autoShift: z.boolean().default(true),
});

// --- Time Tracking & Timesheets (P2-TASK-08) ---
export const startTimerSchema = z.object({
  taskId: z.number().int().positive(),
  description: z.string().trim().max(500).nullable().optional(),
  isBillable: z.boolean().default(true),
});

export const stopTimerSchema = z.object({
  logId: z.number().int().positive().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const createManualTimeLogSchema = z.object({
  taskId: z.number().int().positive(),
  loggedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(1).max(1440),
  isBillable: z.boolean().default(true),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateTimeLogSchema = z.object({
  loggedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  isBillable: z.boolean().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const submitWeekTimesheetSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.number().int().positive().optional(),
});

export const reviewTimeLogsSchema = z.object({
  logIds: z.array(z.number().int().positive()).min(1).max(200),
  decision: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().trim().max(500).nullable().optional(),
});

// --- Budget & RAID (P2-TASK-10) ---
export const createBudgetItemSchema = z.object({
  category: z.enum(['LABOR', 'VENDOR', 'INFRA', 'SOFTWARE', 'TRAVEL', 'OTHER']),
  title: z.string().trim().min(2).max(200),
  plannedAmount: z.number().min(0).max(999999999999),
  actualAmount: z.number().min(0).max(999999999999).default(0),
  incurredDate: isoDateOptional,
  status: z.enum(['PLANNED', 'PENDING_APPROVAL', 'APPROVED', 'SPENT', 'CANCELLED']).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const updateBudgetItemSchema = z.object({
  category: z.enum(['LABOR', 'VENDOR', 'INFRA', 'SOFTWARE', 'TRAVEL', 'OTHER']).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  plannedAmount: z.number().min(0).max(999999999999).optional(),
  actualAmount: z.number().min(0).max(999999999999).optional(),
  incurredDate: isoDateOptional,
  status: z.enum(['PLANNED', 'PENDING_APPROVAL', 'APPROVED', 'SPENT', 'CANCELLED']).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const createRiskSchema = z.object({
  itemType: z.enum(['RISK', 'ISSUE']).default('RISK'),
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().max(3000).nullable().optional(),
  probability: z.number().int().min(1).max(5).default(3),
  impact: z.number().int().min(1).max(5).default(3),
  ownerEmployeeId: z.number().int().positive().nullable().optional(),
  mitigationPlan: z.string().trim().max(3000).nullable().optional(),
  identifiedDate: isoDateOptional,
});

export const updateRiskSchema = z.object({
  itemType: z.enum(['RISK', 'ISSUE']).optional(),
  title: z.string().trim().min(2).max(255).optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  status: z.enum(['OPEN', 'MITIGATING', 'ESCALATED', 'RESOLVED', 'CLOSED']).optional(),
  ownerEmployeeId: z.number().int().positive().nullable().optional(),
  mitigationPlan: z.string().trim().max(3000).nullable().optional(),
});

// --- Templates, Recurrences & Automations (P2-TASK-11) ---
export const templateColumnSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().max(120).nullable().optional(),
  statusCategory: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']),
  colorHex: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
  wipLimit: z.number().int().positive().nullable().optional(),
  isDefaultInitial: z.boolean().optional(),
  isDoneColumn: z.boolean().optional(),
});

export const templateTaskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).nullable().optional(),
  taskType: z.enum(['EPIC', 'TASK', 'BUG', 'FEATURE', 'IMPROVEMENT']).default('TASK'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  columnCode: z.string().trim().min(1).max(40).optional(),
  startOffsetDays: z.number().int().min(0).max(730).default(0),
  durationDays: z.number().int().min(1).max(365).default(3),
  estimatedHours: z.number().min(0).max(1000).default(4),
  checklists: z.array(z.string().trim().min(1).max(200)).optional(),
});

export const createProjectTemplateSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(180),
  nameEn: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(1500).nullable().optional(),
  branchId: z.number().int().positive().nullable().optional(),
  methodology: z.enum(['KANBAN', 'SCRUM', 'WATERFALL', 'HYBRID']).default('KANBAN'),
  columns: z.array(templateColumnSchema).min(2).max(12),
  tasks: z.array(templateTaskSchema).max(100).default([]),
});

export const saveAsTemplateSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(180),
  nameEn: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(1500).nullable().optional(),
  isCompanyWide: z.boolean().default(true),
});

export const updateProjectTemplateSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  nameEn: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(1500).nullable().optional(),
  methodology: z.enum(['KANBAN', 'SCRUM', 'WATERFALL', 'HYBRID']).optional(),
  isActive: z.boolean().optional(),
});

export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(2).max(180),
  triggerEvent: z.enum(['TASK_MOVED_COLUMN', 'TASK_OVERDUE', 'ALL_SUBTASKS_DONE', 'TASK_ASSIGNED']),
  condition: z.record(z.string(), z.unknown()).nullable().optional(),
  actionType: z.enum(['NOTIFY_PM', 'MOVE_COLUMN', 'SET_BLOCKED', 'ADD_WATCHER']),
  actionPayload: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateAutomationRuleSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  condition: z.record(z.string(), z.unknown()).nullable().optional(),
  actionPayload: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createRecurrenceRuleSchema = z.object({
  templateTaskId: z.number().int().positive(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  intervalValue: z.number().int().min(1).max(30).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(28).nullable().optional(),
  nextRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: isoDateOptional,
});

export const updateRecurrenceRuleSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  intervalValue: z.number().int().min(1).max(30).optional(),
  nextRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: isoDateOptional,
  isActive: z.boolean().optional(),
});

export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
export type StartSprintInput = z.infer<typeof startSprintSchema>;
export type CompleteSprintInput = z.infer<typeof completeSprintSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type RescheduleGanttTaskInput = z.infer<typeof rescheduleGanttTaskSchema>;
export type StartTimerInput = z.infer<typeof startTimerSchema>;
export type StopTimerInput = z.infer<typeof stopTimerSchema>;
export type CreateManualTimeLogInput = z.infer<typeof createManualTimeLogSchema>;
export type UpdateTimeLogInput = z.infer<typeof updateTimeLogSchema>;
export type SubmitWeekTimesheetInput = z.infer<typeof submitWeekTimesheetSchema>;
export type ReviewTimeLogsInput = z.infer<typeof reviewTimeLogsSchema>;
export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemSchema>;
export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;
export type CreateProjectTemplateInput = z.infer<typeof createProjectTemplateSchema>;
export type SaveAsTemplateInput = z.infer<typeof saveAsTemplateSchema>;
export type UpdateProjectTemplateInput = z.infer<typeof updateProjectTemplateSchema>;
export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;
export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;
export type CreateRecurrenceRuleInput = z.infer<typeof createRecurrenceRuleSchema>;
export type UpdateRecurrenceRuleInput = z.infer<typeof updateRecurrenceRuleSchema>;
