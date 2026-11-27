import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, { type Connection } from 'mysql2/promise';
import { parseServerEnv } from '@/config/env';
import { hashPassword } from '@/lib/portable/password-hasher';
import {
  DEFAULT_PROPOSAL_CATEGORIES,
  PROPOSAL_DEFAULT_REQUEST_TYPE,
  PROPOSAL_ENTITY_TYPE,
  PROPOSAL_HIGH_VALUE_THRESHOLD_VND,
  PROPOSAL_MODULE_CODE,
} from '@/modules/proposals/proposals.constants';
import {
  DEFAULT_IT_REQUEST_CATEGORIES,
  IT_REQUEST_ACCESS_SOFTWARE_TYPE,
  IT_REQUEST_ENTITY_TYPE,
  IT_REQUEST_HARDWARE_TYPE,
  IT_REQUEST_MODULE_CODE,
} from '@/modules/it-requests/it-requests.constants';
import {
  DEFAULT_PAYMENT_CATEGORIES,
  PAYMENT_DEFAULT_REQUEST_TYPE,
  PAYMENT_ENTITY_TYPE,
  PAYMENT_HIGH_VALUE_THRESHOLD_VND,
  PAYMENT_MODULE_CODE,
} from '@/modules/payments/payments.constants';
import { DEFAULT_PAYMENT_BUDGETS_2026 } from '@/modules/payments/budgets.constants';
import { assertLocalDevEnvironment } from './migrator';

const DEFAULT_ADMIN_EMAIL = 'admin@operonhub.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123456';
const DEFAULT_ADMIN_NAME = 'Quản trị Hệ thống';

const SYSTEM_ROLES = [
  { code: 'SUPER_ADMIN', name: 'Quản trị Hệ thống', nameEn: 'System Administrator', dataScope: 'ALL', description: 'Toàn quyền quản trị hệ thống Operon Hub' },
  { code: 'EXECUTIVE', name: 'Ban Giám đốc', nameEn: 'Executive Board', dataScope: 'ALL', description: 'Xem báo cáo tổng quan và duyệt cấp cao' },
  { code: 'HR_MANAGER', name: 'Trưởng phòng Nhân sự', nameEn: 'HR Manager', dataScope: 'ALL', description: 'Quản trị toàn diện phân hệ HRM' },
  { code: 'HR_STAFF', name: 'Chuyên viên Nhân sự', nameEn: 'HR Specialist', dataScope: 'BRANCH', description: 'Vận hành hồ sơ nhân sự và chấm công tại chi nhánh' },
  { code: 'PAYROLL_ACCOUNTANT', name: 'Kế toán Lương (C&B)', nameEn: 'Payroll Accountant (C&B)', dataScope: 'ALL', description: 'Quản lý bảng công và tính lương toàn công ty' },
  { code: 'ADMIN_OPS', name: 'Hành chính Văn phòng', nameEn: 'Office Operations', dataScope: 'BRANCH', description: 'Quản lý tài sản, phòng họp và thông báo nội bộ' },
  { code: 'DEPT_MANAGER', name: 'Trưởng Bộ phận', nameEn: 'Department Manager', dataScope: 'DEPARTMENT', description: 'Quản lý nhân sự và phê duyệt đơn từ trong phòng ban' },
  { code: 'EMPLOYEE', name: 'Nhân viên', nameEn: 'Employee', dataScope: 'OWN', description: 'Cổng nhân viên tự phục vụ (ESS)' },
  { code: 'PMO_MANAGER', name: 'Trưởng ban Quản lý Dự án (PMO)', nameEn: 'PMO Manager', dataScope: 'ALL', description: 'Quản trị toàn diện danh mục dự án, nguồn lực, ngân sách và báo cáo Phase 2' },
  { code: 'IT_SUPPORT', name: 'Kỹ thuật viên IT (Helpdesk)', nameEn: 'IT Support Specialist', dataScope: 'ALL', description: 'Tiếp nhận, phân công và xử lý toàn bộ yêu cầu hỗ trợ IT, SLA và danh mục kỹ thuật' },
  { code: 'FINANCE_ACCOUNTANT', name: 'Kế toán Thanh toán', nameEn: 'Finance Accountant', dataScope: 'ALL', description: 'Kiểm soát chứng từ, phê duyệt tài chính và giải ngân đề nghị thanh toán/tạm ứng' },
] as const;

const BASELINE_PERMISSIONS = [
  { moduleCode: 'core', code: 'core.branches.read', name: 'Xem danh sách chi nhánh', nameEn: 'View branch directory' },
  { moduleCode: 'core', code: 'core.branches.create', name: 'Tạo chi nhánh mới', nameEn: 'Create branch' },
  { moduleCode: 'core', code: 'core.branches.update', name: 'Cập nhật chi nhánh', nameEn: 'Update branch' },
  { moduleCode: 'core', code: 'core.branches.delete', name: 'Xóa mềm chi nhánh', nameEn: 'Archive branch' },
  { moduleCode: 'core', code: 'core.users.read', name: 'Xem danh sách tài khoản', nameEn: 'View user accounts' },
  { moduleCode: 'core', code: 'core.users.create', name: 'Tạo tài khoản người dùng', nameEn: 'Create user account' },
  { moduleCode: 'core', code: 'core.users.update', name: 'Cập nhật tài khoản & gán vai trò', nameEn: 'Update user account & assign roles' },
  { moduleCode: 'core', code: 'core.roles.read', name: 'Xem vai trò & ma trận phân quyền', nameEn: 'View roles & permission matrix' },
  { moduleCode: 'core', code: 'core.roles.update', name: 'Cập nhật phân quyền cho vai trò', nameEn: 'Update role permissions' },
  { moduleCode: 'core', code: 'core.audit_logs.read', name: 'Xem nhật ký kiểm toán hệ thống', nameEn: 'View system audit logs' },
  { moduleCode: 'core', code: 'core.settings.read', name: 'Xem cấu hình hệ thống', nameEn: 'View system settings' },
  { moduleCode: 'core', code: 'core.settings.update', name: 'Cập nhật cấu hình hệ thống', nameEn: 'Update system settings' },
  { moduleCode: 'core', code: 'core.approvals.read', name: 'Xem hộp thư phê duyệt & luồng duyệt', nameEn: 'View approval inbox & workflows' },
  { moduleCode: 'core', code: 'core.approvals.act', name: 'Phê duyệt hoặc từ chối đơn yêu cầu', nameEn: 'Approve or reject requests' },
  { moduleCode: 'core', code: 'core.approvals.workflow_manage', name: 'Cấu hình quy trình duyệt đa cấp', nameEn: 'Configure multi-step approval workflows' },
  { moduleCode: 'hrm', code: 'hrm.dashboard.read', name: 'Xem tổng quan Hành chính Nhân sự', nameEn: 'View HRM overview dashboard' },
  { moduleCode: 'hrm', code: 'hrm.org.read', name: 'Xem cơ cấu tổ chức, phòng ban & chức danh', nameEn: 'View organization chart, departments & positions' },
  { moduleCode: 'hrm', code: 'hrm.org.manage', name: 'Quản trị phòng ban & danh mục chức danh', nameEn: 'Manage departments & job positions' },
  { moduleCode: 'hrm', code: 'hrm.employees.read', name: 'Xem hồ sơ nhân viên (theo Data Scope)', nameEn: 'View employee profiles (by Data Scope)' },
  { moduleCode: 'hrm', code: 'hrm.employees.create', name: 'Thêm mới hồ sơ nhân viên', nameEn: 'Create employee profile' },
  { moduleCode: 'hrm', code: 'hrm.employees.update', name: 'Cập nhật hồ sơ nhân viên & tài liệu', nameEn: 'Update employee profile & documents' },
  { moduleCode: 'hrm', code: 'hrm.employees.delete', name: 'Xóa mềm hồ sơ nhân viên', nameEn: 'Archive employee profile' },
  { moduleCode: 'hrm', code: 'hrm.employees.export', name: 'Xuất danh sách nhân viên ra Excel', nameEn: 'Export employee directory to Excel' },
  { moduleCode: 'hrm', code: 'hrm.contracts.read', name: 'Xem hợp đồng lao động & quá trình công tác', nameEn: 'View labor contracts & work history' },
  { moduleCode: 'hrm', code: 'hrm.contracts.manage', name: 'Quản trị hợp đồng lao động & quyết định công tác', nameEn: 'Manage labor contracts & career decisions' },
  { moduleCode: 'hrm', code: 'hrm.contracts.export', name: 'Xuất danh sách hợp đồng lao động ra Excel', nameEn: 'Export labor contracts to Excel' },
  { moduleCode: 'hrm', code: 'hrm.requests.read', name: 'Xem đơn từ nghỉ phép & quỹ phép (theo Data Scope)', nameEn: 'View leave requests & balances (by Data Scope)' },
  { moduleCode: 'hrm', code: 'hrm.requests.create', name: 'Tạo & gửi đơn nghỉ phép/đơn từ cá nhân (ESS)', nameEn: 'Create & submit personal requests (ESS)' },
  { moduleCode: 'hrm', code: 'hrm.requests.manage', name: 'Quản trị loại phép, khởi tạo & điều chỉnh quỹ phép năm', nameEn: 'Manage leave types & annual leave balances' },
  { moduleCode: 'hrm', code: 'hrm.requests.export', name: 'Xuất danh sách đơn từ nghỉ phép ra Excel', nameEn: 'Export leave requests to Excel' },
  { moduleCode: 'hrm', code: 'hrm.attendance.read', name: 'Xem ca làm việc, ngày lễ & bảng chấm công theo Data Scope', nameEn: 'View work shifts, holidays & attendance logs' },
  { moduleCode: 'hrm', code: 'hrm.attendance.manage', name: 'Quản trị ca làm việc, phân ca, ngày lễ & chỉnh sửa chấm công', nameEn: 'Manage work shifts, assignments, holidays & attendance' },
  { moduleCode: 'hrm', code: 'hrm.attendance.import', name: 'Import dữ liệu chấm công từ file Excel', nameEn: 'Import attendance logs from Excel' },
  { moduleCode: 'hrm', code: 'hrm.attendance.lock', name: 'Chốt & mở khóa bảng công tháng', nameEn: 'Lock & unlock monthly timesheets' },
  { moduleCode: 'hrm', code: 'hrm.attendance.export', name: 'Xuất dữ liệu chấm công ra Excel', nameEn: 'Export attendance data to Excel' },
  { moduleCode: 'hrm', code: 'hrm.payroll.read', name: 'Xem kỳ lương, bảng tính lương và cấu hình thuế/bảo hiểm', nameEn: 'View payroll periods, payslips & tax/SI config' },
  { moduleCode: 'hrm', code: 'hrm.payroll.manage', name: 'Tạo kỳ lương, chạy tính lương, chỉnh thưởng/khấu trừ & cấu hình lương', nameEn: 'Run payroll, adjust bonuses/deductions & config' },
  { moduleCode: 'hrm', code: 'hrm.payroll.approve', name: 'Phê duyệt, mở lại & xác nhận chi trả kỳ lương', nameEn: 'Approve, reopen & confirm payroll payout' },
  { moduleCode: 'hrm', code: 'hrm.payroll.export', name: 'Xuất bảng lương tổng Excel & phiếu lương PDF', nameEn: 'Export payroll Excel & payslip PDF' },
  { moduleCode: 'hrm', code: 'hrm.assets.read', name: 'Xem kho tài sản & lịch sử cấp phát theo Data Scope', nameEn: 'View asset inventory & assignment history' },
  { moduleCode: 'hrm', code: 'hrm.assets.manage', name: 'Quản trị danh mục tài sản, cấp phát, thu hồi & bảo trì', nameEn: 'Manage assets, handovers, returns & maintenance' },
  { moduleCode: 'hrm', code: 'hrm.assets.export', name: 'Xuất danh sách tài sản Excel & biên bản bàn giao PDF', nameEn: 'Export asset Excel & handover PDF' },
  { moduleCode: 'hrm', code: 'hrm.rooms.read', name: 'Xem danh sách phòng họp & lịch đặt phòng', nameEn: 'View meeting rooms & booking schedule' },
  { moduleCode: 'hrm', code: 'hrm.rooms.book', name: 'Đặt lịch phòng họp & quản lý lịch họp cá nhân', nameEn: 'Book meeting rooms & manage own bookings' },
  { moduleCode: 'hrm', code: 'hrm.rooms.manage', name: 'Quản trị phòng họp & điều phối toàn bộ lịch đặt phòng', nameEn: 'Manage meeting rooms & coordinate all bookings' },
  { moduleCode: 'hrm', code: 'hrm.announcements.read', name: 'Đọc bản tin & thông báo nội bộ', nameEn: 'Read company announcements & news' },
  { moduleCode: 'hrm', code: 'hrm.announcements.manage', name: 'Soạn thảo, xuất bản, ghim & thống kê thông báo nội bộ', nameEn: 'Draft, publish, pin & track company announcements' },
  { moduleCode: 'projects', code: 'pm.dashboard.read', name: 'Xem tổng quan Danh mục Dự án', nameEn: 'View Project Portfolio dashboard' },
  { moduleCode: 'projects', code: 'pm.projects.read', name: 'Xem danh sách và chi tiết dự án trong phạm vi', nameEn: 'View project list and details within scope' },
  { moduleCode: 'projects', code: 'pm.projects.create', name: 'Khởi tạo dự án mới và gửi duyệt Charter', nameEn: 'Create projects and submit Charter for approval' },
  { moduleCode: 'projects', code: 'pm.projects.manage', name: 'Quản trị toàn diện danh mục dự án, lưu trữ và chuyển PM', nameEn: 'Manage project portfolio, archiving & PM handover' },
  { moduleCode: 'projects', code: 'pm.tasks.read', name: 'Xem công việc trong dự án và Công việc của tôi', nameEn: 'View project tasks and My Tasks' },
  { moduleCode: 'projects', code: 'pm.tasks.create', name: 'Tạo Task, Subtask, Checklist và Dependency', nameEn: 'Create tasks, subtasks, checklists & dependencies' },
  { moduleCode: 'projects', code: 'pm.tasks.update', name: 'Cập nhật trạng thái, tiến độ, bình luận và đính kèm Task', nameEn: 'Update task status, progress, comments & files' },
  { moduleCode: 'projects', code: 'pm.tasks.delete', name: 'Xóa mềm hoặc lưu trữ Task', nameEn: 'Archive or soft-delete tasks' },
  { moduleCode: 'projects', code: 'pm.sprints.manage', name: 'Quản trị Sprint và sắp xếp Backlog', nameEn: 'Manage Sprints and Backlog prioritization' },
  { moduleCode: 'projects', code: 'pm.timelogs.log', name: 'Ghi nhận giờ công trên công việc', nameEn: 'Log work hours on project tasks' },
  { moduleCode: 'projects', code: 'pm.timelogs.approve', name: 'Xem và phê duyệt Timesheet nhóm/dự án', nameEn: 'Review and approve team/project timesheets' },
  { moduleCode: 'projects', code: 'pm.workload.read', name: 'Xem bản đồ phân bổ nguồn lực (Workload Heatmap)', nameEn: 'View Resource Workload Heatmap' },
  { moduleCode: 'projects', code: 'pm.budget.read', name: 'Xem ngân sách và chi phí dự án', nameEn: 'View project budget and cost tracking' },
  { moduleCode: 'projects', code: 'pm.budget.manage', name: 'Quản trị ngân sách, chi phí và đề xuất điều chỉnh', nameEn: 'Manage project budget, expenses & change requests' },
  { moduleCode: 'projects', code: 'pm.risks.manage', name: 'Quản trị Rủi ro và Vấn đề dự án (RAID)', nameEn: 'Manage Project Risks & Issues (RAID)' },
  { moduleCode: 'projects', code: 'pm.templates.manage', name: 'Quản trị Mẫu Dự án và Luật tự động hóa', nameEn: 'Manage Project Templates & Automation Rules' },
  { moduleCode: 'projects', code: 'pm.reports.export', name: 'Xuất báo cáo Dự án ra Excel và PDF', nameEn: 'Export Project reports to Excel and PDF' },
  { moduleCode: 'proposals', code: 'proposals.read', name: 'Xem đề xuất nội bộ trong phạm vi', nameEn: 'View internal proposals within scope' },
  { moduleCode: 'proposals', code: 'proposals.create', name: 'Tạo, sửa nháp và gửi duyệt đề xuất nội bộ', nameEn: 'Create, edit draft & submit internal proposals' },
  { moduleCode: 'proposals', code: 'proposals.manage', name: 'Quản trị toàn bộ đề xuất, thực thi và danh mục', nameEn: 'Manage all proposals, execution tracking & categories' },
  { moduleCode: 'proposals', code: 'proposals.export', name: 'Xuất danh sách đề xuất Excel và tờ trình PDF', nameEn: 'Export proposal lists to Excel and forms to PDF' },
  { moduleCode: 'it_requests', code: 'it_requests.read', name: 'Xem yêu cầu hỗ trợ IT trong phạm vi', nameEn: 'View IT support requests within scope' },
  { moduleCode: 'it_requests', code: 'it_requests.create', name: 'Tạo, gửi yêu cầu IT và nghiệm thu đóng ticket', nameEn: 'Create, submit IT tickets & confirm resolution' },
  { moduleCode: 'it_requests', code: 'it_requests.manage', name: 'Tiếp nhận, phân công, xử lý ticket IT & quản trị danh mục SLA', nameEn: 'Assign, resolve IT tickets & manage SLA categories' },
  { moduleCode: 'it_requests', code: 'it_requests.export', name: 'Xuất danh sách ticket IT Excel và phiếu xử lý PDF', nameEn: 'Export IT tickets to Excel and service reports to PDF' },
  { moduleCode: 'payments', code: 'payments.read', name: 'Xem đề nghị thanh toán, tạm ứng & hoàn ứng trong phạm vi', nameEn: 'View payment, advance & reimbursement requests within scope' },
  { moduleCode: 'payments', code: 'payments.create', name: 'Tạo, sửa nháp, gửi duyệt và quyết toán đề nghị thanh toán', nameEn: 'Create, edit draft, submit & settle payment requests' },
  { moduleCode: 'payments', code: 'payments.manage', name: 'Quản trị danh mục khoản chi, kiểm soát chứng từ & yêu cầu bổ sung', nameEn: 'Manage payment categories, verify receipts & request revisions' },
  { moduleCode: 'payments', code: 'payments.disburse', name: 'Ghi nhận giải ngân, mã giao dịch ngân hàng & xác nhận hoàn quỹ', nameEn: 'Record disbursements, bank references & confirm advance refunds' },
  { moduleCode: 'payments', code: 'payments.export', name: 'Xuất bảng kê thanh toán Excel và phiếu đề nghị thanh toán PDF', nameEn: 'Export payment ledger to Excel and vouchers to PDF' },
  { moduleCode: 'payments', code: 'payments.budgets.read', name: 'Xem danh sách quỹ ngân sách, số dư khả dụng và sổ cái biến động', nameEn: 'View budget funds, available balances & budget ledger' },
  { moduleCode: 'payments', code: 'payments.budgets.manage', name: 'Tạo, chỉnh sửa, điều chỉnh hạn mức, điều chuyển và đóng mở quỹ ngân sách', nameEn: 'Create, edit, adjust, transfer & freeze/close budget funds' },
] as const;

