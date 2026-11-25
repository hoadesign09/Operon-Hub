-- UP
ALTER TABLE branches ADD COLUMN name_en VARCHAR(160) NULL AFTER name;
ALTER TABLE roles ADD COLUMN name_en VARCHAR(120) NULL AFTER name;
ALTER TABLE permissions ADD COLUMN name_en VARCHAR(200) NULL AFTER name;
ALTER TABLE approval_workflows ADD COLUMN name_en VARCHAR(200) NULL AFTER name;
ALTER TABLE departments ADD COLUMN name_en VARCHAR(160) NULL AFTER name;
ALTER TABLE positions ADD COLUMN name_en VARCHAR(160) NULL AFTER name;
ALTER TABLE leave_types ADD COLUMN name_en VARCHAR(160) NULL AFTER name;
ALTER TABLE work_shifts ADD COLUMN name_en VARCHAR(160) NULL AFTER name;
ALTER TABLE holidays ADD COLUMN name_en VARCHAR(180) NULL AFTER name;
ALTER TABLE meeting_rooms ADD COLUMN name_en VARCHAR(160) NULL AFTER name;
ALTER TABLE project_board_columns ADD COLUMN name_en VARCHAR(120) NULL AFTER name;
ALTER TABLE project_templates ADD COLUMN name_en VARCHAR(200) NULL AFTER name;

-- Backfill Branches
UPDATE branches SET name_en = 'Headquarters' WHERE code = 'HQ' AND (name_en IS NULL OR name_en = '');

-- Backfill Roles
UPDATE roles SET name_en = 'System Administrator' WHERE code = 'SUPER_ADMIN' AND (name_en IS NULL OR name_en = '');
UPDATE roles SET name_en = 'Executive Board' WHERE code = 'EXECUTIVE' AND (name_en IS NULL OR name_en = '');
UPDATE roles SET name_en = 'HR Manager' WHERE code = 'HR_MANAGER' AND (name_en IS NULL OR name_en = '');
UPDATE roles SET name_en = 'HR Specialist' WHERE code = 'HR_STAFF' AND (name_en IS NULL OR name_en = '');
UPDATE roles SET name_en = 'Payroll Accountant (C&B)' WHERE code = 'PAYROLL_ACCOUNTANT' AND (name_en IS NULL OR name_en = '');
UPDATE roles SET name_en = 'Office Operations' WHERE code = 'ADMIN_OPS' AND (name_en IS NULL OR name_en = '');
UPDATE roles SET name_en = 'Department Manager' WHERE code = 'DEPT_MANAGER' AND (name_en IS NULL OR name_en = '');
UPDATE roles SET name_en = 'Employee' WHERE code = 'EMPLOYEE' AND (name_en IS NULL OR name_en = '');
UPDATE roles SET name_en = 'PMO Manager' WHERE code = 'PMO_MANAGER' AND (name_en IS NULL OR name_en = '');

-- Backfill Permissions (Core)
UPDATE permissions SET name_en = 'View branch directory' WHERE code = 'core.branches.read';
UPDATE permissions SET name_en = 'Create branch' WHERE code = 'core.branches.create';
UPDATE permissions SET name_en = 'Update branch' WHERE code = 'core.branches.update';
UPDATE permissions SET name_en = 'Archive branch' WHERE code = 'core.branches.delete';
UPDATE permissions SET name_en = 'View user accounts' WHERE code = 'core.users.read';
UPDATE permissions SET name_en = 'Create user account' WHERE code = 'core.users.create';
UPDATE permissions SET name_en = 'Update user account & assign roles' WHERE code = 'core.users.update';
UPDATE permissions SET name_en = 'View roles & permission matrix' WHERE code = 'core.roles.read';
UPDATE permissions SET name_en = 'Update role permissions' WHERE code = 'core.roles.update';
UPDATE permissions SET name_en = 'View system audit logs' WHERE code = 'core.audit_logs.read';
UPDATE permissions SET name_en = 'View system settings' WHERE code = 'core.settings.read';
UPDATE permissions SET name_en = 'Update system settings' WHERE code = 'core.settings.update';
UPDATE permissions SET name_en = 'View approval inbox & workflows' WHERE code = 'core.approvals.read';
UPDATE permissions SET name_en = 'Approve or reject requests' WHERE code = 'core.approvals.act';
UPDATE permissions SET name_en = 'Configure multi-step approval workflows' WHERE code = 'core.approvals.workflow_manage';

