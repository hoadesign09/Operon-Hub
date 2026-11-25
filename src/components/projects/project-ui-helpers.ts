import type {
  ProjectHealthStatus,
  ProjectMemberRole,
  ProjectMethodology,
  ProjectPriority,
  ProjectStatus,
  ProjectVisibility,
  TaskPriority,
  TaskStatusCategory,
  TaskType,
} from '@/config/database';
import type { AppLocale } from '@/shared/i18n/config';

interface LabelMeta {
  vi: string;
  en: string;
  cls: string;
}

export const PROJECT_STATUS_META: Record<ProjectStatus, LabelMeta> = {
  DRAFT: { vi: 'Nháp', en: 'Draft', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  PENDING_APPROVAL: {
    vi: 'Chờ duyệt Charter',
    en: 'Pending Charter',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  PLANNING: {
    vi: 'Đang lập kế hoạch',
    en: 'Planning',
    cls: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  ACTIVE: {
    vi: 'Đang triển khai',
    en: 'Active',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  ON_HOLD: {
    vi: 'Tạm dừng',
    en: 'On Hold',
    cls: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  COMPLETED: {
    vi: 'Hoàn thành',
    en: 'Completed',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  CANCELLED: {
    vi: 'Đã hủy',
    en: 'Cancelled',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  ARCHIVED: {
    vi: 'Đã lưu trữ',
    en: 'Archived',
    cls: 'bg-slate-200 text-slate-600 border-slate-300',
  },
};

export const PROJECT_HEALTH_META: Record<ProjectHealthStatus, LabelMeta> = {
  ON_TRACK: { vi: 'Đúng tiến độ', en: 'On Track', cls: 'bg-emerald-50 text-emerald-700' },
  AT_RISK: { vi: 'Có rủi ro', en: 'At Risk', cls: 'bg-amber-50 text-amber-700' },
  OFF_TRACK: { vi: 'Chậm tiến độ', en: 'Off Track', cls: 'bg-rose-50 text-rose-700' },
};

export const PROJECT_PRIORITY_META: Record<ProjectPriority, LabelMeta> = {
  LOW: { vi: 'Thấp', en: 'Low', cls: 'bg-slate-100 text-slate-600' },
  MEDIUM: { vi: 'Trung bình', en: 'Medium', cls: 'bg-blue-50 text-blue-700' },
  HIGH: { vi: 'Cao', en: 'High', cls: 'bg-amber-50 text-amber-700' },
  CRITICAL: { vi: 'Khẩn cấp', en: 'Critical', cls: 'bg-rose-50 text-rose-700' },
};

export const PROJECT_METHODOLOGY_META: Record<ProjectMethodology, { vi: string; en: string }> = {
  KANBAN: { vi: 'Kanban', en: 'Kanban' },
  SCRUM: { vi: 'Agile Scrum', en: 'Agile Scrum' },
  WATERFALL: { vi: 'Waterfall', en: 'Waterfall' },
  HYBRID: { vi: 'Hybrid', en: 'Hybrid' },
};

export const PROJECT_VISIBILITY_META: Record<ProjectVisibility, { vi: string; en: string }> = {
  PUBLIC_COMPANY: { vi: 'Toàn công ty', en: 'Company-wide' },
  BRANCH: { vi: 'Nội bộ chi nhánh', en: 'Branch-only' },
  DEPARTMENT: { vi: 'Nội bộ phòng ban', en: 'Department-only' },
  PRIVATE_INVITE: { vi: 'Riêng tư (Chỉ thành viên)', en: 'Private (Invite only)' },
};

export const PROJECT_ROLE_META: Record<ProjectMemberRole, LabelMeta> = {
  PROJECT_OWNER: { vi: 'Chủ dự án (Owner)', en: 'Project Owner', cls: 'bg-indigo-50 text-indigo-700' },
  PROJECT_MANAGER: { vi: 'Quản lý dự án (PM)', en: 'Project Manager', cls: 'bg-blue-50 text-blue-700' },
  TEAM_LEAD: { vi: 'Trưởng nhóm', en: 'Team Lead', cls: 'bg-cyan-50 text-cyan-700' },
  MEMBER: { vi: 'Thành viên', en: 'Member', cls: 'bg-slate-100 text-slate-700' },
  VIEWER: { vi: 'Theo dõi (Viewer)', en: 'Viewer', cls: 'bg-slate-50 text-slate-500' },
};

export const TASK_PRIORITY_META: Record<TaskPriority, LabelMeta> = {
  LOW: { vi: 'Thấp', en: 'Low', cls: 'bg-slate-100 text-slate-600' },
  MEDIUM: { vi: 'Trung bình', en: 'Medium', cls: 'bg-blue-50 text-blue-700' },
  HIGH: { vi: 'Cao', en: 'High', cls: 'bg-amber-50 text-amber-700' },
  URGENT: { vi: 'Khẩn cấp', en: 'Urgent', cls: 'bg-rose-100 text-rose-700' },
};

export const TASK_TYPE_META: Record<TaskType, LabelMeta> = {
  EPIC: { vi: 'Epic', en: 'Epic', cls: 'bg-purple-50 text-purple-700' },
  FEATURE: { vi: 'Tính năng', en: 'Feature', cls: 'bg-blue-50 text-blue-700' },
  TASK: { vi: 'Công việc', en: 'Task', cls: 'bg-slate-100 text-slate-700' },
  BUG: { vi: 'Lỗi (Bug)', en: 'Bug', cls: 'bg-rose-50 text-rose-700' },
  IMPROVEMENT: { vi: 'Cải tiến', en: 'Improvement', cls: 'bg-teal-50 text-teal-700' },
};

export const STATUS_CATEGORY_META: Record<TaskStatusCategory, LabelMeta> = {
  TODO: { vi: 'Chờ làm', en: 'To Do', cls: 'bg-slate-100 text-slate-700' },
  IN_PROGRESS: { vi: 'Đang làm', en: 'In Progress', cls: 'bg-amber-50 text-amber-700' },
  IN_REVIEW: { vi: 'Chờ duyệt', en: 'In Review', cls: 'bg-violet-50 text-violet-700' },
  BLOCKED: { vi: 'Bị chặn', en: 'Blocked', cls: 'bg-rose-50 text-rose-700' },
  DONE: { vi: 'Hoàn thành', en: 'Done', cls: 'bg-emerald-50 text-emerald-700' },
};

export const PROJECT_COLOR_PRESETS = [
  '#2563EB',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#475569',
] as const;

export function pickLabel(meta: { vi: string; en: string }, locale: AppLocale): string {
  return locale === 'en' ? meta.en : meta.vi;
}