const ROLE_DEFAULT_PERMISSIONS: Record<string, readonly string[]> = {
  SUPER_ADMIN: BASELINE_PERMISSIONS.map((p) => p.code),
  EXECUTIVE: [
    'core.branches.read',
    'core.users.read',
    'core.roles.read',
    'core.audit_logs.read',
    'core.approvals.read',
    'core.approvals.act',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.contracts.read',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.attendance.read',
    'hrm.payroll.read',
    'hrm.payroll.approve',
    'hrm.payroll.export',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'hrm.announcements.manage',
    'proposals.read',
    'proposals.create',
    'proposals.manage',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'it_requests.export',
    'payments.read',
    'payments.create',
    'payments.manage',
    'payments.export',
    'payments.budgets.read',
    'payments.budgets.manage',
  ],
  HR_MANAGER: [
    'core.branches.read',
    'core.users.read',
    'core.approvals.read',
    'core.approvals.act',
    'core.approvals.workflow_manage',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.org.manage',
    'hrm.employees.read',
    'hrm.employees.create',
    'hrm.employees.update',
    'hrm.employees.delete',
    'hrm.employees.export',
    'hrm.contracts.read',
    'hrm.contracts.manage',
    'hrm.contracts.export',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.requests.manage',
    'hrm.requests.export',
    'hrm.attendance.read',
    'hrm.attendance.manage',
    'hrm.attendance.import',
    'hrm.attendance.lock',
    'hrm.attendance.export',
    'hrm.payroll.read',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.rooms.manage',
    'hrm.announcements.read',
    'hrm.announcements.manage',
    'proposals.read',
    'proposals.create',
    'proposals.manage',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'it_requests.export',
    'payments.read',
    'payments.create',
    'payments.export',
  ],
  HR_STAFF: [
    'core.branches.read',
    'core.approvals.read',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.employees.create',
    'hrm.employees.update',
    'hrm.employees.export',
    'hrm.contracts.read',
    'hrm.contracts.manage',
    'hrm.contracts.export',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.requests.export',
    'hrm.attendance.read',
    'hrm.attendance.manage',
    'hrm.attendance.import',
    'hrm.attendance.export',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'hrm.announcements.manage',
    'proposals.read',
    'proposals.create',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'it_requests.export',
    'payments.read',
    'payments.create',
    'payments.export',
  ],
  PAYROLL_ACCOUNTANT: [
    'core.branches.read',
    'core.approvals.read',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.contracts.read',
    'hrm.contracts.export',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.requests.export',
    'hrm.attendance.read',
    'hrm.attendance.export',
    'hrm.payroll.read',
    'hrm.payroll.manage',
    'hrm.payroll.approve',
    'hrm.payroll.export',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'proposals.read',
    'proposals.create',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'it_requests.export',
    'payments.read',
    'payments.create',
    'payments.manage',
    'payments.disburse',
    'payments.export',
    'payments.budgets.read',
    'payments.budgets.manage',
  ],
  ADMIN_OPS: [
    'core.branches.read',
    'core.approvals.read',
    'core.approvals.act',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.attendance.read',
    'hrm.assets.read',
    'hrm.assets.manage',
    'hrm.assets.export',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.rooms.manage',
    'hrm.announcements.read',
    'hrm.announcements.manage',
    'proposals.read',
    'proposals.create',
    'proposals.manage',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'it_requests.manage',
    'it_requests.export',
    'payments.read',
    'payments.create',
    'payments.export',
    'payments.budgets.read',
  ],
  DEPT_MANAGER: [
    'core.approvals.read',
    'core.approvals.act',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.attendance.read',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'proposals.read',
    'proposals.create',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'it_requests.export',
    'payments.read',
    'payments.create',
    'payments.export',
    'payments.budgets.read',
  ],
  EMPLOYEE: [
    'core.approvals.read',
    'hrm.dashboard.read',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.contracts.read',
    'hrm.requests.read',
    'hrm.requests.create',
    'hrm.attendance.read',
    'hrm.assets.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'pm.dashboard.read',
    'pm.projects.read',
    'pm.tasks.read',
    'pm.tasks.create',
    'pm.tasks.update',
    'pm.timelogs.log',
    'proposals.read',
    'proposals.create',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'it_requests.export',
    'payments.read',
    'payments.create',
  ],
  PMO_MANAGER: BASELINE_PERMISSIONS.filter(
    (p) =>
      p.moduleCode === 'projects' ||
      p.moduleCode === 'proposals' ||
      p.code === 'it_requests.read' ||
      p.code === 'it_requests.create' ||
      p.code === 'it_requests.export' ||
      p.code === 'payments.read' ||
      p.code === 'payments.create' ||
      p.code === 'payments.export' ||
      p.code === 'core.approvals.read' ||
      p.code === 'core.approvals.act' ||
      p.code === 'core.branches.read' ||
      p.code === 'hrm.org.read' ||
      p.code === 'hrm.employees.read',
  ).map((p) => p.code),
  IT_SUPPORT: [
    'core.branches.read',
    'core.approvals.read',
    'core.approvals.act',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.assets.read',
    'hrm.assets.manage',
    'hrm.assets.export',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'proposals.read',
    'proposals.create',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'it_requests.manage',
    'it_requests.export',
    'payments.read',
    'payments.create',
    'payments.export',
  ],
  FINANCE_ACCOUNTANT: [
    'core.branches.read',
    'core.approvals.read',
    'core.approvals.act',
    'hrm.org.read',
    'hrm.employees.read',
    'hrm.rooms.read',
    'hrm.rooms.book',
    'hrm.announcements.read',
    'proposals.read',
    'proposals.create',
    'proposals.export',
    'it_requests.read',
    'it_requests.create',
    'payments.read',
    'payments.create',
    'payments.manage',
    'payments.disburse',
    'payments.export',
    'payments.budgets.read',
    'payments.budgets.manage',
  ],
};

async function seedDefaultBranch(conn: Connection): Promise<void> {
  await conn.execute(
    `INSERT INTO branches (code, name, name_en, address, is_headquarters, is_active)
     VALUES (?, ?, ?, ?, 1, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en)`,
    ['HQ', 'Trụ sở chính', 'Headquarters', 'Văn phòng trung tâm Operon Hub'],
  );
}

async function seedRolesAndPermissions(conn: Connection): Promise<Map<string, number>> {
  for (const role of SYSTEM_ROLES) {
    await conn.execute(
      `INSERT INTO roles (code, name, name_en, data_scope, description, is_system)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), data_scope = VALUES(data_scope), description = VALUES(description)`,
      [role.code, role.name, role.nameEn, role.dataScope, role.description],
    );
  }

  for (const perm of BASELINE_PERMISSIONS) {
    await conn.execute(
      `INSERT INTO permissions (module_code, code, name, name_en)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE module_code = VALUES(module_code), name = VALUES(name), name_en = VALUES(name_en)`,
      [perm.moduleCode, perm.code, perm.name, perm.nameEn],
    );
  }

  const [roleRows] = await conn.execute<mysql.RowDataPacket[]>('SELECT id, code FROM roles WHERE deleted_at IS NULL');
  const [permRows] = await conn.execute<mysql.RowDataPacket[]>('SELECT id, code FROM permissions');

  const roleMap = new Map<string, number>(roleRows.map((r) => [String(r.code), Number(r.id)]));
  const permMap = new Map<string, number>(permRows.map((p) => [String(p.code), Number(p.id)]));

  for (const [roleCode, permCodes] of Object.entries(ROLE_DEFAULT_PERMISSIONS)) {
    const roleId = roleMap.get(roleCode);
    if (!roleId) {
      continue;
    }
    for (const permCode of permCodes) {
      const permId = permMap.get(permCode);
      if (!permId) {
        continue;
      }
      await conn.execute(
        'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [roleId, permId],
      );
    }
  }

  return roleMap;
}

async function seedSuperAdminUser(conn: Connection, superAdminRoleId: number): Promise<void> {
  const [existingUsers] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );

  let adminUserId: number;
  if (existingUsers.length > 0) {
    adminUserId = Number(existingUsers[0].id);
  } else {
    const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    const [result] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (email, password_hash, full_name, status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [DEFAULT_ADMIN_EMAIL, passwordHash, DEFAULT_ADMIN_NAME],
    );
    adminUserId = Number(result.insertId);
  }

  const [existingAssignments] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND branch_id IS NULL LIMIT 1',
    [adminUserId, superAdminRoleId],
  );

  if (existingAssignments.length === 0) {
    await conn.execute(
      'INSERT INTO user_roles (user_id, role_id, branch_id) VALUES (?, ?, NULL)',
      [adminUserId, superAdminRoleId],
    );
  }
}

async function seedDefaultApprovalWorkflows(
  conn: Connection,
  roleMap: Map<string, number>,
): Promise<void> {
  const deptManagerRoleId = roleMap.get('DEPT_MANAGER') ?? null;
  const hrManagerRoleId = roleMap.get('HR_MANAGER') ?? null;
  if (!deptManagerRoleId || !hrManagerRoleId) {
    return;
  }

  const [tables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'approval_workflows'",
  );
  if (tables.length === 0) {
    return;
  }

  const templates = [
    {
      moduleCode: 'hrm',
      requestType: 'LEAVE',
      name: 'Quy trình duyệt Nghỉ phép chuẩn (2 cấp)',
      nameEn: 'Standard Leave Approval Workflow (2 Steps)',
      description: 'Cấp 1: Trưởng bộ phận duyệt -> Cấp 2: Trưởng phòng Nhân sự phê duyệt cuối',
      steps: [
        { stepOrder: 1, approverType: 'ROLE', approverRoleId: deptManagerRoleId },
        { stepOrder: 2, approverType: 'ROLE', approverRoleId: hrManagerRoleId },
      ],
    },
    {
      moduleCode: 'hrm',
      requestType: 'OVERTIME',
      name: 'Quy trình duyệt Tăng ca OT (1 cấp)',
      nameEn: 'Overtime (OT) Approval Workflow (1 Step)',
      description: 'Trưởng bộ phận xác nhận kế hoạch làm thêm giờ',
      steps: [{ stepOrder: 1, approverType: 'ROLE', approverRoleId: deptManagerRoleId }],
    },
    {
      moduleCode: 'hrm',
      requestType: 'BUSINESS_TRIP',
      name: 'Quy trình duyệt Đơn Công tác (2 cấp)',
      nameEn: 'Business Trip Approval Workflow (2 Steps)',
      description: 'Cấp 1: Trưởng bộ phận duyệt -> Cấp 2: Trưởng phòng Nhân sự xác nhận công tác',
      steps: [
        { stepOrder: 1, approverType: 'ROLE', approverRoleId: deptManagerRoleId },
        { stepOrder: 2, approverType: 'ROLE', approverRoleId: hrManagerRoleId },
      ],
    },
  ];

  for (const tpl of templates) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM approval_workflows
       WHERE module_code = ? AND request_type = ? AND name = ? AND deleted_at IS NULL
       LIMIT 1`,
      [tpl.moduleCode, tpl.requestType, tpl.name],
    );
    if (existing.length > 0) {
      await conn.execute(
        'UPDATE approval_workflows SET name_en = ? WHERE id = ? AND (name_en IS NULL OR name_en = "")',
        [tpl.nameEn, Number(existing[0].id)],
      );
      continue;
    }

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO approval_workflows (module_code, request_type, branch_id, name, name_en, description, is_active)
       VALUES (?, ?, NULL, ?, ?, ?, 1)`,
      [tpl.moduleCode, tpl.requestType, tpl.name, tpl.nameEn, tpl.description],
    );
    const workflowId = Number(inserted.insertId);

    for (const step of tpl.steps) {
      await conn.execute(
        `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
         VALUES (?, ?, ?, ?, NULL)`,
        [workflowId, step.stepOrder, step.approverType, step.approverRoleId],
      );
    }
  }
}