-- Backfill Permissions (HRM)
UPDATE permissions SET name_en = 'View HRM overview dashboard' WHERE code = 'hrm.dashboard.read';
UPDATE permissions SET name_en = 'View organization chart, departments & positions' WHERE code = 'hrm.org.read';
UPDATE permissions SET name_en = 'Manage departments & job positions' WHERE code = 'hrm.org.manage';
UPDATE permissions SET name_en = 'View employee profiles (by Data Scope)' WHERE code = 'hrm.employees.read';
UPDATE permissions SET name_en = 'Create employee profile' WHERE code = 'hrm.employees.create';
UPDATE permissions SET name_en = 'Update employee profile & documents' WHERE code = 'hrm.employees.update';
UPDATE permissions SET name_en = 'Archive employee profile' WHERE code = 'hrm.employees.delete';
UPDATE permissions SET name_en = 'Export employee directory to Excel' WHERE code = 'hrm.employees.export';
UPDATE permissions SET name_en = 'View labor contracts & work history' WHERE code = 'hrm.contracts.read';
UPDATE permissions SET name_en = 'Manage labor contracts & career decisions' WHERE code = 'hrm.contracts.manage';
UPDATE permissions SET name_en = 'Export labor contracts to Excel' WHERE code = 'hrm.contracts.export';
UPDATE permissions SET name_en = 'View leave requests & balances (by Data Scope)' WHERE code = 'hrm.requests.read';
UPDATE permissions SET name_en = 'Create & submit personal requests (ESS)' WHERE code = 'hrm.requests.create';
UPDATE permissions SET name_en = 'Manage leave types & annual leave balances' WHERE code = 'hrm.requests.manage';
UPDATE permissions SET name_en = 'Export leave requests to Excel' WHERE code = 'hrm.requests.export';
UPDATE permissions SET name_en = 'View work shifts, holidays & attendance logs' WHERE code = 'hrm.attendance.read';
UPDATE permissions SET name_en = 'Manage work shifts, assignments, holidays & attendance' WHERE code = 'hrm.attendance.manage';
UPDATE permissions SET name_en = 'Import attendance logs from Excel' WHERE code = 'hrm.attendance.import';
UPDATE permissions SET name_en = 'Lock & unlock monthly timesheets' WHERE code = 'hrm.attendance.lock';
UPDATE permissions SET name_en = 'Export attendance data to Excel' WHERE code = 'hrm.attendance.export';
UPDATE permissions SET name_en = 'View payroll periods, payslips & tax/SI config' WHERE code = 'hrm.payroll.read';
UPDATE permissions SET name_en = 'Run payroll, adjust bonuses/deductions & config' WHERE code = 'hrm.payroll.manage';
UPDATE permissions SET name_en = 'Approve, reopen & confirm payroll payout' WHERE code = 'hrm.payroll.approve';
UPDATE permissions SET name_en = 'Export payroll Excel & payslip PDF' WHERE code = 'hrm.payroll.export';
UPDATE permissions SET name_en = 'View asset inventory & assignment history' WHERE code = 'hrm.assets.read';
UPDATE permissions SET name_en = 'Manage assets, handovers, returns & maintenance' WHERE code = 'hrm.assets.manage';
UPDATE permissions SET name_en = 'Export asset Excel & handover PDF' WHERE code = 'hrm.assets.export';
UPDATE permissions SET name_en = 'View meeting rooms & booking schedule' WHERE code = 'hrm.rooms.read';
UPDATE permissions SET name_en = 'Book meeting rooms & manage own bookings' WHERE code = 'hrm.rooms.book';
UPDATE permissions SET name_en = 'Manage meeting rooms & coordinate all bookings' WHERE code = 'hrm.rooms.manage';
UPDATE permissions SET name_en = 'Read company announcements & news' WHERE code = 'hrm.announcements.read';
UPDATE permissions SET name_en = 'Draft, publish, pin & track company announcements' WHERE code = 'hrm.announcements.manage';

