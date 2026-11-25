import type {
  ProjectHealthStatus,
  ProjectMemberRole,
  ProjectMethodology,
  ProjectPriority,
  ProjectStatus,
  ProjectVisibility,
  TaskDependencyType,
  TaskPriority,
  TaskStatusCategory,
  TaskType,
} from '@/config/database';

export const PROJECT_CHARTER_ENTITY_TYPE = 'projects';
export const PROJECT_CHARTER_REQUEST_TYPE = 'PM_PROJECT_CHARTER';
export const PROJECT_MILESTONE_ENTITY_TYPE = 'project_milestones';
export const PROJECT_MILESTONE_REQUEST_TYPE = 'PM_MILESTONE_SIGNOFF';
export const PROJECT_BUDGET_ENTITY_TYPE = 'project_budget_items';
export const PROJECT_BUDGET_REQUEST_TYPE = 'PM_BUDGET_CHANGE';
export const MAX_RUNNING_TIMER_WARNING_HOURS = 12;
export const DEFAULT_DAILY_WORK_CAPACITY_HOURS = 8;
export const MAX_AUTOMATION_DEPTH = 1;

export const PROJECT_METHODOLOGIES: readonly ProjectMethodology[] = [
  'KANBAN',
  'SCRUM',
  'WATERFALL',
  'HYBRID',
];

export const PROJECT_VISIBILITIES: readonly ProjectVisibility[] = [
  'PUBLIC_COMPANY',
  'BRANCH',
  'DEPARTMENT',
  'PRIVATE_INVITE',
];

export const PROJECT_PRIORITIES: readonly ProjectPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
];

export const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
];

export const PROJECT_HEALTH_STATUSES: readonly ProjectHealthStatus[] = [
  'ON_TRACK',
  'AT_RISK',
  'OFF_TRACK',
];

export const PROJECT_MEMBER_ROLES: readonly ProjectMemberRole[] = [
  'PROJECT_OWNER',
  'PROJECT_MANAGER',
  'TEAM_LEAD',
  'MEMBER',
  'VIEWER',
];

export const PROJECT_ADMIN_ROLES: readonly ProjectMemberRole[] = [
  'PROJECT_OWNER',
  'PROJECT_MANAGER',
];

export const PROJECT_CONTRIBUTOR_ROLES: readonly ProjectMemberRole[] = [
  'PROJECT_OWNER',
  'PROJECT_MANAGER',
  'TEAM_LEAD',
  'MEMBER',
];

export const TASK_STATUS_CATEGORIES: readonly TaskStatusCategory[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'DONE',
];

export const TASK_TYPES: readonly TaskType[] = [
  'EPIC',
  'TASK',
  'BUG',
  'FEATURE',
  'IMPROVEMENT',
];

export const TASK_PRIORITIES: readonly TaskPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

export const TASK_DEPENDENCY_TYPES: readonly TaskDependencyType[] = [
  'FS',
  'SS',
  'FF',
  'SF',
];

export const MAX_TASK_HIERARCHY_DEPTH = 3;

export const ALLOWED_PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'PLANNING', 'ACTIVE', 'CANCELLED'],
  PENDING_APPROVAL: ['PLANNING', 'DRAFT', 'CANCELLED'],
  PLANNING: ['ACTIVE', 'ON_HOLD', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  COMPLETED: ['ARCHIVED', 'ACTIVE'],
  CANCELLED: ['ARCHIVED', 'DRAFT'],
  ARCHIVED: ['ACTIVE'],
};

export interface DefaultBoardColumnSeed {
  code: string;
  name: string;
  nameEn: string;
  statusCategory: TaskStatusCategory;
  colorHex: string;
  wipLimit: number | null;
  sortOrder: number;
  isDefaultInitial: number;
  isDoneColumn: number;
}

export const DEFAULT_PROJECT_BOARD_COLUMNS: readonly DefaultBoardColumnSeed[] = [
  {
    code: 'BACKLOG',
    name: 'Backlog',
    nameEn: 'Backlog',
    statusCategory: 'TODO',
    colorHex: '#64748B',
    wipLimit: null,
    sortOrder: 0,
    isDefaultInitial: 0,
    isDoneColumn: 0,
  },
  {
    code: 'TODO',
    name: 'Cần làm',
    nameEn: 'To Do',
    statusCategory: 'TODO',
    colorHex: '#3B82F6',
    wipLimit: null,
    sortOrder: 1,
    isDefaultInitial: 1,
    isDoneColumn: 0,
  },
  {
    code: 'IN_PROGRESS',
    name: 'Đang thực hiện',
    nameEn: 'In Progress',
    statusCategory: 'IN_PROGRESS',
    colorHex: '#F59E0B',
    wipLimit: 5,
    sortOrder: 2,
    isDefaultInitial: 0,
    isDoneColumn: 0,
  },
  {
    code: 'IN_REVIEW',
    name: 'Chờ duyệt / Review',
    nameEn: 'In Review',
    statusCategory: 'IN_REVIEW',
    colorHex: '#8B5CF6',
    wipLimit: 4,
    sortOrder: 3,
    isDefaultInitial: 0,
    isDoneColumn: 0,
  },
  {
    code: 'DONE',
    name: 'Hoàn thành',
    nameEn: 'Done',
    statusCategory: 'DONE',
    colorHex: '#10B981',
    wipLimit: null,
    sortOrder: 4,
    isDefaultInitial: 0,
    isDoneColumn: 1,
  },
];

export const DEFAULT_PROJECT_LABELS: ReadonlyArray<{ name: string; colorHex: string }> = [
  { name: 'Feature', colorHex: '#2563EB' },
  { name: 'Bug', colorHex: '#EF4444' },
  { name: 'Urgent', colorHex: '#F97316' },
  { name: 'Documentation', colorHex: '#0EA5E9' },
];

export const MAX_TASK_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_TASK_ATTACHMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
};