async function seedDefaultHrmOrganization(conn: Connection): Promise<void> {
  const [deptTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'departments'");
  const [posTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'positions'");
  if (deptTables.length === 0 || posTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  if (hqRows.length > 0) {
    const hqId = Number(hqRows[0].id);

    await conn.execute(
      `INSERT INTO departments (branch_id, parent_id, code, name, name_en, description, sort_order, is_active)
       VALUES (?, NULL, 'BOD', 'Ban Giám đốc', 'Board of Directors', 'Điều hành chiến lược toàn doanh nghiệp', 1, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en)`,
      [hqId],
    );

    const [bodRows] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM departments WHERE code = 'BOD' LIMIT 1",
    );
    const bodId = bodRows.length > 0 ? Number(bodRows[0].id) : null;

    const childDepts = [
      { code: 'HR', name: 'Phòng Hành chính Nhân sự', nameEn: 'Human Resources & Administration', desc: 'Quản trị nhân sự, tuyển dụng, C&B và hành chính', order: 2 },
      { code: 'FIN', name: 'Phòng Kế toán Tài chính', nameEn: 'Finance & Accounting', desc: 'Kế toán tổng hợp, tài chính và chi trả lương', order: 3 },
      { code: 'TECH', name: 'Phòng Công nghệ Thông tin', nameEn: 'Information Technology', desc: 'Phát triển sản phẩm và vận hành hạ tầng IT', order: 4 },
    ];

    for (const dept of childDepts) {
      await conn.execute(
        `INSERT INTO departments (branch_id, parent_id, code, name, name_en, description, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), parent_id = VALUES(parent_id)`,
        [hqId, bodId, dept.code, dept.name, dept.nameEn, dept.desc, dept.order],
      );
    }
  }

  const positions = [
    { code: 'CEO', name: 'Giám đốc Điều hành (CEO)', nameEn: 'Chief Executive Officer (CEO)', level: 5, desc: 'Lãnh đạo cao nhất doanh nghiệp' },
    { code: 'DEPT_HEAD', name: 'Trưởng phòng / Trưởng bộ phận', nameEn: 'Department Head', level: 4, desc: 'Quản lý trực tiếp phòng ban' },
    { code: 'TEAM_LEAD', name: 'Trưởng nhóm (Team Lead)', nameEn: 'Team Lead', level: 3, desc: 'Điều phối nhóm chuyên môn' },
    { code: 'SENIOR', name: 'Chuyên viên Cao cấp (Senior)', nameEn: 'Senior Specialist', level: 2, desc: 'Nhân sự chuyên môn giàu kinh nghiệm' },
    { code: 'STAFF', name: 'Nhân viên / Chuyên viên', nameEn: 'Staff / Specialist', level: 1, desc: 'Nhân sự vận hành chính thức' },
    { code: 'INTERN', name: 'Thực tập sinh', nameEn: 'Intern', level: 1, desc: 'Nhân sự thực tập và đào tạo' },
  ];

  for (const pos of positions) {
    await conn.execute(
      `INSERT INTO positions (code, name, name_en, level, description, is_active)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), name_en = VALUES(name_en), level = VALUES(level)`,
      [pos.code, pos.name, pos.nameEn, pos.level, pos.desc],
    );
  }
}

async function seedDefaultHrmEmployees(conn: Connection): Promise<void> {
  const [empTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'employees'");
  if (empTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  if (hqRows.length === 0) {
    return;
  }
  const hqId = Number(hqRows[0].id);

  const [deptRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, code FROM departments WHERE code IN ('BOD', 'HR', 'TECH') AND deleted_at IS NULL",
  );
  const [posRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, code FROM positions WHERE code IN ('CEO', 'DEPT_HEAD', 'TEAM_LEAD') AND deleted_at IS NULL",
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );

  const deptMap = new Map<string, number>(deptRows.map((d) => [String(d.code), Number(d.id)]));
  const posMap = new Map<string, number>(posRows.map((p) => [String(p.code), Number(p.id)]));
  const adminUserId = adminRows.length > 0 ? Number(adminRows[0].id) : null;

  const bodId = deptMap.get('BOD');
  const hrId = deptMap.get('HR');
  const techId = deptMap.get('TECH');
  const ceoId = posMap.get('CEO');
  const deptHeadId = posMap.get('DEPT_HEAD');
  const teamLeadId = posMap.get('TEAM_LEAD');

  if (!bodId || !hrId || !techId || !ceoId || !deptHeadId || !teamLeadId) {
    return;
  }

  const ensureEmployee = async (sample: {
    code: string;
    userId: number | null;
    departmentId: number;
    positionId: number;
    managerId: number | null;
    fullName: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    phone: string;
    workEmail: string;
    hireDate: string;
  }): Promise<number> => {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM employees WHERE employee_code = ? LIMIT 1',
      [sample.code],
    );
    if (existing.length > 0) {
      return Number(existing[0].id);
    }

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO employees (
        user_id, employee_code, branch_id, department_id, position_id, manager_id,
        full_name, gender, phone, work_email, hire_date, employment_status, dependents_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0)`,
      [
        sample.userId,
        sample.code,
        hqId,
        sample.departmentId,
        sample.positionId,
        sample.managerId,
        sample.fullName,
        sample.gender,
        sample.phone,
        sample.workEmail,
        sample.hireDate,
      ],
    );
    return Number(inserted.insertId);
  };

  const ceoEmpId = await ensureEmployee({
    code: 'NV0001',
    userId: adminUserId,
    departmentId: bodId,
    positionId: ceoId,
    managerId: null,
    fullName: 'Quản trị Hệ thống',
    gender: 'MALE',
    phone: '0901000001',
    workEmail: DEFAULT_ADMIN_EMAIL,
    hireDate: '2025-01-02',
  });

  const hrEmpId = await ensureEmployee({
    code: 'NV0002',
    userId: null,
    departmentId: hrId,
    positionId: deptHeadId,
    managerId: ceoEmpId,
    fullName: 'Nguyễn Thị Minh Anh',
    gender: 'FEMALE',
    phone: '0901000002',
    workEmail: 'hr.manager@operonhub.local',
    hireDate: '2025-02-01',
  });

  const techEmpId = await ensureEmployee({
    code: 'NV0003',
    userId: null,
    departmentId: techId,
    positionId: teamLeadId,
    managerId: ceoEmpId,
    fullName: 'Trần Hoàng Nam',
    gender: 'MALE',
    phone: '0901000003',
    workEmail: 'tech.lead@operonhub.local',
    hireDate: '2025-03-15',
  });

  await conn.execute(
    'UPDATE departments SET manager_employee_id = ? WHERE id = ? AND manager_employee_id IS NULL',
    [ceoEmpId, bodId],
  );
  await conn.execute(
    'UPDATE departments SET manager_employee_id = ? WHERE id = ? AND manager_employee_id IS NULL',
    [hrEmpId, hrId],
  );
  await conn.execute(
    'UPDATE departments SET manager_employee_id = ? WHERE id = ? AND manager_employee_id IS NULL',
    [techEmpId, techId],
  );
}

async function seedDefaultHrmContractsAndHistories(conn: Connection): Promise<void> {
  const [contractTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'employee_contracts'",
  );
  const [historyTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'employee_work_histories'",
  );
  if (contractTables.length === 0 || historyTables.length === 0) {
    return;
  }

  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    `SELECT id, employee_code, branch_id, department_id, position_id, hire_date
     FROM employees
     WHERE employee_code IN ('NV0001', 'NV0002', 'NV0003') AND deleted_at IS NULL`,
  );

  const empMap = new Map<
    string,
    { id: number; branchId: number; departmentId: number; positionId: number; hireDate: string }
  >();
  for (const row of empRows) {
    const hireDateStr =
      row.hire_date instanceof Date
        ? row.hire_date.toISOString().slice(0, 10)
        : String(row.hire_date).slice(0, 10);
    empMap.set(String(row.employee_code), {
      id: Number(row.id),
      branchId: Number(row.branch_id),
      departmentId: Number(row.department_id),
      positionId: Number(row.position_id),
      hireDate: hireDateStr,
    });
  }

  const sampleContracts = [
    {
      empCode: 'NV0001',
      contractNo: 'HDLD-2025-001',
      contractType: 'INDEFINITE',
      startDate: '2025-01-02',
      endDate: null,
      baseSalary: 45000000,
      insuranceSalary: 36000000,
      allowances: [
        { code: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 1200000 },
        { code: 'PHONE', label: 'Phụ cấp điện thoại', amount: 800000 },
      ],
      note: 'Hợp đồng không xác định thời hạn Ban Giám đốc',
    },
    {
      empCode: 'NV0002',
      contractNo: 'HDLD-2025-002',
      contractType: 'FIXED_TERM',
      startDate: '2025-02-01',
      endDate: '2027-01-31',
      baseSalary: 26000000,
      insuranceSalary: 22000000,
      allowances: [{ code: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 1000000 }],
      note: 'Hợp đồng xác định thời hạn 24 tháng',
    },
    {
      empCode: 'NV0003',
      contractNo: 'HDLD-2025-003',
      contractType: 'FIXED_TERM',
      startDate: '2025-12-06',
      endDate: '2026-12-05',
      baseSalary: 30000000,
      insuranceSalary: 25000000,
      allowances: [
        { code: 'MEAL', label: 'Phụ cấp ăn trưa', amount: 1000000 },
        { code: 'TECH', label: 'Phụ cấp trực hệ thống', amount: 1500000 },
      ],
      note: 'Hợp đồng sắp hết hạn (mẫu kiểm thử cảnh báo <= 15 ngày)',
    },
  ];

  for (const item of sampleContracts) {
    const emp = empMap.get(item.empCode);
    if (!emp) {
      continue;
    }

    const [existingContract] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM employee_contracts WHERE contract_no = ? LIMIT 1',
      [item.contractNo],
    );
    if (existingContract.length === 0) {
      await conn.execute(
        `INSERT INTO employee_contracts (
          employee_id, contract_no, contract_type, start_date, end_date,
          base_salary, insurance_salary, allowances_json, status, signed_date, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [
          emp.id,
          item.contractNo,
          item.contractType,
          item.startDate,
          item.endDate,
          item.baseSalary,
          item.insuranceSalary,
          JSON.stringify(item.allowances),
          item.startDate,
          item.note,
        ],
      );
    }

    const [existingHire] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM employee_work_histories WHERE employee_id = ? AND change_type = 'HIRE' AND deleted_at IS NULL LIMIT 1",
      [emp.id],
    );
    if (existingHire.length === 0) {
      await conn.execute(
        `INSERT INTO employee_work_histories (
          employee_id, change_type, effective_date, decision_no,
          to_branch_id, to_department_id, to_position_id, to_salary, note
        ) VALUES (?, 'HIRE', ?, ?, ?, ?, ?, ?, ?)`,
        [
          emp.id,
          emp.hireDate,
          `QD-TD-${item.empCode}`,
          emp.branchId,
          emp.departmentId,
          emp.positionId,
          item.baseSalary,
          'Tiếp nhận nhân sự chính thức vào doanh nghiệp',
        ],
      );
    }
  }
}

async function seedDefaultHrmLeaves(conn: Connection): Promise<void> {
  const [typeTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'leave_types'");
  const [balTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'leave_balances'");
  if (typeTables.length === 0 || balTables.length === 0) {
    return;
  }

  const leaveTypes = [
    {
      code: 'ANNUAL',
      name: 'Nghỉ phép năm',
      nameEn: 'Annual Leave',
      isPaid: 1,
      defaultDays: 12.0,
      allowCarryOver: 1,
      maxCarryOver: 5.0,
      requiresAttachment: 0,
      description: 'Nghỉ phép năm hưởng nguyên lương theo Bộ luật Lao động',
    },
    {
      code: 'SICK',
      name: 'Nghỉ ốm (BHXH)',
      nameEn: 'Sick Leave (Social Insurance)',
      isPaid: 0,
      defaultDays: 0.0,
      allowCarryOver: 0,
      maxCarryOver: 0.0,
      requiresAttachment: 1,
      description: 'Nghỉ ốm hưởng chế độ BHXH (yêu cầu giấy xác nhận cơ sở y tế)',
    },
    {
      code: 'UNPAID',
      name: 'Nghỉ không lương',
      nameEn: 'Unpaid Leave',
      isPaid: 0,
      defaultDays: 0.0,
      allowCarryOver: 0,
      maxCarryOver: 0.0,
      requiresAttachment: 0,
      description: 'Nghỉ việc riêng không hưởng lương',
    },
    {
      code: 'MARRIAGE',
      name: 'Nghỉ kết hôn',
      nameEn: 'Marriage Leave',
      isPaid: 1,
      defaultDays: 3.0,
      allowCarryOver: 0,
      maxCarryOver: 0.0,
      requiresAttachment: 0,
      description: 'Nghỉ kết hôn hưởng nguyên lương (tối đa 3 ngày)',
    },
    {
      code: 'BEREAVEMENT',
      name: 'Nghỉ việc hiếu',
      nameEn: 'Bereavement Leave',
      isPaid: 1,
      defaultDays: 3.0,
      allowCarryOver: 0,
      maxCarryOver: 0.0,
      requiresAttachment: 0,
      description: 'Nghỉ tang chế hưởng nguyên lương (tối đa 3 ngày)',
    },
  ];

  for (const lt of leaveTypes) {
    await conn.execute(
      `INSERT INTO leave_types (
        code, name, name_en, is_paid, default_days_per_year, allow_carry_over,
        max_carry_over_days, requires_attachment, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        description = VALUES(description)`,
      [
        lt.code,
        lt.name,
        lt.nameEn,
        lt.isPaid,
        lt.defaultDays,
        lt.allowCarryOver,
        lt.maxCarryOver,
        lt.requiresAttachment,
        lt.description,
      ],
    );
  }

  const [ltRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code, default_days_per_year FROM leave_types WHERE default_days_per_year > 0 AND deleted_at IS NULL',
  );
  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, employee_code FROM employees WHERE employee_code IN ('NV0001', 'NV0002', 'NV0003') AND deleted_at IS NULL",
  );

  const targetYear = 2026;
  for (const emp of empRows) {
    const empId = Number(emp.id);
    const empCode = String(emp.employee_code);
    for (const lt of ltRows) {
      const ltId = Number(lt.id);
      const ltCode = String(lt.code);
      const defaultDays = Number(lt.default_days_per_year);
      const carriedOver = empCode === 'NV0001' && ltCode === 'ANNUAL' ? 2.0 : 0.0;
      await conn.execute(
        `INSERT IGNORE INTO leave_balances (
          employee_id, leave_type_id, year, entitled_days, carried_over_days, used_days, pending_days, note
        ) VALUES (?, ?, ?, ?, ?, 0.00, 0.00, ?)`,
        [empId, ltId, targetYear, defaultDays, carriedOver, 'Khởi tạo quỹ phép năm mẫu'],
      );
    }
  }
}

async function seedDefaultHrmAttendance(conn: Connection): Promise<void> {
  const [shiftTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'work_shifts'");
  const [assignTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'employee_shift_assignments'",
  );
  const [holidayTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'holidays'");
  if (shiftTables.length === 0 || assignTables.length === 0 || holidayTables.length === 0) {
    return;
  }

  const defaultShifts = [
    {
      code: 'HC',
      name: 'Ca Hành chính chuẩn',
      nameEn: 'Standard Office Shift',
      startTime: '08:00',
      endTime: '17:30',
      breakStart: '12:00',
      breakEnd: '13:30',
      lateGrace: 10,
      earlyGrace: 10,
      workingHours: 8.0,
      isDefault: 1,
      description: 'Ca hành chính tiêu chuẩn 8 giờ/ngày (nghỉ trưa 12:00–13:30)',
    },
    {
      code: 'CA_SANG',
      name: 'Ca Sáng linh hoạt',
      nameEn: 'Flexible Morning Shift',
      startTime: '07:30',
      endTime: '16:30',
      breakStart: '11:30',
      breakEnd: '12:30',
      lateGrace: 10,
      earlyGrace: 10,
      workingHours: 8.0,
      isDefault: 0,
      description: 'Ca làm việc bắt đầu sớm 07:30–16:30 (nghỉ trưa 1 giờ)',
    },
  ];

  for (const shift of defaultShifts) {
    await conn.execute(
      `INSERT INTO work_shifts (
        branch_id, code, name, name_en, start_time, end_time, break_start_time, break_end_time,
        late_grace_minutes, early_leave_grace_minutes, working_hours, is_default, is_active, description
      ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        description = VALUES(description)`,
      [
        shift.code,
        shift.name,
        shift.nameEn,
        shift.startTime,
        shift.endTime,
        shift.breakStart,
        shift.breakEnd,
        shift.lateGrace,
        shift.earlyGrace,
        shift.workingHours,
        shift.isDefault,
        shift.description,
      ],
    );
  }

  const [hcRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM work_shifts WHERE code = 'HC' AND deleted_at IS NULL LIMIT 1",
  );
  if (hcRows.length > 0) {
    const hcShiftId = Number(hcRows[0].id);
    const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM employees WHERE employee_code IN ('NV0001', 'NV0002', 'NV0003') AND deleted_at IS NULL",
    );
    for (const emp of empRows) {
      const empId = Number(emp.id);
      const [existingAssign] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id FROM employee_shift_assignments WHERE employee_id = ? AND deleted_at IS NULL LIMIT 1',
        [empId],
      );
      if (existingAssign.length === 0) {
        await conn.execute(
          `INSERT INTO employee_shift_assignments (
            employee_id, shift_id, effective_from, effective_to, work_days_json, note
          ) VALUES (?, ?, '2026-01-01', NULL, ?, ?)`,
          [empId, hcShiftId, JSON.stringify([1, 2, 3, 4, 5]), 'Phân ca hành chính mặc định'],
        );
      }
    }
  }

  const vnHolidays2026 = [
    { date: '2026-01-01', name: 'Tết Dương lịch 2026', nameEn: "New Year's Day 2026", note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-04-26', name: 'Giỗ Tổ Hùng Vương (10/3 ÂL)', nameEn: "Hung Kings' Commemoration Day (10/3 Lunar)", note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-04-30', name: 'Ngày Giải phóng miền Nam 30/4', nameEn: 'Reunification Day (Apr 30)', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-05-01', name: 'Ngày Quốc tế Lao động 1/5', nameEn: 'International Labor Day (May 1)', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
    { date: '2026-09-02', name: 'Ngày Quốc khánh nước CHXHCN Việt Nam 2/9', nameEn: 'Vietnam National Day (Sep 2)', note: 'Nghỉ lễ toàn quốc hưởng nguyên lương' },
  ];

  for (const h of vnHolidays2026) {
    const [existingHoliday] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM holidays WHERE branch_id IS NULL AND holiday_date = ? AND deleted_at IS NULL LIMIT 1',
      [h.date],
    );
    if (existingHoliday.length === 0) {
      await conn.execute(
        `INSERT INTO holidays (branch_id, holiday_date, name, name_en, is_paid, note)
         VALUES (NULL, ?, ?, ?, 1, ?)`,
        [h.date, h.name, h.nameEn, h.note],
      );
    }
  }
}

async function seedDefaultHrmPayrollConfig(conn: Connection): Promise<void> {
  const [settingsTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'settings'");
  if (settingsTables.length === 0) {
    return;
  }

  const defaultConfig = {
    bhxhEmpRate: 0.08,
    bhytEmpRate: 0.015,
    bhtnEmpRate: 0.01,
    bhxhBhytSalaryCap: 46800000,
    bhtnSalaryCap: 99200000,
    personalDeduction: 11000000,
    dependentDeduction: 4400000,
    workingHoursPerDay: 8,
    otRate150: 1.5,
    otRate200: 2.0,
    otRate300: 3.0,
    requireLockedAttendance: true,
    pitBrackets: [
      { upTo: 5000000, rate: 0.05 },
      { upTo: 10000000, rate: 0.1 },
      { upTo: 18000000, rate: 0.15 },
      { upTo: 32000000, rate: 0.2 },
      { upTo: 52000000, rate: 0.25 },
      { upTo: 80000000, rate: 0.3 },
      { upTo: null, rate: 0.35 },
    ],
  };

  await conn.execute(
    `INSERT IGNORE INTO settings (module_code, setting_key, setting_value, description)
     VALUES ('hrm', 'hrm.payroll.config', ?, 'Cấu hình tỷ lệ BHXH/BHYT/BHTN, mức trần, giảm trừ gia cảnh và biểu thuế TNCN lũy tiến 7 bậc')`,
    [JSON.stringify(defaultConfig)],
  );
}

async function seedDefaultHrmAssets(conn: Connection): Promise<void> {
  const [assetTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'assets'");
  const [assignTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'asset_assignments'",
  );
  if (assetTables.length === 0 || assignTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  if (hqRows.length === 0) {
    return;
  }
  const hqId = Number(hqRows[0].id);

  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id, employee_code FROM employees WHERE employee_code IN ('NV0002', 'NV0003') AND deleted_at IS NULL",
  );
  const empMap = new Map<string, number>(
    empRows.map((r) => [String(r.employee_code), Number(r.id)]),
  );

  const sampleAssets = [
    {
      code: 'TS-LT-001',
      name: 'MacBook Pro 14 M3 Pro 18GB/512GB',
      category: 'LAPTOP',
      brand: 'Apple',
      model: 'A2992',
      serial: 'C02M3PRO001',
      purchaseDate: '2025-03-10',
      warrantyDate: '2027-03-10',
      value: 48500000,
      status: 'ASSIGNED',
      assignTo: 'NV0003',
      condition: 'Mới 100%, nguyên hộp kèm sạc MagSafe 70W',
      note: 'Máy làm việc chính của Trưởng nhóm Công nghệ',
    },
    {
      code: 'TS-LT-002',
      name: 'Dell XPS 13 9340 Core Ultra 7',
      category: 'LAPTOP',
      brand: 'Dell',
      model: 'XPS-9340',
      serial: 'DLXPS934002',
      purchaseDate: '2025-02-01',
      warrantyDate: '2027-02-01',
      value: 34900000,
      status: 'ASSIGNED',
      assignTo: 'NV0002',
      condition: 'Mới 100%, kèm sạc Type-C 65W và chuột không dây',
      note: 'Máy làm việc Phòng Hành chính Nhân sự',
    },
    {
      code: 'TS-MN-001',
      name: 'Màn hình Dell UltraSharp 27" 4K U2723QE',
      category: 'MONITOR',
      brand: 'Dell',
      model: 'U2723QE',
      serial: 'DLU2723QE01',
      purchaseDate: '2025-06-15',
      warrantyDate: '2028-06-15',
      value: 14200000,
      status: 'AVAILABLE',
      assignTo: null,
      condition: null,
      note: 'Sẵn sàng cấp phát tại kho Trụ sở chính',
    },
    {
      code: 'TS-PH-001',
      name: 'iPhone 15 128GB (Thiết bị kiểm thử)',
      category: 'PHONE',
      brand: 'Apple',
      model: 'A3090',
      serial: 'IP15TEST001',
      purchaseDate: '2025-04-20',
      warrantyDate: '2026-04-20',
      value: 19500000,
      status: 'MAINTENANCE',
      assignTo: null,
      condition: null,
      note: 'Đang thay pin và kiểm tra cổng sạc tại trung tâm bảo hành',
    },
  ];

  for (const item of sampleAssets) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM assets WHERE asset_code = ? LIMIT 1',
      [item.code],
    );
    let assetId: number;
    if (existing.length > 0) {
      assetId = Number(existing[0].id);
    } else {
      const targetEmpId = item.assignTo ? empMap.get(item.assignTo) ?? null : null;
      const finalStatus = targetEmpId ? item.status : item.status === 'ASSIGNED' ? 'AVAILABLE' : item.status;
      const [inserted] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO assets (
          branch_id, asset_code, name, category, brand, model, serial_number,
          purchase_date, warranty_expiry_date, purchase_value, status, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hqId,
          item.code,
          item.name,
          item.category,
          item.brand,
          item.model,
          item.serial,
          item.purchaseDate,
          item.warrantyDate,
          item.value,
          finalStatus,
          item.note,
        ],
      );
      assetId = Number(inserted.insertId);

      if (targetEmpId && item.condition) {
        await conn.execute(
          `INSERT INTO asset_assignments (
            asset_id, employee_id, assigned_at, condition_on_assign, status, note
          ) VALUES (?, ?, NOW(), ?, 'ACTIVE', ?)`,
          [assetId, targetEmpId, item.condition, 'Cấp phát thiết bị mẫu khi khởi tạo hệ thống'],
        );
      }
    }
  }
}

async function seedDefaultHrmRoomsAndAnnouncements(conn: Connection): Promise<void> {
  const [roomTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'meeting_rooms'");
  const [annTables] = await conn.execute<mysql.RowDataPacket[]>("SHOW TABLES LIKE 'announcements'");
  if (roomTables.length === 0 || annTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );
  if (hqRows.length === 0 || adminRows.length === 0) {
    return;
  }

  const hqId = Number(hqRows[0].id);
  const adminUserId = Number(adminRows[0].id);

  const sampleRooms = [
    {
      code: 'PH-01',
      name: 'Phòng họp Lớn (Boardroom)',
      nameEn: 'Main Boardroom',
      floor: 'Tầng 5',
      capacity: 16,
      equipment: ['TV 75 inch 4K', 'Hệ thống hội nghị truyền hình', 'Bảng kính trắng', 'Micro không dây'],
      description: 'Phòng họp chính phục vụ giao ban tuần, họp Ban Giám đốc và tiếp đón đối tác',
    },
    {
      code: 'PH-02',
      name: 'Phòng họp Nhỏ A (Focus Room)',
      nameEn: 'Focus Room A',
      floor: 'Tầng 4',
      capacity: 6,
      equipment: ['Màn hình 55 inch', 'Bảng trắng', 'Cáp HDMI / USB-C'],
      description: 'Phòng họp nhanh theo nhóm dự án, phỏng vấn ứng viên hoặc trao đổi 1-1',
    },
    {
      code: 'PH-03',
      name: 'Phòng Đào tạo & Hội thảo',
      nameEn: 'Training & Conference Hall',
      floor: 'Tầng 6',
      capacity: 30,
      equipment: ['Máy chiếu Laser', 'Hệ thống âm thanh hội trường', 'Bảng Flipchart', 'Bục phát biểu'],
      description: 'Không gian tổ chức đào tạo nội bộ, onboarding nhân sự mới và hội thảo toàn công ty',
    },
  ];

  for (const room of sampleRooms) {
    await conn.execute(
      `INSERT INTO meeting_rooms (
        branch_id, code, name, name_en, floor, capacity, equipment_json, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        floor = VALUES(floor),
        capacity = VALUES(capacity),
        equipment_json = VALUES(equipment_json),
        description = VALUES(description)`,
      [
        hqId,
        room.code,
        room.name,
        room.nameEn,
        room.floor,
        room.capacity,
        JSON.stringify(room.equipment),
        room.description,
      ],
    );
  }

  const sampleAnnouncements = [
    {
      branchId: null as number | null,
      title: 'Quy định chấm công, nghỉ phép & sử dụng phòng họp Operon Hub',
      content:
        'Kính gửi toàn thể CBNV,\n\nNhằm chuẩn hóa quy trình vận hành nội bộ trên cổng Operon Hub, Phòng Hành chính Nhân sự thông báo áp dụng thống nhất các quy định sau:\n1. Chấm công: Thực hiện Check-in/Check-out đúng giờ quy định của ca làm việc được phân công.\n2. Đơn từ: Gửi đơn nghỉ phép, tăng ca (OT), công tác trực tiếp tại mục Đơn từ của tôi để hệ thống tự động luân chuyển phê duyệt.\n3. Đặt phòng họp: Vui lòng đặt lịch trước trên hệ thống và hủy lịch tối thiểu 30 phút nếu không sử dụng để tối ưu không gian chung.\n\nTrân trọng cảm ơn sự phối hợp của Anh/Chị!',
      category: 'HR_POLICY',
      isPinned: 1,
    },
    {
      branchId: hqId,
      title: 'Lịch tổng kết vận hành cuối tháng & giao lưu nội bộ Trụ sở chính',
      content:
        'Thân gửi Anh/Chị CBNV Trụ sở chính (HQ),\n\nBan Giám đốc và Phòng Hành chính trân trọng mời toàn thể thành viên tham dự buổi Tổng kết vận hành tháng và giao lưu sinh nhật thành viên trong tháng.\n- Thời gian dự kiến: 16:00 – 17:30 ngày thứ Sáu tuần cuối tháng.\n- Địa điểm: Phòng Đào tạo & Hội thảo (PH-03, Tầng 6).\n\nKính mong Anh/Chị sắp xếp công việc tham dự đầy đủ và bấm xác nhận đã đọc thông báo này.',
      category: 'EVENT',
      isPinned: 0,
    },
  ];

  for (const ann of sampleAnnouncements) {
    const [existingAnn] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM announcements WHERE title = ? AND deleted_at IS NULL LIMIT 1',
      [ann.title],
    );
    if (existingAnn.length === 0) {
      await conn.execute(
        `INSERT INTO announcements (
          branch_id, title, content, category, is_pinned, published_at, status, author_id, created_by
        ) VALUES (?, ?, ?, ?, ?, NOW(), 'PUBLISHED', ?, ?)`,
        [
          ann.branchId,
          ann.title,
          ann.content,
          ann.category,
          ann.isPinned,
          adminUserId,
          adminUserId,
        ],
      );
    }
  }
}

async function seedDefaultProposalsModule(
  conn: Connection,
  roleMap: Map<string, number>,
): Promise<void> {
  const [catTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'proposal_categories'",
  );
  if (catTables.length === 0) {
    return;
  }

  for (const cat of DEFAULT_PROPOSAL_CATEGORIES) {
    await conn.execute(
      `INSERT INTO proposal_categories (
        code, name, name_en, description, default_request_type,
        requires_budget, budget_threshold_high, icon_name, color_hex, sort_order, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        description = VALUES(description),
        budget_threshold_high = VALUES(budget_threshold_high),
        color_hex = VALUES(color_hex),
        sort_order = VALUES(sort_order)`,
      [
        cat.code,
        cat.name,
        cat.nameEn,
        cat.description,
        cat.defaultRequestType,
        cat.requiresBudget ? 1 : 0,
        cat.budgetThresholdHigh,
        cat.iconName,
        cat.colorHex,
        cat.sortOrder,
      ],
    );
  }

  const deptManagerRoleId = roleMap.get('DEPT_MANAGER') ?? null;
  const adminOpsRoleId = roleMap.get('ADMIN_OPS') ?? null;
  const executiveRoleId = roleMap.get('EXECUTIVE') ?? null;

  let highValueWorkflowId: number | null = null;
  let standardWorkflowId: number | null = null;

  if (deptManagerRoleId && adminOpsRoleId && executiveRoleId) {
    const proposalWorkflows = [
      {
        key: 'high',
        name: 'Quy trình duyệt Đề xuất Giá trị lớn (≥ 20 triệu — 3 cấp)',
        nameEn: 'High-Value Proposal Approval (≥ 20M VND — 3 Steps)',
        description:
          'Áp dụng cho đề xuất có ngân sách từ 20.000.000 VNĐ: Quản lý trực tiếp -> Hành chính -> Ban Giám đốc',
        conditionsJson: JSON.stringify({ minAmount: PROPOSAL_HIGH_VALUE_THRESHOLD_VND }),
        steps: [
          { stepOrder: 1, approverType: 'DIRECT_MANAGER', approverRoleId: deptManagerRoleId },
          { stepOrder: 2, approverType: 'ROLE', approverRoleId: adminOpsRoleId },
          { stepOrder: 3, approverType: 'ROLE', approverRoleId: executiveRoleId },
        ],
      },
      {
        key: 'standard',
        name: 'Quy trình duyệt Đề xuất Tiêu chuẩn (2 cấp)',
        nameEn: 'Standard Internal Proposal Approval (2 Steps)',
        description:
          'Áp dụng cho đề xuất thường (< 20 triệu hoặc không phát sinh ngân sách): Quản lý trực tiếp -> Hành chính',
        conditionsJson: null as string | null,
        steps: [
          { stepOrder: 1, approverType: 'DIRECT_MANAGER', approverRoleId: deptManagerRoleId },
          { stepOrder: 2, approverType: 'ROLE', approverRoleId: adminOpsRoleId },
        ],
      },
    ];

    for (const wf of proposalWorkflows) {
      const [existingWf] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT id FROM approval_workflows
         WHERE module_code = ? AND request_type = ? AND name = ? AND deleted_at IS NULL
         LIMIT 1`,
        [PROPOSAL_MODULE_CODE, PROPOSAL_DEFAULT_REQUEST_TYPE, wf.name],
      );
      let wfId: number;
      if (existingWf.length > 0) {
        wfId = Number(existingWf[0].id);
      } else {
        const [inserted] = await conn.execute<mysql.ResultSetHeader>(
          `INSERT INTO approval_workflows (
            module_code, request_type, branch_id, name, name_en, description, conditions_json, is_active
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, 1)`,
          [
            PROPOSAL_MODULE_CODE,
            PROPOSAL_DEFAULT_REQUEST_TYPE,
            wf.name,
            wf.nameEn,
            wf.description,
            wf.conditionsJson,
          ],
        );
        wfId = Number(inserted.insertId);
        for (const step of wf.steps) {
          await conn.execute(
            `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
             VALUES (?, ?, ?, ?, NULL)`,
            [wfId, step.stepOrder, step.approverType, step.approverRoleId],
          );
        }
      }
      if (wf.key === 'high') {
        highValueWorkflowId = wfId;
      } else {
        standardWorkflowId = wfId;
      }
    }
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );
  if (hqRows.length === 0 || adminRows.length === 0) {
    return;
  }

  const hqId = Number(hqRows[0].id);
  const adminUserId = Number(adminRows[0].id);

  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, department_id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
    [adminUserId],
  );
  const [deptRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM departments WHERE deleted_at IS NULL',
  );
  const [catRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM proposal_categories WHERE deleted_at IS NULL',
  );

  const deptMap = new Map<string, number>(deptRows.map((d) => [String(d.code), Number(d.id)]));
  const catMap = new Map<string, number>(catRows.map((c) => [String(c.code), Number(c.id)]));
  const adminEmpId = empRows.length > 0 ? Number(empRows[0].id) : null;

  const sampleProposals = [
    {
      code: 'PROP-202611-0001',
      categoryCode: 'EQUIPMENT',
      deptCode: 'TECH',
      title: 'Đề xuất nâng cấp màn hình 4K & docking station cho đội Kỹ thuật',
      summary: 'Trang bị 6 màn hình 27 inch 4K và 6 hub USB-C nhằm tăng hiệu suất lập trình và review UI.',
      content:
        'Hiện tại đội Kỹ thuật đã mở rộng thêm 6 nhân sự mới cho Phase 2 Operon Hub nhưng thiết bị màn hình rời đang thiếu. Đề xuất mua sắm 6 bộ màn hình 27 inch 4K chuẩn màu sRGB 99% kèm docking station USB-C để chuẩn hóa góc làm việc và bảo vệ thị lực cho nhân viên.',
      expectedOutcome: 'Tăng 20% tốc độ xử lý đa nhiệm, giảm tình trạng mỏi mắt khi làm việc kéo dài.',
      priority: 'HIGH',
      status: 'PENDING_APPROVAL',
      vendorName: 'Công ty TNHH Máy tính Minh Anh',
      neededByDate: '2026-12-10',
      items: [
        { name: 'Màn hình Dell UltraSharp 27" 4K USB-C', spec: 'U2723QE, bảo hành 36 tháng', unit: 'Chiếc', qty: 6, price: 11500000 },
        { name: 'Docking Station USB-C 10-in-1', spec: 'Hỗ trợ sạc PD 100W, HDMI 4K', unit: 'Bộ', qty: 6, price: 1450000 },
      ],
      needsApproval: true,
    },
    {
      code: 'PROP-202611-0002',
      categoryCode: 'EVENT',
      deptCode: 'HR',
      title: 'Tờ trình tổ chức Tiệc Tất niên & Vinh danh cuối năm 2026',
      summary: 'Kế hoạch tổ chức Year-End Party cho 85 CBNV Trụ sở chính kèm quà vinh danh cá nhân xuất sắc.',
      content:
        'Nhằm tổng kết thành tựu năm 2026 và gắn kết đội ngũ trước thềm năm mới 2027, Phòng Hành chính Nhân sự đề xuất tổ chức chương trình Year-End Party tại khách sạn trung tâm với các hạng mục: hội trường âm thanh ánh sáng, tiệc tối buffet, kỷ niệm chương vinh danh và quà bốc thăm may mắn.',
      expectedOutcome: 'Nâng cao mức độ gắn kết nội bộ (eNPS >= 85%) và tạo động lực bứt phá quý I/2027.',
      priority: 'MEDIUM',
      status: 'APPROVED',
      vendorName: 'Trung tâm Hội nghị Grand Palace',
      neededByDate: '2026-12-20',
      items: [
        { name: 'Gói tiệc tối & hội trường 85 khách', spec: 'Bao gồm LED screen + âm thanh ánh sáng', unit: 'Suất', qty: 85, price: 650000 },
        { name: 'Kỷ niệm chương pha lê & khung bằng khen', spec: 'Khắc laser logo Operon Hub', unit: 'Bộ', qty: 15, price: 450000 },
      ],
      needsApproval: false,
    },
    {
      code: 'PROP-202611-0003',
      categoryCode: 'HR_TRAINING',
      deptCode: 'TECH',
      title: 'Đề xuất tài trợ chứng chỉ Cloud & Bảo mật ứng dụng cho nhóm Backend',
      summary: 'Đăng ký khóa ôn luyện và lệ phí thi chứng chỉ bảo mật & tối ưu cơ sở dữ liệu cho 4 kỹ sư.',
      content:
        'Đáp ứng yêu cầu nâng chuẩn bảo mật và tối ưu hiệu năng truy vấn MySQL trên các hệ thống doanh nghiệp, đề xuất công ty tài trợ 100% học phí và lệ phí thi chứng chỉ cho 4 kỹ sư chủ chốt kèm cam kết chia sẻ seminar nội bộ sau khóa học.',
      expectedOutcome: 'Đội ngũ tự chủ kiểm định bảo mật và giảm 40% thời gian phản hồi API trọng yếu.',
      priority: 'MEDIUM',
      status: 'IN_EXECUTION',
      vendorName: 'Học viện Công nghệ CloudVN',
      neededByDate: '2026-12-15',
      items: [
        { name: 'Khóa đào tạo Database Performance & Security', spec: 'Online + thực hành 8 tuần', unit: 'Học viên', qty: 4, price: 3200000 },
        { name: 'Lệ phí thi chứng chỉ quốc tế', spec: 'Voucher thi chính thức', unit: 'Voucher', qty: 4, price: 1500000 },
      ],
      needsApproval: false,
    },
    {
      code: 'PROP-202611-0004',
      categoryCode: 'PROCESS_IMPROVEMENT',
      deptCode: 'BOD',
      title: 'Đề xuất áp dụng quy trình Số hóa Tờ trình & Ký duyệt không giấy tờ',
      summary: 'Chuyển toàn bộ tờ trình mua sắm, sự kiện và hành chính sang vận hành trực tuyến trên Operon Hub.',
      content:
        'Hiện tại các đề xuất nội bộ vẫn phải in giấy, trình ký thủ công qua nhiều tầng gây chậm trễ 3–5 ngày và khó tra cứu lịch sử. Đề xuất áp dụng chính thức phân hệ Đề xuất Nội bộ trên Operon Hub từ ngày 01/12/2026 với 2 mức phê duyệt tự động theo giá trị ngân sách.',
      expectedOutcome: 'Rút ngắn thời gian phê duyệt trung bình xuống dưới 24 giờ và tiết kiệm 80% chi phí in ấn.',
      priority: 'HIGH',
      status: 'COMPLETED',
      vendorName: null,
      neededByDate: '2026-11-30',
      items: [],
      needsApproval: false,
    },
    {
      code: 'PROP-202611-0005',
      categoryCode: 'PROCUREMENT',
      deptCode: 'HR',
      title: 'Đề xuất bổ sung văn phòng phẩm & máy pha cà phê khu vực Pantry',
      summary: 'Mua sắm định kỳ văn phòng phẩm tháng 12 và thay mới máy pha cà phê tự động tầng 5.',
      content:
        'Máy pha cà phê khu vực Pantry tầng 5 đã hết bảo hành và thường xuyên lỗi áp suất. Đồng thời cần bổ sung giấy in A4, bút viết bảng và phụ kiện phòng họp cho tháng 12.',
      expectedOutcome: 'Đảm bảo tiện nghi văn phòng và trải nghiệm làm việc tốt nhất cho CBNV.',
      priority: 'LOW',
      status: 'NEEDS_REVISION',
      vendorName: 'Siêu thị Văn phòng Thiên Long Pro',
      neededByDate: '2026-12-05',
      items: [
        { name: 'Máy pha cà phê tự động hạt nguyên chất', spec: 'Công suất 80 ly/ngày, BH 24 tháng', unit: 'Máy', qty: 1, price: 14500000 },
        { name: 'Combo giấy A4 Double A & VPP tháng 12', spec: '20 ram giấy + bút bảng + bìa hồ sơ', unit: 'Gói', qty: 1, price: 2800000 },
      ],
      needsApproval: false,
    },
  ];

  for (const sample of sampleProposals) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM proposals WHERE proposal_code = ? LIMIT 1',
      [sample.code],
    );
    if (existing.length > 0) {
      continue;
    }

    const categoryId = catMap.get(sample.categoryCode) ?? Array.from(catMap.values())[0];
    if (!categoryId) {
      continue;
    }
    const departmentId = deptMap.get(sample.deptCode) ?? null;
    const estimatedBudget = sample.items.reduce((sum, it) => sum + it.qty * it.price, 0);

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO proposals (
        proposal_code, category_id, branch_id, department_id,
        requester_employee_id, requester_user_id, title, summary, content, expected_outcome,
        priority, status, estimated_budget, approved_budget, currency, needed_by_date, vendor_name,
        submitted_at, approved_at, completed_at, rejection_reason, execution_notes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VND', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sample.code,
        categoryId,
        hqId,
        departmentId,
        adminEmpId,
        adminUserId,
        sample.title,
        sample.summary,
        sample.content,
        sample.expectedOutcome,
        sample.priority,
        sample.status,
        estimatedBudget,
        ['APPROVED', 'IN_EXECUTION', 'COMPLETED'].includes(sample.status) ? estimatedBudget : null,
        sample.neededByDate,
        sample.vendorName,
        sample.status !== 'DRAFT' ? new Date() : null,
        ['APPROVED', 'IN_EXECUTION', 'COMPLETED'].includes(sample.status) ? new Date() : null,
        sample.status === 'COMPLETED' ? new Date() : null,
        sample.status === 'NEEDS_REVISION'
          ? 'Vui lòng đính kèm thêm tối thiểu 02 báo giá so sánh cho máy pha cà phê trước khi gửi duyệt lại.'
          : null,
        sample.status === 'COMPLETED'
          ? 'Đã ban hành hướng dẫn sử dụng toàn công ty và vận hành ổn định.'
          : sample.status === 'IN_EXECUTION'
            ? 'Đã đăng ký lịch khai giảng khóa đầu tiên cho 4 kỹ sư Backend.'
            : null,
        adminUserId,
        adminUserId,
      ],
    );

    const proposalId = Number(inserted.insertId);
    for (let i = 0; i < sample.items.length; i += 1) {
      const it = sample.items[i];
      await conn.execute(
        `INSERT INTO proposal_items (
          proposal_id, line_no, item_name, specification, unit, quantity, unit_price, line_total, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          proposalId,
          i + 1,
          it.name,
          it.spec,
          it.unit,
          it.qty,
          it.price,
          it.qty * it.price,
          adminUserId,
          adminUserId,
        ],
      );
    }

    if (sample.needsApproval && (highValueWorkflowId || standardWorkflowId)) {
      const wfId =
        estimatedBudget >= PROPOSAL_HIGH_VALUE_THRESHOLD_VND && highValueWorkflowId
          ? highValueWorkflowId
          : (standardWorkflowId ?? highValueWorkflowId!);
      const totalSteps =
        estimatedBudget >= PROPOSAL_HIGH_VALUE_THRESHOLD_VND && highValueWorkflowId ? 3 : 2;
      const [arInserted] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO approval_requests (
          workflow_id, module_code, request_type, entity_type, entity_id,
          branch_id, requester_id, title, summary, current_step, total_steps,
          current_approver_user_id, current_approver_role_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, 'PENDING')`,
        [
          wfId,
          PROPOSAL_MODULE_CODE,
          PROPOSAL_DEFAULT_REQUEST_TYPE,
          PROPOSAL_ENTITY_TYPE,
          proposalId,
          hqId,
          adminUserId,
          `[${sample.code}] ${sample.title}`,
          `Dự toán: ${estimatedBudget.toLocaleString('vi-VN')} ₫`,
          totalSteps,
          deptManagerRoleId,
        ],
      );
      const arId = Number(arInserted.insertId);
      await conn.execute(
        `INSERT INTO approval_histories (approval_request_id, step_order, actor_id, action, comment)
         VALUES (?, 1, ?, 'SUBMIT', 'Gửi đề xuất phê duyệt tự động')`,
        [arId, adminUserId],
      );
      await conn.execute('UPDATE proposals SET approval_request_id = ? WHERE id = ?', [
        arId,
        proposalId,
      ]);
    }

    if (sample.status === 'NEEDS_REVISION') {
      await conn.execute(
        `INSERT INTO proposal_comments (proposal_id, author_user_id, comment_type, content, created_by, updated_by)
         VALUES (?, ?, 'REVISION_REQUEST', ?, ?, ?)`,
        [
          proposalId,
          adminUserId,
          'Vui lòng đính kèm thêm tối thiểu 02 báo giá so sánh cho máy pha cà phê trước khi gửi duyệt lại.',
          adminUserId,
          adminUserId,
        ],
      );
    }

    await conn.execute(
      `INSERT INTO proposal_activities (proposal_id, actor_user_id, action_type, detail_json)
       VALUES (?, ?, 'CREATED', ?)`,
      [proposalId, adminUserId, JSON.stringify({ proposalCode: sample.code, estimatedBudget })],
    );
  }
}

async function seedDefaultItRequestsModule(
  conn: Connection,
  roleMap: Map<string, number>,
): Promise<void> {
  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM branches WHERE code = ? LIMIT 1',
    ['HQ'],
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );
  if (hqRows.length === 0 || adminRows.length === 0) {
    return;
  }

  const hqId = Number(hqRows[0].id);
  const adminUserId = Number(adminRows[0].id);
  const itRoleId = roleMap.get('IT_SUPPORT') ?? roleMap.get('ADMIN_OPS') ?? roleMap.get('SUPER_ADMIN')!;
  const deptManagerRoleId = roleMap.get('DEPT_MANAGER') ?? roleMap.get('SUPER_ADMIN')!;
  const executiveRoleId = roleMap.get('EXECUTIVE') ?? roleMap.get('SUPER_ADMIN')!;

  // 1. Seed IT Support user account (idempotent)
  const itEmail = 'it.support@operonhub.local';
  const [existingItUsers] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [itEmail],
  );
  let itUserId = adminUserId;
  if (existingItUsers.length > 0) {
    itUserId = Number(existingItUsers[0].id);
  } else {
    const itPasswordHash = await hashPassword('ItSupport@123');
    const [insertedIt] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (email, password_hash, full_name, status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [itEmail, itPasswordHash, 'Nguyễn Minh Khôi (IT Support)'],
    );
    itUserId = Number(insertedIt.insertId);
  }
  await conn.execute(
    'INSERT IGNORE INTO user_roles (user_id, role_id, branch_id) VALUES (?, ?, NULL)',
    [itUserId, itRoleId],
  );

  // 2. Seed 6 bilingual IT Request categories
  for (const cat of DEFAULT_IT_REQUEST_CATEGORIES) {
    await conn.execute(
      `INSERT INTO it_request_categories (
        code, name, name_en, description, request_kind, requires_approval,
        default_priority, sla_response_hours, sla_resolution_hours, color, sort_order, is_active, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        description = VALUES(description),
        request_kind = VALUES(request_kind),
        requires_approval = VALUES(requires_approval),
        default_priority = VALUES(default_priority),
        sla_response_hours = VALUES(sla_response_hours),
        sla_resolution_hours = VALUES(sla_resolution_hours),
        color = VALUES(color),
        sort_order = VALUES(sort_order),
        deleted_at = NULL`,
      [
        cat.code,
        cat.name,
        cat.nameEn,
        cat.description,
        cat.requestKind,
        cat.requiresApproval ? 1 : 0,
        cat.defaultPriority,
        cat.slaResponseHours,
        cat.slaResolutionHours,
        cat.color,
        cat.sortOrder,
        adminUserId,
        adminUserId,
      ],
    );
  }

  // 3. Seed 2 IT Approval Workflows (Access/Software & Hardware Provisioning)
  async function ensureItWorkflow(
    requestType: string,
    name: string,
    nameEn: string,
    description: string,
    steps: Array<{ order: number; type: 'DIRECT_MANAGER' | 'ROLE'; roleId: number | null }>,
  ): Promise<number> {
    const [existingWf] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM approval_workflows
       WHERE module_code = ? AND request_type = ? AND deleted_at IS NULL
       ORDER BY id ASC LIMIT 1`,
      [IT_REQUEST_MODULE_CODE, requestType],
    );
    if (existingWf.length > 0) {
      return Number(existingWf[0].id);
    }
    const [wfRes] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO approval_workflows (
        module_code, request_type, branch_id, name, name_en, description, conditions_json, is_active, created_by, updated_by
      ) VALUES (?, ?, NULL, ?, ?, ?, NULL, 1, ?, ?)`,
      [IT_REQUEST_MODULE_CODE, requestType, name, nameEn, description, adminUserId, adminUserId],
    );
    const wfId = Number(wfRes.insertId);
    for (const st of steps) {
      await conn.execute(
        `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
         VALUES (?, ?, ?, ?, NULL)`,
        [wfId, st.order, st.type, st.roleId],
      );
    }
    return wfId;
  }

  const accessWfId = await ensureItWorkflow(
    IT_REQUEST_ACCESS_SOFTWARE_TYPE,
    'Duyệt cấp tài khoản & bản quyền phần mềm IT',
    'IT Account Access & Software License Approval',
    'Trưởng bộ phận xác nhận nhu cầu công việc trước khi IT cấp quyền hoặc cài bản quyền.',
    [
      { order: 1, type: 'DIRECT_MANAGER', roleId: deptManagerRoleId },
      { order: 2, type: 'ROLE', roleId: itRoleId },
    ],
  );

  const hardwareWfId = await ensureItWorkflow(
    IT_REQUEST_HARDWARE_TYPE,
    'Duyệt đề nghị cấp phát thiết bị IT mới',
    'IT New Hardware Provisioning Approval',
    'Trưởng bộ phận và Ban Giám đốc phê duyệt cấp phát máy tính/thiết bị mới.',
    [
      { order: 1, type: 'DIRECT_MANAGER', roleId: deptManagerRoleId },
      { order: 2, type: 'ROLE', roleId: executiveRoleId },
    ],
  );

  // 4. Seed 6 diverse sample IT tickets (idempotent by code)
  const [catRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM it_request_categories WHERE deleted_at IS NULL',
  );
  const [deptRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM departments WHERE deleted_at IS NULL',
  );
  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
    [adminUserId],
  );
  const [assetRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM assets WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 2',
  );

  const catMap = new Map<string, number>(catRows.map((c) => [String(c.code), Number(c.id)]));
  const deptMap = new Map<string, number>(deptRows.map((d) => [String(d.code), Number(d.id)]));
  const adminEmpId = empRows.length > 0 ? Number(empRows[0].id) : null;
  const firstAssetId = assetRows.length > 0 ? Number(assetRows[0].id) : null;
  const secondAssetId = assetRows.length > 1 ? Number(assetRows[1].id) : firstAssetId;
  const now = Date.now();
  const hourMs = 3_600_000;

  const sampleTickets = [
    {
      code: 'ITR-202611-0001',
      categoryCode: 'IT_NETWORK_VPN',
      kind: 'INCIDENT',
      deptCode: 'TECH',
      title: 'Không kết nối được VPN FortiClient từ mạng nhà khi truy cập Staging',
      description:
        'Từ sáng nay khi bật FortiClient VPN báo lỗi "Credential or SSLVPN configuration is wrong (-7200)" dù đã nhập đúng mật khẩu SSO. Cần hỗ trợ kiểm tra chứng chỉ VPN gấp để kịp deploy bản vá.',
      priority: 'URGENT',
      status: 'IN_PROGRESS',
      assetId: firstAssetId,
      assignedTo: itUserId,
      estimatedCost: 0,
      locationDetail: 'Tầng 5 — Khu Kỹ thuật',
      contactPhone: '0901234567',
      responseDueAt: new Date(now + 1 * hourMs),
      resolutionDueAt: new Date(now + 3 * hourMs),
      firstRespondedAt: new Date(now - 0.5 * hourMs),
      needsApproval: false,
      workflowId: null as number | null,
      checklist: [
        { title: 'Kiểm tra log xác thực SSL-VPN trên FortiGate', isDone: true },
        { title: 'Cấp lại token 2FA và đồng bộ LDAP', isDone: false },
      ],
      resolutionSummary: null as string | null,
      rating: null as number | null,
      feedback: null as string | null,
    },
    {
      code: 'ITR-202611-0002',
      categoryCode: 'IT_HARDWARE_ISSUE',
      kind: 'INCIDENT',
      deptCode: 'HR',
      title: 'Laptop không nhận màn hình ngoài qua cổng USB-C tại phòng họp B2',
      description:
        'Cắm cáp USB-C sang màn hình rời báo không có tín hiệu (No Signal), đã thử đổi dây khác vẫn không nhận. Cần IT kiểm tra driver đồ họa hoặc cổng chuyển.',
      priority: 'HIGH',
      status: 'OPEN',
      assetId: secondAssetId,
      assignedTo: null as number | null,
      estimatedCost: 0,
      locationDetail: 'Tầng 4 — Phòng Nhân sự',
      contactPhone: '0908889900',
      responseDueAt: new Date(now + 1.5 * hourMs),
      resolutionDueAt: new Date(now + 6 * hourMs),
      firstRespondedAt: null as Date | null,
      needsApproval: false,
      workflowId: null as number | null,
      checklist: [],
      resolutionSummary: null,
      rating: null,
      feedback: null,
    },
    {
      code: 'ITR-202611-0003',
      categoryCode: 'IT_SOFTWARE_LICENSE',
      kind: 'SERVICE_REQUEST',
      deptCode: 'TECH',
      title: 'Cấp bản quyền JetBrains All Products Pack cho kỹ sư Backend mới',
      description:
        'Đề nghị cấp 01 license JetBrains All Products Pack (1 năm) cho thành viên mới gia nhập dự án Operon Hub Phase 2 để phục vụ phát triển và review mã nguồn.',
      priority: 'MEDIUM',
      status: 'PENDING_APPROVAL',
      assetId: null,
      assignedTo: null,
      estimatedCost: 6800000,
      locationDetail: 'Tầng 5 — Khu Kỹ thuật',
      contactPhone: '0901234567',
      responseDueAt: null as Date | null,
      resolutionDueAt: null as Date | null,
      firstRespondedAt: null,
      needsApproval: true,
      workflowId: accessWfId,
      checklist: [
        { title: 'Xác minh ngân sách bản quyền phần mềm Q4', isDone: false },
        { title: 'Cấp license trên JetBrains Organization Portal', isDone: false },
      ],
      resolutionSummary: null,
      rating: null,
      feedback: null,
    },
    {
      code: 'ITR-202611-0004',
      categoryCode: 'IT_ACCOUNT_ACCESS',
      kind: 'ACCESS_REQUEST',
      deptCode: 'HR',
      title: 'Cấp quyền truy cập thư mục báo cáo nhân sự trên SharePoint & NAS',
      description:
        'Yêu cầu mở quyền đọc/ghi thư mục /HR/BaoCao2026 trên máy chủ NAS nội bộ để tổng hợp dữ liệu đánh giá cuối năm.',
      priority: 'MEDIUM',
      status: 'WAITING_USER',
      assetId: null,
      assignedTo: itUserId,
      estimatedCost: 0,
      locationDetail: 'Tầng 4 — Phòng Nhân sự',
      contactPhone: '0907654321',
      responseDueAt: new Date(now - 2 * hourMs),
      resolutionDueAt: new Date(now + 10 * hourMs),
      firstRespondedAt: new Date(now - 3 * hourMs),
      needsApproval: false,
      workflowId: null,
      checklist: [
        { title: 'Kiểm tra nhóm quyền Active Directory hiện tại', isDone: true },
        { title: 'Chờ xác nhận danh sách thư mục con cần cấp quyền', isDone: false },
      ],
      resolutionSummary: null,
      rating: null,
      feedback: null,
    },
    {
      code: 'ITR-202611-0005',
      categoryCode: 'IT_NEW_EQUIPMENT',
      kind: 'HARDWARE_PROVISION',
      deptCode: 'TECH',
      title: 'Cấp phát bộ bàn phím cơ không dây & chuột công thái học thay thế',
      description:
        'Bàn phím cũ bị liệt phím Enter và chuột đôi lúc double-click. Đã được phê duyệt cấp bộ phụ kiện chuẩn IT mới.',
      priority: 'LOW',
      status: 'RESOLVED',
      assetId: firstAssetId,
      assignedTo: itUserId,
      estimatedCost: 2450000,
      locationDetail: 'Tầng 5 — Khu Kỹ thuật',
      contactPhone: '0901234567',
      responseDueAt: new Date(now - 10 * hourMs),
      resolutionDueAt: new Date(now + 12 * hourMs),
      firstRespondedAt: new Date(now - 12 * hourMs),
      needsApproval: false,
      workflowId: hardwareWfId,
      checklist: [
        { title: 'Xuất kho bộ bàn phím Logitech MX Keys & chuột MX Master 3S', isDone: true },
        { title: 'Dán tem tài sản và bàn giao trực tiếp tại bàn làm việc', isDone: true },
      ],
      resolutionSummary:
        'Đã xuất kho và bàn giao trực tiếp bộ bàn phím & chuột mới, kiểm tra kết nối Bluetooth hoạt động ổn định. Mời anh/chị xác nhận nghiệm thu.',
      rating: null,
      feedback: null,
    },
    {
      code: 'ITR-202611-0006',
      categoryCode: 'IT_SECURITY_SUPPORT',
      kind: 'INCIDENT',
      deptCode: 'BOD',
      title: 'Khôi phục thư mục hợp đồng bị xóa nhầm trên ổ dùng chung tuần trước',
      description:
        'Nhờ đội IT khôi phục giúp thư mục HopDong_Q4_2026 bị xóa nhầm lúc 15h00 ngày hôm qua trên máy chủ dữ liệu nội bộ.',
      priority: 'HIGH',
      status: 'CLOSED',
      assetId: null,
      assignedTo: itUserId,
      estimatedCost: 0,
      locationDetail: 'Tầng 6 — Văn phòng Ban Giám đốc',
      contactPhone: '0902223344',
      responseDueAt: new Date(now - 24 * hourMs),
      resolutionDueAt: new Date(now - 18 * hourMs),
      firstRespondedAt: new Date(now - 24.5 * hourMs),
      needsApproval: false,
      workflowId: null,
      checklist: [
        { title: 'Truy xuất snapshot backup 12h00 ngày hôm qua', isDone: true },
        { title: 'Khôi phục đầy đủ 42 tệp tin và xác minh toàn vẹn dữ liệu', isDone: true },
      ],
      resolutionSummary:
        'Đã khôi phục toàn bộ 42 tệp hợp đồng từ bản sao lưu snapshot 12h00, không mất dữ liệu và đã khóa quyền xóa cứng cho nhóm người dùng phổ thông.',
      rating: 5,
      feedback: 'Đội IT xử lý cực kỳ nhanh chóng và chuyên nghiệp!',
    },
  ];

  for (const sample of sampleTickets) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM it_requests WHERE code = ? LIMIT 1',
      [sample.code],
    );
    if (existing.length > 0) {
      continue;
    }
    const categoryId = catMap.get(sample.categoryCode) ?? Array.from(catMap.values())[0];
    if (!categoryId) {
      continue;
    }
    const departmentId = deptMap.get(sample.deptCode) ?? null;
    const isResolved = sample.status === 'RESOLVED' || sample.status === 'CLOSED';
    const isClosed = sample.status === 'CLOSED';

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO it_requests (
        code, category_id, request_kind, title, description, priority, status,
        requester_user_id, requester_employee_id, branch_id, department_id, asset_id,
        assigned_to_user_id, estimated_cost, location_detail, contact_phone,
        sla_response_due_at, sla_resolution_due_at, first_responded_at, sla_paused_at, sla_paused_minutes,
        submitted_at, resolved_at, closed_at, resolution_summary,
        satisfaction_rating, satisfaction_feedback, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sample.code,
        categoryId,
        sample.kind,
        sample.title,
        sample.description,
        sample.priority,
        sample.status,
        adminUserId,
        adminEmpId,
        hqId,
        departmentId,
        sample.assetId,
        sample.assignedTo,
        sample.estimatedCost,
        sample.locationDetail,
        sample.contactPhone,
        sample.responseDueAt,
        sample.resolutionDueAt,
        sample.firstRespondedAt,
        sample.status === 'WAITING_USER' ? new Date(now - 1 * hourMs) : null,
        new Date(now - 2 * hourMs),
        isResolved ? new Date(now - (isClosed ? 20 : 1) * hourMs) : null,
        isClosed ? new Date(now - 19 * hourMs) : null,
        sample.resolutionSummary,
        sample.rating,
        sample.feedback,
        adminUserId,
        adminUserId,
      ],
    );
    const ticketId = Number(inserted.insertId);

    for (let i = 0; i < sample.checklist.length; i += 1) {
      const ck = sample.checklist[i];
      await conn.execute(
        `INSERT INTO it_request_checklist_items (
          it_request_id, title, is_done, done_by_user_id, done_at, sort_order, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ticketId,
          ck.title,
          ck.isDone ? 1 : 0,
          ck.isDone ? itUserId : null,
          ck.isDone ? new Date() : null,
          i + 1,
          itUserId,
          itUserId,
        ],
      );
    }

    if (sample.needsApproval && sample.workflowId) {
      const [arInserted] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO approval_requests (
          workflow_id, module_code, request_type, entity_type, entity_id,
          branch_id, requester_id, title, summary, current_step, total_steps,
          current_approver_user_id, current_approver_role_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 2, NULL, ?, 'PENDING')`,
        [
          sample.workflowId,
          IT_REQUEST_MODULE_CODE,
          IT_REQUEST_ACCESS_SOFTWARE_TYPE,
          IT_REQUEST_ENTITY_TYPE,
          ticketId,
          hqId,
          adminUserId,
          `[${sample.code}] ${sample.title}`,
          sample.estimatedCost > 0
            ? `Chi phí dự kiến: ${sample.estimatedCost.toLocaleString('vi-VN')} ₫`
            : 'Yêu cầu phê duyệt dịch vụ IT',
          deptManagerRoleId,
        ],
      );
      const arId = Number(arInserted.insertId);
      await conn.execute(
        `INSERT INTO approval_histories (approval_request_id, step_order, actor_id, action, comment)
         VALUES (?, 1, ?, 'SUBMIT', 'Gửi yêu cầu IT phê duyệt tự động')`,
        [arId, adminUserId],
      );
      await conn.execute('UPDATE it_requests SET approval_request_id = ? WHERE id = ?', [
        arId,
        ticketId,
      ]);
    }

    if (sample.status === 'WAITING_USER') {
      await conn.execute(
        `INSERT INTO it_request_comments (it_request_id, author_user_id, visibility, comment_type, content, created_by, updated_by)
         VALUES (?, ?, 'PUBLIC', 'STATUS_NOTE', ?, ?, ?)`,
        [
          ticketId,
          itUserId,
          'Nhờ anh/chị xác nhận danh sách cụ thể các thư mục con trong /HR/BaoCao2026 cần cấp quyền Ghi để IT cấu hình chính xác.',
          itUserId,
          itUserId,
        ],
      );
    }

    await conn.execute(
      `INSERT INTO it_request_activities (it_request_id, actor_user_id, action, summary, metadata_json)
       VALUES (?, ?, 'CREATED', ?, ?)`,
      [
        ticketId,
        adminUserId,
        `Tạo yêu cầu hỗ trợ IT [${sample.code}]`,
        JSON.stringify({ code: sample.code, status: sample.status }),
      ],
    );
  }
}

async function seedDefaultPaymentsModule(
  conn: Connection,
  roleMap: Map<string, number>,
): Promise<void> {
  const [branchRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );
  if (branchRows.length === 0 || adminRows.length === 0) {
    return;
  }

  const hqId = Number(branchRows[0].id);
  const adminUserId = Number(adminRows[0].id);
  const financeRoleId = roleMap.get('FINANCE_ACCOUNTANT') ?? roleMap.get('SUPER_ADMIN')!;
  const deptManagerRoleId = roleMap.get('DEPT_MANAGER') ?? roleMap.get('SUPER_ADMIN')!;
  const executiveRoleId = roleMap.get('EXECUTIVE') ?? roleMap.get('SUPER_ADMIN')!;

  // 1. Seed Finance Accountant user (idempotent)
  const financeEmail = 'finance@operonhub.local';
  const [existingFinanceUsers] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [financeEmail],
  );
  let financeUserId: number;
  if (existingFinanceUsers.length > 0) {
    financeUserId = Number(existingFinanceUsers[0].id);
  } else {
    const pwdHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (email, password_hash, full_name, status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [financeEmail, pwdHash, 'Nguyễn Minh Thu (Kế toán Thanh toán)'],
    );
    financeUserId = Number(inserted.insertId);
  }
  await conn.execute(
    'INSERT IGNORE INTO user_roles (user_id, role_id, branch_id) VALUES (?, ?, NULL)',
    [financeUserId, financeRoleId],
  );

  // 2. Seed 6 bilingual payment categories
  for (const cat of DEFAULT_PAYMENT_CATEGORIES) {
    await conn.execute(
      `INSERT INTO payment_categories (
        code, name, name_en, description, default_payment_type, requires_receipt,
        color, sort_order, is_active, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        name_en = VALUES(name_en),
        description = VALUES(description),
        default_payment_type = VALUES(default_payment_type),
        requires_receipt = VALUES(requires_receipt),
        color = VALUES(color),
        sort_order = VALUES(sort_order)`,
      [
        cat.code,
        cat.name,
        cat.nameEn,
        cat.description,
        cat.defaultPaymentType,
        cat.requiresReceipt ? 1 : 0,
        cat.color,
        cat.sortOrder,
        adminUserId,
        adminUserId,
      ],
    );
  }

  // 3. Seed 2 payment approval workflows (< 20M: 2 steps; >= 20M: 3 steps with Executive)
  async function ensurePaymentWorkflow(
    name: string,
    nameEn: string,
    description: string,
    conditions: Record<string, number> | null,
    steps: Array<{ order: number; type: 'DIRECT_MANAGER' | 'ROLE'; roleId: number }>,
  ): Promise<number> {
    const [existingWf] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT id FROM approval_workflows
       WHERE module_code = ? AND request_type = ? AND name = ? AND deleted_at IS NULL
       LIMIT 1`,
      [PAYMENT_MODULE_CODE, PAYMENT_DEFAULT_REQUEST_TYPE, name],
    );
    if (existingWf.length > 0) {
      return Number(existingWf[0].id);
    }
    const [insertedWf] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO approval_workflows (
        module_code, request_type, branch_id, name, name_en, description, conditions_json, is_active, created_by, updated_by
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, 1, ?, ?)`,
      [
        PAYMENT_MODULE_CODE,
        PAYMENT_DEFAULT_REQUEST_TYPE,
        name,
        nameEn,
        description,
        conditions ? JSON.stringify(conditions) : null,
        adminUserId,
        adminUserId,
      ],
    );
    const wfId = Number(insertedWf.insertId);
    for (const st of steps) {
      await conn.execute(
        `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver_type, approver_role_id, approver_user_id)
         VALUES (?, ?, ?, ?, NULL)`,
        [wfId, st.order, st.type, st.roleId],
      );
    }
    return wfId;
  }

  const highValueWfId = await ensurePaymentWorkflow(
    'Phê duyệt Thanh toán Giá trị Cao (>= 20 triệu VNĐ)',
    'High-Value Payment Approval (>= 20M VND)',
    'Trưởng bộ phận → Kế toán Thanh toán kiểm soát chứng từ → Ban Giám đốc duyệt chi.',
    { minAmount: PAYMENT_HIGH_VALUE_THRESHOLD_VND },
    [
      { order: 1, type: 'DIRECT_MANAGER', roleId: deptManagerRoleId },
      { order: 2, type: 'ROLE', roleId: financeRoleId },
      { order: 3, type: 'ROLE', roleId: executiveRoleId },
    ],
  );

  const standardWfId = await ensurePaymentWorkflow(
    'Phê duyệt Thanh toán Tiêu chuẩn (< 20 triệu VNĐ)',
    'Standard Payment Approval (< 20M VND)',
    'Trưởng bộ phận xác nhận → Kế toán Thanh toán kiểm soát chứng từ và duyệt chi.',
    { maxAmount: PAYMENT_HIGH_VALUE_THRESHOLD_VND - 1 },
    [
      { order: 1, type: 'DIRECT_MANAGER', roleId: deptManagerRoleId },
      { order: 2, type: 'ROLE', roleId: financeRoleId },
    ],
  );

  // 4. Seed 6 diverse sample payment requests (idempotent by code)
  const [catRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM payment_categories WHERE deleted_at IS NULL',
  );
  const [deptRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM departments WHERE deleted_at IS NULL',
  );
  const [empRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, full_name, bank_name, bank_account_no FROM employees WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
    [adminUserId],
  );
  const [proposalRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM proposals WHERE status IN ('APPROVED', 'IN_EXECUTION') AND deleted_at IS NULL ORDER BY id ASC LIMIT 1",
  );
  const [projectRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM projects WHERE status IN ('PLANNING', 'ACTIVE') AND deleted_at IS NULL ORDER BY id ASC LIMIT 1",
  );

  const catMap = new Map<string, number>(catRows.map((c) => [String(c.code), Number(c.id)]));
  const deptMap = new Map<string, number>(deptRows.map((d) => [String(d.code), Number(d.id)]));
  const adminEmpId = empRows.length > 0 ? Number(empRows[0].id) : null;
  const adminBankName = (empRows[0]?.bank_name as string | null) ?? 'Vietcombank';
  const adminBankAcc = (empRows[0]?.bank_account_no as string | null) ?? '0011004567890';
  const linkedProposalId = proposalRows.length > 0 ? Number(proposalRows[0].id) : null;
  const linkedProjectId = projectRows.length > 0 ? Number(projectRows[0].id) : null;

  const samplePayments = [
    {
      code: 'PAY-202611-0001',
      paymentType: 'CASH_ADVANCE',
      categoryCode: 'MARKETING_EVENT',
      deptCode: 'OPS',
      title: 'Tạm ứng chi phí tổ chức Hội nghị Khách hàng Q4/2026 tại TP.HCM',
      description:
        'Đề nghị tạm ứng chi phí đặt cọc sảnh hội thảo, in ấn backdrop và tài liệu đón khách cho sự kiện ra mắt sản phẩm Q4/2026.',
      priority: 'HIGH',
      status: 'PAID',
      paymentMethod: 'BANK_TRANSFER',
      beneficiaryType: 'EMPLOYEE',
      beneficiaryName: 'Quản trị Hệ thống',
      beneficiaryTaxCode: null,
      bankName: adminBankName,
      bankAccountNo: adminBankAcc,
      bankBranch: 'Chi nhánh TP.HCM',
      dueDate: '2026-11-22',
      advanceDueDate: '2026-12-05',
      proposalId: linkedProposalId,
      projectId: null,
      items: [
        {
          description: 'Đặt cọc thuê sảnh hội thảo + âm thanh ánh sáng (50%)',
          invoiceNo: null,
          invoiceDate: null,
          quantity: 1,
          unitPrice: 12_000_000,
          taxRate: 0,
          note: 'Cọc trước giữ lịch phòng',
        },
        {
          description: 'In ấn standee, tài liệu và quà tặng check-in khách mời',
          invoiceNo: null,
          invoiceDate: null,
          quantity: 1,
          unitPrice: 3_000_000,
          taxRate: 0,
          note: 'Quyết toán kèm hóa đơn VAT sau sự kiện',
        },
      ],
      disbursements: [
        {
          direction: 'OUTGOING',
          date: '2026-11-21',
          amount: 15_000_000,
          method: 'BANK_TRANSFER',
          ref: 'FT26325901842',
          sourceAccount: 'VCB — 0071000889900 (Operon Hub)',
          note: 'Chuyển khoản tạm ứng đủ 100% theo duyệt',
        },
      ],
      needsPendingApproval: false,
      workflowId: standardWfId,
    },
    {
      code: 'PAY-202611-0002',
      paymentType: 'VENDOR_PAYMENT',
      categoryCode: 'IT_SOFTWARE_OPS',
      deptCode: 'TECH',
      title: 'Thanh toán hóa đơn hạ tầng Cloud Server & bản quyền Monitoring Q4/2026',
      description:
        'Thanh toán theo hợp đồng dịch vụ máy chủ sản xuất và gói giám sát uptime tháng 11–12/2026 kèm hóa đơn VAT điện tử.',
      priority: 'URGENT',
      status: 'APPROVED',
      paymentMethod: 'BANK_TRANSFER',
      beneficiaryType: 'VENDOR',
      beneficiaryName: 'Công ty TNHH Hạ tầng Điện toán Đám mây Việt',
      beneficiaryTaxCode: '0314567890',
      bankName: 'Techcombank',
      bankAccountNo: '19034567890011',
      bankBranch: 'Chi nhánh Sài Gòn',
      dueDate: '2026-11-28',
      advanceDueDate: null,
      proposalId: null,
      projectId: linkedProjectId,
      items: [
        {
          description: 'Thuê cụm Kubernetes Production Cluster (2 tháng)',
          invoiceNo: 'VAT-2026-00481',
          invoiceDate: '2026-11-20',
          quantity: 2,
          unitPrice: 11_000_000,
          taxRate: 10,
          note: 'HĐ điện tử đã đối chiếu hợp đồng',
        },
        {
          description: 'Gói Managed Backup & Log Retention 90 ngày',
          invoiceNo: 'VAT-2026-00481',
          invoiceDate: '2026-11-20',
          quantity: 1,
          unitPrice: 4_000_000,
          taxRate: 10,
          note: 'Gộp chung hóa đơn VAT-2026-00481',
        },
      ],
      disbursements: [],
      needsPendingApproval: false,
      workflowId: highValueWfId,
    },
    {
      code: 'PAY-202611-0003',
      paymentType: 'REIMBURSEMENT',
      categoryCode: 'TRAVEL_TRIP',
      deptCode: 'HR',
      title: 'Hoàn ứng công tác phí tuyển dụng & khảo sát chi nhánh Hà Nội',
      description:
        'Đề nghị hoàn ứng chi phí vé máy bay khứ hồi, khách sạn 2 đêm và di chuyển công tác chi nhánh phía Bắc đợt 18–20/11/2026.',
      priority: 'MEDIUM',
      status: 'PENDING_APPROVAL',
      paymentMethod: 'BANK_TRANSFER',
      beneficiaryType: 'EMPLOYEE',
      beneficiaryName: 'Quản trị Hệ thống',
      beneficiaryTaxCode: null,
      bankName: adminBankName,
      bankAccountNo: adminBankAcc,
      bankBranch: 'Chi nhánh TP.HCM',
      dueDate: '2026-11-30',
      advanceDueDate: null,
      proposalId: null,
      projectId: null,
      items: [
        {
          description: 'Vé máy bay khứ hồi SGN - HAN (Vietnam Airlines)',
          invoiceNo: 'VNA-8892014',
          invoiceDate: '2026-11-18',
          quantity: 1,
          unitPrice: 3_600_000,
          taxRate: 8,
          note: 'Có cuống vé & hóa đơn điện tử',
        },
        {
          description: 'Khách sạn công tác 2 đêm gần văn phòng Hà Nội',
          invoiceNo: 'KS-2026-1192',
          invoiceDate: '2026-11-20',
          quantity: 2,
          unitPrice: 1_250_000,
          taxRate: 8,
          note: 'Đúng định mức 1,3 triệu/đêm',
        },
      ],
      disbursements: [],
      needsPendingApproval: true,
      workflowId: standardWfId,
    },
    {
      code: 'PAY-202611-0004',
      paymentType: 'VENDOR_PAYMENT',
      categoryCode: 'VENDOR_INVOICE',
      deptCode: 'OPS',
      title: 'Thanh toán đợt 1 hợp đồng bảo trì hệ thống điều hòa & PCCC văn phòng',
      description:
        'Thanh toán theo tiến độ nghiệm thu đợt 1 (50%) và giữ lại 50% sau khi hoàn tất kiểm định toàn bộ tầng 5–6.',
      priority: 'HIGH',
      status: 'PARTIALLY_PAID',
      paymentMethod: 'BANK_TRANSFER',
      beneficiaryType: 'VENDOR',
      beneficiaryName: 'Công ty CP Kỹ thuật Cơ điện An Khang',
      beneficiaryTaxCode: '0319988776',
      bankName: 'ACB',
      bankAccountNo: '8866224499',
      bankBranch: 'PGD Quận 1',
      dueDate: '2026-11-29',
      advanceDueDate: null,
      proposalId: null,
      projectId: null,
      items: [
        {
          description: 'Bảo trì định kỳ 14 máy lạnh trung tâm & vệ sinh ống gió',
          invoiceNo: 'AK-2026-072',
          invoiceDate: '2026-11-19',
          quantity: 1,
          unitPrice: 20_000_000,
          taxRate: 10,
          note: 'Thanh toán chia 2 đợt 50% / 50%',
        },
      ],
      disbursements: [
        {
          direction: 'OUTGOING',
          date: '2026-11-23',
          amount: 11_000_000,
          method: 'BANK_TRANSFER',
          ref: 'FT26327441092',
          sourceAccount: 'VCB — 0071000889900 (Operon Hub)',
          note: 'Giải ngân đợt 1 (50% giá trị sau VAT)',
        },
      ],
      needsPendingApproval: false,
      workflowId: highValueWfId,
    },
    {
      code: 'PAY-202611-0005',
      paymentType: 'REIMBURSEMENT',
      categoryCode: 'OFFICE_ADMIN',
      deptCode: 'OPS',
      title: 'Thanh toán văn phòng phẩm, mực in và nước uống tháng 11/2026',
      description:
        'Tổng hợp hóa đơn mua văn phòng phẩm định kỳ và bình nước uống cho văn phòng trụ sở chính trong tháng 11.',
      priority: 'LOW',
      status: 'NEEDS_REVISION',
      paymentMethod: 'CASH',
      beneficiaryType: 'EMPLOYEE',
      beneficiaryName: 'Quản trị Hệ thống',
      beneficiaryTaxCode: null,
      bankName: null,
      bankAccountNo: null,
      bankBranch: null,
      dueDate: '2026-12-02',
      advanceDueDate: null,
      proposalId: null,
      projectId: null,
      items: [
        {
          description: 'Giấy A4 Double A, bút viết & hộp mực máy in laser',
          invoiceNo: 'VPP-2026-309',
          invoiceDate: '2026-11-22',
          quantity: 1,
          unitPrice: 2_450_000,
          taxRate: 8,
          note: 'Cần bổ sung biên bản bàn giao kho hành chính',
        },
      ],
      disbursements: [],
      needsPendingApproval: false,
      workflowId: standardWfId,
      revisionNote: 'Vui lòng đính kèm ảnh chụp biên bản giao nhận văn phòng phẩm có chữ ký thủ kho.',
    },
    {
      code: 'PAY-202611-0006',
      paymentType: 'CASH_ADVANCE',
      categoryCode: 'PROJECT_EXPENSE',
      deptCode: 'TECH',
      title: 'Tạm ứng chi phí triển khai khảo sát hiện trường dự án khách hàng miền Trung',
      description:
        'Bản nháp đề nghị tạm ứng chi phí di chuyển và lưu trú cho đội dự án khảo sát hệ thống tại Đà Nẵng đầu tháng 12.',
      priority: 'MEDIUM',
      status: 'DRAFT',
      paymentMethod: 'BANK_TRANSFER',
      beneficiaryType: 'EMPLOYEE',
      beneficiaryName: 'Quản trị Hệ thống',
      beneficiaryTaxCode: null,
      bankName: adminBankName,
      bankAccountNo: adminBankAcc,
      bankBranch: 'Chi nhánh TP.HCM',
      dueDate: '2026-12-04',
      advanceDueDate: '2026-12-18',
      proposalId: null,
      projectId: linkedProjectId,
      items: [
        {
          description: 'Dự trù chi phí vé máy bay & lưu trú nhóm kỹ thuật (2 người)',
          invoiceNo: null,
          invoiceDate: null,
          quantity: 2,
          unitPrice: 4_500_000,
          taxRate: 0,
          note: 'Sẽ cập nhật lịch trình chính thức trước khi gửi duyệt',
        },
      ],
      disbursements: [],
      needsPendingApproval: false,
      workflowId: standardWfId,
    },
  ] as const;

  for (const sample of samplePayments) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM payment_requests WHERE code = ? LIMIT 1',
      [sample.code],
    );
    if (existing.length > 0) {
      continue;
    }

    const categoryId = catMap.get(sample.categoryCode) ?? Array.from(catMap.values())[0];
    if (!categoryId) {
      continue;
    }
    const departmentId = deptMap.get(sample.deptCode) ?? null;

    let subtotal = 0;
    let tax = 0;
    let total = 0;
    const computedItems = sample.items.map((it) => {
      const sub = Math.round(it.quantity * it.unitPrice * 100) / 100;
      const t = Math.round(((sub * it.taxRate) / 100) * 100) / 100;
      const lt = Math.round((sub + t) * 100) / 100;
      subtotal += sub;
      tax += t;
      total += lt;
      return { ...it, sub, t, lt };
    });

    const disbursedTotal = sample.disbursements.reduce((acc, d) => acc + d.amount, 0);
    const isApprovedOrPaid =
      sample.status === 'APPROVED' ||
      sample.status === 'PARTIALLY_PAID' ||
      sample.status === 'PAID';
    const isSubmitted = sample.status !== 'DRAFT';

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO payment_requests (
        code, payment_type, category_id, title, description, priority, status,
        requester_user_id, requester_employee_id, branch_id, department_id,
        proposal_id, project_id, linked_advance_id, is_settled,
        payment_method, beneficiary_type, beneficiary_name, beneficiary_tax_code,
        bank_name, bank_account_no, bank_branch, currency,
        subtotal_amount, tax_amount, total_amount, advance_amount, net_settlement_amount,
        payable_amount, approved_amount, disbursed_amount,
        due_date, advance_due_date, submitted_at, approved_at, paid_at, revision_note,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?, ?, ?, ?, 'VND', ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sample.code,
        sample.paymentType,
        categoryId,
        sample.title,
        sample.description,
        sample.priority,
        sample.status,
        adminUserId,
        adminEmpId,
        hqId,
        departmentId,
        sample.proposalId,
        sample.projectId,
        sample.paymentMethod,
        sample.beneficiaryType,
        sample.beneficiaryName,
        sample.beneficiaryTaxCode,
        sample.bankName,
        sample.bankAccountNo,
        sample.bankBranch,
        subtotal,
        tax,
        total,
        total,
        isApprovedOrPaid ? total : null,
        disbursedTotal,
        sample.dueDate,
        sample.advanceDueDate,
        isSubmitted ? new Date(Date.now() - 48 * 3_600_000) : null,
        isApprovedOrPaid ? new Date(Date.now() - 24 * 3_600_000) : null,
        sample.status === 'PAID' ? new Date(Date.now() - 12 * 3_600_000) : null,
        'revisionNote' in sample ? sample.revisionNote : null,
        adminUserId,
        adminUserId,
      ],
    );
    const paymentId = Number(inserted.insertId);

    for (let i = 0; i < computedItems.length; i += 1) {
      const it = computedItems[i];
      await conn.execute(
        `INSERT INTO payment_request_items (
          payment_request_id, description, invoice_no, invoice_date,
          quantity, unit_price, tax_rate, subtotal_amount, tax_amount, line_total, note, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          it.description,
          it.invoiceNo,
          it.invoiceDate,
          it.quantity,
          it.unitPrice,
          it.taxRate,
          it.sub,
          it.t,
          it.lt,
          it.note,
          i + 1,
        ],
      );
    }

    for (const d of sample.disbursements) {
      await conn.execute(
        `INSERT INTO payment_disbursements (
          payment_request_id, direction, disbursement_date, amount, payment_method,
          bank_transaction_ref, source_account, note, disbursed_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          d.direction,
          d.date,
          d.amount,
          d.method,
          d.ref,
          d.sourceAccount,
          d.note,
          financeUserId,
        ],
      );
    }

    if (sample.needsPendingApproval) {
      const [arInserted] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO approval_requests (
          workflow_id, module_code, request_type, entity_type, entity_id,
          branch_id, requester_id, title, summary, current_step, total_steps,
          current_approver_user_id, current_approver_role_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 2, NULL, ?, 'PENDING')`,
        [
          sample.workflowId,
          PAYMENT_MODULE_CODE,
          PAYMENT_DEFAULT_REQUEST_TYPE,
          PAYMENT_ENTITY_TYPE,
          paymentId,
          hqId,
          adminUserId,
          `[${sample.code}] ${sample.title}`,
          `Tổng đề nghị: ${total.toLocaleString('vi-VN')} ₫`,
          deptManagerRoleId,
        ],
      );
      const arId = Number(arInserted.insertId);
      await conn.execute(
        `INSERT INTO approval_histories (approval_request_id, step_order, actor_id, action, comment)
         VALUES (?, 1, ?, 'SUBMIT', 'Gửi đề nghị thanh toán phê duyệt tự động')`,
        [arId, adminUserId],
      );
      await conn.execute('UPDATE payment_requests SET approval_request_id = ? WHERE id = ?', [
        arId,
        paymentId,
      ]);
    }

    if (sample.status === 'NEEDS_REVISION' && 'revisionNote' in sample) {
      await conn.execute(
        `INSERT INTO payment_comments (payment_request_id, author_user_id, comment_type, content, created_by, updated_by)
         VALUES (?, ?, 'REVISION_REQUEST', ?, ?, ?)`,
        [paymentId, financeUserId, sample.revisionNote, financeUserId, financeUserId],
      );
    }

    await conn.execute(
      `INSERT INTO payment_activities (payment_request_id, actor_user_id, action, summary, metadata_json)
       VALUES (?, ?, 'CREATED', ?, ?)`,
      [
        paymentId,
        adminUserId,
        `Khởi tạo đề nghị thanh toán [${sample.code}]`,
        JSON.stringify({ code: sample.code, paymentType: sample.paymentType, totalAmount: total }),
      ],
    );
  }
}