-- Backfill Permissions (Projects)
UPDATE permissions SET name_en = 'View Project Portfolio dashboard' WHERE code = 'pm.dashboard.read';
UPDATE permissions SET name_en = 'View project list and details within scope' WHERE code = 'pm.projects.read';
UPDATE permissions SET name_en = 'Create projects and submit Charter for approval' WHERE code = 'pm.projects.create';
UPDATE permissions SET name_en = 'Manage project portfolio, archiving & PM handover' WHERE code = 'pm.projects.manage';
UPDATE permissions SET name_en = 'View project tasks and My Tasks' WHERE code = 'pm.tasks.read';
UPDATE permissions SET name_en = 'Create tasks, subtasks, checklists & dependencies' WHERE code = 'pm.tasks.create';
UPDATE permissions SET name_en = 'Update task status, progress, comments & files' WHERE code = 'pm.tasks.update';
UPDATE permissions SET name_en = 'Archive or soft-delete tasks' WHERE code = 'pm.tasks.delete';
UPDATE permissions SET name_en = 'Manage Sprints and Backlog prioritization' WHERE code = 'pm.sprints.manage';
UPDATE permissions SET name_en = 'Log work hours on project tasks' WHERE code = 'pm.timelogs.log';
UPDATE permissions SET name_en = 'Review and approve team/project timesheets' WHERE code = 'pm.timelogs.approve';
UPDATE permissions SET name_en = 'View Resource Workload Heatmap' WHERE code = 'pm.workload.read';
UPDATE permissions SET name_en = 'View project budget and cost tracking' WHERE code = 'pm.budget.read';
UPDATE permissions SET name_en = 'Manage project budget, expenses & change requests' WHERE code = 'pm.budget.manage';
UPDATE permissions SET name_en = 'Manage Project Risks & Issues (RAID)' WHERE code = 'pm.risks.manage';
UPDATE permissions SET name_en = 'Manage Project Templates & Automation Rules' WHERE code = 'pm.templates.manage';
UPDATE permissions SET name_en = 'Export Project reports to Excel and PDF' WHERE code = 'pm.reports.export';

-- Backfill Approval Workflows
UPDATE approval_workflows SET name_en = 'Standard Leave Approval Workflow (2 Steps)' WHERE module_code = 'hrm' AND request_type = 'LEAVE' AND (name_en IS NULL OR name_en = '');
UPDATE approval_workflows SET name_en = 'Overtime (OT) Approval Workflow (1 Step)' WHERE module_code = 'hrm' AND request_type = 'OVERTIME' AND (name_en IS NULL OR name_en = '');
UPDATE approval_workflows SET name_en = 'Business Trip Approval Workflow (2 Steps)' WHERE module_code = 'hrm' AND request_type = 'BUSINESS_TRIP' AND (name_en IS NULL OR name_en = '');
UPDATE approval_workflows SET name_en = 'Project Charter Approval Workflow' WHERE module_code = 'projects' AND request_type = 'PM_PROJECT_CHARTER' AND (name_en IS NULL OR name_en = '');
UPDATE approval_workflows SET name_en = 'Project Milestone Sign-off Workflow' WHERE module_code = 'projects' AND request_type = 'PM_MILESTONE_SIGNOFF' AND (name_en IS NULL OR name_en = '');
UPDATE approval_workflows SET name_en = 'Project Budget Change Approval Workflow' WHERE module_code = 'projects' AND request_type = 'PM_BUDGET_CHANGE' AND (name_en IS NULL OR name_en = '');

-- Backfill Departments
UPDATE departments SET name_en = 'Board of Directors' WHERE code = 'BOD' AND (name_en IS NULL OR name_en = '');
UPDATE departments SET name_en = 'Human Resources & Administration' WHERE code = 'HR' AND (name_en IS NULL OR name_en = '');
UPDATE departments SET name_en = 'Finance & Accounting' WHERE code = 'FIN' AND (name_en IS NULL OR name_en = '');
UPDATE departments SET name_en = 'Information Technology' WHERE code = 'TECH' AND (name_en IS NULL OR name_en = '');

-- Backfill Positions
UPDATE positions SET name_en = 'Chief Executive Officer (CEO)' WHERE code = 'CEO' AND (name_en IS NULL OR name_en = '');
UPDATE positions SET name_en = 'Department Head' WHERE code = 'DEPT_HEAD' AND (name_en IS NULL OR name_en = '');
UPDATE positions SET name_en = 'Team Lead' WHERE code = 'TEAM_LEAD' AND (name_en IS NULL OR name_en = '');
UPDATE positions SET name_en = 'Senior Specialist' WHERE code = 'SENIOR' AND (name_en IS NULL OR name_en = '');
UPDATE positions SET name_en = 'Staff / Specialist' WHERE code = 'STAFF' AND (name_en IS NULL OR name_en = '');
UPDATE positions SET name_en = 'Intern' WHERE code = 'INTERN' AND (name_en IS NULL OR name_en = '');

