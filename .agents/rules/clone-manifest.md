---
trigger: manual
description: Bản đồ phân loại khung nền dự án (CORE / OPTIONAL / EXCLUDE) và Entry Points dùng cho Agent Cloner khi nhân bản dự án mới.
---

# Project Clone Manifest (Boilerplate Blueprint)

## 1. CORE — Luôn giữ khi Clone (Khung nền bắt buộc)
- **Hệ thống AI:** `.ai/agents/`, `.ai/rules/`, `.ai/skills/`, `.ai/scripts/`, `AGENTS.md`
- **Cấu hình gốc:** `package.json`, `tsconfig.json`, `.eslintrc*`, `.gitignore`, `.env.example`, `Dockerfile`
- **Xác thực & Phân quyền (Auth/RBAC):** `src/modules/auth/`, `src/modules/users/`, `src/modules/roles/`
- **Hạ tầng chung:** `src/config/database.*`, `src/middlewares/` (auth, error, rate-limit, upload), `src/lib/portable/`
- **Layout & UI khung:** `src/layouts/`, `src/components/ui/` (table, modal, form, toast)
- **Database Core:** Bảng `users`, `roles`, `permissions`, `role_permissions`, `refresh_tokens`, `audit_logs`, `settings`

## 2. OPTIONAL — Chọn giữ theo nhu cầu dự án mới
- `[cms]` Quản lý nội dung (bài viết, danh mục, media): `src/modules/cms/`, bảng `posts`, `categories`, `media`
- `[notification]` Thông báo / Email queue: `src/modules/notifications/`, bảng `notifications`
- `[multi-tenant]` Phân tách đa tổ chức/dự án: `src/modules/tenants/`, bảng `tenants`

## 3. EXCLUDE — Tuyệt đối KHÔNG giữ (Nghiệp vụ & Dữ liệu cũ)
- **Nghiệp vụ cũ:** Toàn bộ thư mục nghiệp vụ khác trong `src/modules/` (vd: `src/modules/hrm/`, `src/app/api/v1/hrm/`, `src/app/(portal)/hrm/`, `src/components/hrm/`, `invoices/`, `recipes/`, `orders/`, `payments/`...)
- **Database nghiệp vụ:** Các file migration/seed của bảng nghiệp vụ cũ
- **Dữ liệu nhạy cảm & Runtime:** `.env`, `.git/`, `node_modules/`, `dist/`, `uploads/`, `*.log`
- **Lịch sử AI cũ:** `.ai/logs/work/*`, `.ai/logs/test/*`, `.ai/reports/*` (tạo mới thư mục rỗng ở dự án mới)

## 4. Điểm cần cắt nối lại sau khi Clone (Entry Points)
Danh sách các file trung tâm thường import chéo sang module nghiệp vụ (Cloner bắt buộc mở kiểm tra và gỡ dòng thừa):
- `src/routes/index.*` (hoặc `src/app.*`)
- `src/components/Sidebar.*` (menu điều hướng)
- `database/schema.sql` hoặc `prisma/schema.prisma`
- `package.json` (tên dự án, description, version về `1.0.0`, gỡ package chỉ dùng cho nghiệp vụ cũ)