async function seedDefaultPaymentBudgets(conn: Connection): Promise<void> {
  const [budgetTables] = await conn.execute<mysql.RowDataPacket[]>(
    "SHOW TABLES LIKE 'payment_budgets'",
  );
  if (budgetTables.length === 0) {
    return;
  }

  const [hqRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM branches WHERE code = 'HQ' AND deleted_at IS NULL LIMIT 1",
  );
  const [adminRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [DEFAULT_ADMIN_EMAIL],
  );
  if (hqRows.length === 0 || adminRows.length === 0) {
    return;
  }

  const hqId = Number(hqRows[0].id);
  const adminUserId = Number(adminRows[0].id);
  const [financeRows] = await conn.execute<mysql.RowDataPacket[]>(
    "SELECT id FROM users WHERE email = 'finance@operonhub.local' AND deleted_at IS NULL LIMIT 1",
  );
  const ownerUserId = financeRows.length > 0 ? Number(financeRows[0].id) : adminUserId;

  const [deptRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM departments WHERE deleted_at IS NULL',
  );
  const [catRows] = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT id, code FROM payment_categories WHERE deleted_at IS NULL',
  );
  const deptMap = new Map<string, number>(deptRows.map((d) => [String(d.code), Number(d.id)]));
  const catMap = new Map<string, number>(catRows.map((c) => [String(c.code), Number(c.id)]));

  const budgetIdMap = new Map<string, number>();

  for (const seed of DEFAULT_PAYMENT_BUDGETS_2026) {
    const [existing] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM payment_budgets WHERE code = ? LIMIT 1',
      [seed.code],
    );
    if (existing.length > 0) {
      budgetIdMap.set(seed.code, Number(existing[0].id));
      continue;
    }

    const departmentId = seed.deptCode ? deptMap.get(seed.deptCode) ?? null : null;
    const categoryId = seed.categoryCode ? catMap.get(seed.categoryCode) ?? null : null;

    const [inserted] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO payment_budgets (
        code, name, name_en, description, fiscal_year, period_type, period_label,
        start_date, end_date, branch_id, department_id, category_id, project_id,
        owner_user_id, currency, allocated_amount, reserved_amount, spent_amount,
        warning_threshold_percent, enforcement_mode, status, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'VND', ?, 0.00, 0.00, ?, ?, 'ACTIVE', ?, ?)`,
      [
        seed.code,
        seed.name,
        seed.nameEn,
        seed.description,
        seed.fiscalYear,
        seed.periodType,
        seed.periodLabel,
        seed.startDate,
        seed.endDate,
        hqId,
        departmentId,
        categoryId,
        ownerUserId,
        seed.allocatedAmount,
        seed.warningThresholdPercent,
        seed.enforcementMode,
        adminUserId,
        adminUserId,
      ],
    );

    const budgetId = Number(inserted.insertId);
    budgetIdMap.set(seed.code, budgetId);

    await conn.execute(
      `INSERT INTO payment_budget_transactions (
        budget_id, tx_type, source_type, source_id, source_code, related_budget_id,
        allocated_delta, reserved_delta, spent_delta,
        balance_allocated_after, balance_reserved_after, balance_spent_after, balance_available_after,
        note, actor_user_id
      ) VALUES (?, 'ALLOCATE', 'MANUAL', NULL, ?, NULL, ?, 0.00, 0.00, ?, 0.00, 0.00, ?, ?, ?)`,
      [
        budgetId,
        seed.code,
        seed.allocatedAmount,
        seed.allocatedAmount,
        seed.allocatedAmount,
        `Cấp hạn mức ngân sách ban đầu kỳ ${seed.periodLabel}`,
        adminUserId,
      ],
    );
  }

  // Link sample proposals to matching budgets (idempotent — only when budget_id IS NULL)
  const proposalLinks: Array<{ proposalCode: string; budgetCode: string }> = [
    { proposalCode: 'PROP-202611-0001', budgetCode: 'BUD-2026-TECH-001' },
    { proposalCode: 'PROP-202611-0002', budgetCode: 'BUD-2026-MKT-001' },
    { proposalCode: 'PROP-202611-0003', budgetCode: 'BUD-2026-HR-001' },
  ];

  for (const link of proposalLinks) {
    const budgetId = budgetIdMap.get(link.budgetCode);
    if (!budgetId) continue;

    const [pRows] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id, proposal_code, status, estimated_budget, approved_budget, budget_id FROM proposals WHERE proposal_code = ? AND deleted_at IS NULL LIMIT 1',
      [link.proposalCode],
    );
    if (pRows.length === 0 || pRows[0].budget_id !== null) {
      continue;
    }

    const prop = pRows[0];
    const propId = Number(prop.id);
    const shouldReserve = ['PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION'].includes(String(prop.status));
    const reserveAmt = shouldReserve
      ? Number(prop.approved_budget ?? prop.estimated_budget ?? 0)
      : 0;

    await conn.execute(
      'UPDATE proposals SET budget_id = ?, budget_reserved_amount = ? WHERE id = ?',
      [budgetId, reserveAmt, propId],
    );

    if (reserveAmt > 0) {
      await conn.execute(
        'UPDATE payment_budgets SET reserved_amount = reserved_amount + ? WHERE id = ?',
        [reserveAmt, budgetId],
      );
      const [bRows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT allocated_amount, reserved_amount, spent_amount FROM payment_budgets WHERE id = ?',
        [budgetId],
      );
      if (bRows.length > 0) {
        const alloc = Number(bRows[0].allocated_amount);
        const resv = Number(bRows[0].reserved_amount);
        const spent = Number(bRows[0].spent_amount);
        await conn.execute(
          `INSERT INTO payment_budget_transactions (
            budget_id, tx_type, source_type, source_id, source_code, related_budget_id,
            allocated_delta, reserved_delta, spent_delta,
            balance_allocated_after, balance_reserved_after, balance_spent_after, balance_available_after,
            note, actor_user_id
          ) VALUES (?, 'RESERVE', 'PROPOSAL', ?, ?, NULL, 0.00, ?, 0.00, ?, ?, ?, ?, ?, ?)`,
          [
            budgetId,
            propId,
            link.proposalCode,
            reserveAmt,
            alloc,
            resv,
            spent,
            alloc - resv - spent,
            `Giữ chỗ ngân sách cho Đề xuất ${link.proposalCode}`,
            adminUserId,
          ],
        );
      }
    }
  }

  // Link sample payments to matching budgets (idempotent — only when budget_id IS NULL)
  const paymentLinks: Array<{ paymentCode: string; budgetCode: string }> = [
    { paymentCode: 'PAY-202611-0001', budgetCode: 'BUD-2026-TECH-001' },
    { paymentCode: 'PAY-202611-0002', budgetCode: 'BUD-2026-HR-001' },
    { paymentCode: 'PAY-202611-0003', budgetCode: 'BUD-2026-MKT-001' },
    { paymentCode: 'PAY-202611-0004', budgetCode: 'BUD-2026-OPS-001' },
    { paymentCode: 'PAY-202611-0006', budgetCode: 'BUD-2026-PROJ-001' },
  ];

  for (const link of paymentLinks) {
    const budgetId = budgetIdMap.get(link.budgetCode);
    if (!budgetId) continue;

    const [payRows] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id, code, status, total_amount, disbursed_amount, budget_id FROM payment_requests WHERE code = ? AND deleted_at IS NULL LIMIT 1',
      [link.paymentCode],
    );
    if (payRows.length === 0 || payRows[0].budget_id !== null) {
      continue;
    }

    const pay = payRows[0];
    const payId = Number(pay.id);
    const total = Number(pay.total_amount ?? 0);
    const disbursed = Number(pay.disbursed_amount ?? 0);
    const status = String(pay.status);
    const isActiveHold = ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID'].includes(status);
    const reservedAmt = isActiveHold ? Math.max(0, total - disbursed) : 0;
    const spentAmt = disbursed;

    await conn.execute(
      'UPDATE payment_requests SET budget_id = ?, budget_reserved_amount = ?, budget_spent_amount = ? WHERE id = ?',
      [budgetId, reservedAmt, spentAmt, payId],
    );

    if (reservedAmt > 0 || spentAmt > 0) {
      await conn.execute(
        'UPDATE payment_budgets SET reserved_amount = reserved_amount + ?, spent_amount = spent_amount + ? WHERE id = ?',
        [reservedAmt, spentAmt, budgetId],
      );
      const [bRows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT allocated_amount, reserved_amount, spent_amount FROM payment_budgets WHERE id = ?',
        [budgetId],
      );
      if (bRows.length > 0) {
        const alloc = Number(bRows[0].allocated_amount);
        const resv = Number(bRows[0].reserved_amount);
        const spent = Number(bRows[0].spent_amount);
        await conn.execute(
          `INSERT INTO payment_budget_transactions (
            budget_id, tx_type, source_type, source_id, source_code, related_budget_id,
            allocated_delta, reserved_delta, spent_delta,
            balance_allocated_after, balance_reserved_after, balance_spent_after, balance_available_after,
            note, actor_user_id
          ) VALUES (?, ?, 'PAYMENT', ?, ?, NULL, 0.00, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            budgetId,
            spentAmt > 0 ? 'CONSUME' : 'RESERVE',
            payId,
            link.paymentCode,
            reservedAmt,
            spentAmt,
            alloc,
            resv,
            spent,
            alloc - resv - spent,
            spentAmt > 0
              ? `Hạch toán chi ngân sách cho Phiếu thanh toán ${link.paymentCode}`
              : `Giữ chỗ ngân sách cho Phiếu thanh toán ${link.paymentCode}`,
            ownerUserId,
          ],
        );
      }
    }
  }
}