-- Backfill Leave Types
UPDATE leave_types SET name_en = 'Annual Leave' WHERE code = 'ANNUAL' AND (name_en IS NULL OR name_en = '');
UPDATE leave_types SET name_en = 'Sick Leave (Social Insurance)' WHERE code = 'SICK' AND (name_en IS NULL OR name_en = '');
UPDATE leave_types SET name_en = 'Unpaid Leave' WHERE code = 'UNPAID' AND (name_en IS NULL OR name_en = '');
UPDATE leave_types SET name_en = 'Marriage Leave' WHERE code = 'MARRIAGE' AND (name_en IS NULL OR name_en = '');
UPDATE leave_types SET name_en = 'Bereavement Leave' WHERE code = 'BEREAVEMENT' AND (name_en IS NULL OR name_en = '');

-- Backfill Work Shifts
UPDATE work_shifts SET name_en = 'Standard Office Shift' WHERE code = 'HC' AND (name_en IS NULL OR name_en = '');
UPDATE work_shifts SET name_en = 'Flexible Morning Shift' WHERE code = 'CA_SANG' AND (name_en IS NULL OR name_en = '');

-- Backfill Holidays
UPDATE holidays SET name_en = 'New Year''s Day 2026' WHERE holiday_date = '2026-01-01' AND (name_en IS NULL OR name_en = '');
UPDATE holidays SET name_en = 'Hung Kings'' Commemoration Day (10/3 Lunar)' WHERE holiday_date = '2026-04-26' AND (name_en IS NULL OR name_en = '');
UPDATE holidays SET name_en = 'Reunification Day (Apr 30)' WHERE holiday_date = '2026-04-30' AND (name_en IS NULL OR name_en = '');
UPDATE holidays SET name_en = 'International Labor Day (May 1)' WHERE holiday_date = '2026-05-01' AND (name_en IS NULL OR name_en = '');
UPDATE holidays SET name_en = 'Vietnam National Day (Sep 2)' WHERE holiday_date = '2026-09-02' AND (name_en IS NULL OR name_en = '');

-- Backfill Meeting Rooms
UPDATE meeting_rooms SET name_en = 'Main Boardroom' WHERE code = 'PH-01' AND (name_en IS NULL OR name_en = '');
UPDATE meeting_rooms SET name_en = 'Focus Room A' WHERE code = 'PH-02' AND (name_en IS NULL OR name_en = '');
UPDATE meeting_rooms SET name_en = 'Training & Conference Hall' WHERE code = 'PH-03' AND (name_en IS NULL OR name_en = '');

-- Backfill Project Board Columns
UPDATE project_board_columns SET name_en = 'Backlog' WHERE code = 'BACKLOG' AND (name_en IS NULL OR name_en = '');
UPDATE project_board_columns SET name_en = 'To Do' WHERE code = 'TODO' AND (name_en IS NULL OR name_en = '');
UPDATE project_board_columns SET name_en = 'In Progress' WHERE code = 'IN_PROGRESS' AND (name_en IS NULL OR name_en = '');
UPDATE project_board_columns SET name_en = 'In Review' WHERE code = 'IN_REVIEW' AND (name_en IS NULL OR name_en = '');
UPDATE project_board_columns SET name_en = 'Blocked' WHERE code = 'BLOCKED' AND (name_en IS NULL OR name_en = '');
UPDATE project_board_columns SET name_en = 'Done' WHERE code = 'DONE' AND (name_en IS NULL OR name_en = '');

-- Backfill Project Templates
UPDATE project_templates SET name_en = 'Standard Agile Scrum Software Project Template' WHERE code = 'TPL-SCRUM-STD' AND (name_en IS NULL OR name_en = '');
UPDATE project_templates SET name_en = 'Internal Operations Rollout Campaign Template' WHERE code = 'TPL-OPS-ROLLOUT' AND (name_en IS NULL OR name_en = '');

-- DOWN
ALTER TABLE project_templates DROP COLUMN name_en;
ALTER TABLE project_board_columns DROP COLUMN name_en;
ALTER TABLE meeting_rooms DROP COLUMN name_en;
ALTER TABLE holidays DROP COLUMN name_en;
ALTER TABLE work_shifts DROP COLUMN name_en;
ALTER TABLE leave_types DROP COLUMN name_en;
ALTER TABLE positions DROP COLUMN name_en;
ALTER TABLE departments DROP COLUMN name_en;
ALTER TABLE approval_workflows DROP COLUMN name_en;
ALTER TABLE permissions DROP COLUMN name_en;
ALTER TABLE roles DROP COLUMN name_en;
ALTER TABLE branches DROP COLUMN name_en;