export async function runCoreSeed(): Promise<void> {
  assertLocalDevEnvironment(process.env);
  const env = parseServerEnv(process.env);

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4',
  });

  try {
    await seedDefaultBranch(conn);
    const roleMap = await seedRolesAndPermissions(conn);
    const superAdminRoleId = roleMap.get('SUPER_ADMIN');
    if (!superAdminRoleId) {
      throw new Error('Không khởi tạo được vai trò SUPER_ADMIN.');
    }
    await seedSuperAdminUser(conn, superAdminRoleId);
    await seedDefaultApprovalWorkflows(conn, roleMap);
    await seedDefaultHrmOrganization(conn);
    await seedDefaultHrmEmployees(conn);
    await seedDefaultHrmContractsAndHistories(conn);
    await seedDefaultHrmLeaves(conn);
    await seedDefaultHrmAttendance(conn);
    await seedDefaultHrmPayrollConfig(conn);
    await seedDefaultHrmAssets(conn);
    await seedDefaultHrmRoomsAndAnnouncements(conn);
    await seedDefaultProposalsModule(conn, roleMap);
    await seedDefaultItRequestsModule(conn, roleMap);
    await seedDefaultPaymentsModule(conn, roleMap);
    await seedDefaultPaymentBudgets(conn);
    console.log(
      '[SEED CORE OK] Đã khởi tạo chi nhánh HQ, 11 roles, permissions, Super Admin, IT Support, Kế toán Thanh toán, quy trình duyệt, cơ cấu tổ chức, hồ sơ NV, hợp đồng, quỹ phép, chấm công, cấu hình lương, kho tài sản, phòng họp, thông báo, Đề xuất, IT Request, Đề nghị Thanh toán & 5 Quỹ Ngân sách FY2026 mẫu.',
    );
  } finally {
    await conn.end();
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  runCoreSeed().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SEED ERROR] ${message}`);
    process.exit(1);
  });
}
