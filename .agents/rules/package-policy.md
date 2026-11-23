---
trigger: model_decision
description: Chính sách cài đặt thư viện 100% license MIT và quy trình kiểm tra bắt buộc bằng check-license.js trước và sau khi cài.
---

# Package Installation & License Policy (MIT-Only)

## A. Chính sách bản quyền (License)
- **Mặc định chỉ cho phép:** `MIT` (khớp chính xác).
- **Từ chối tự động:** `GPL`, `AGPL`, `LGPL`, `Apache-2.0`, `BSD`, `ISC`, `MPL`, `Proprietary`, `UNLICENSED`, hoặc không xác định được license.
- **Ngoại lệ:** Nếu bắt buộc cần package ngoài MIT (không có giải pháp thay thế), AI phải DỪNG LẠI, báo rõ tên package + loại license + lý do, và chỉ được cài sau khi người dùng xác nhận bằng văn bản trong phiên chat.

## B. Quy trình bắt buộc trước khi cài Package mới
1. **Ưu tiên không cài thêm:** Kiểm tra xem API gốc của ngôn ngữ hoặc `.ai/rules/reusable-registry.md` đã giải quyết được chưa.
2. **Kiểm tra License trước khi tải:**
   - Chạy lệnh: `node .ai/scripts/check-license.js --pkg <package-name>`
   - Chỉ được phép cài khi script trả về `ALLOWED (MIT)` (exit code `0`).
3. **Kiểm tra an toàn & tương thích:**
   - Không cài package đã bị `deprecated` hoặc không có bản cập nhật bảo mật khi dính lỗ hổng `high`/`critical`.
   - Phân tách đúng `dependencies` (chạy production) và `devDependencies` (chỉ phục vụ dev/test/build).
4. **Hậu kiểm toàn dự án:**
   - Sau khi cài xong, chạy `node .ai/scripts/check-license.js --audit` để chắc chắn các gói trực tiếp trong `package.json` đều là MIT.
5. **Ghi nhận vào Work Log:** Ghi rõ `Tên package`, `Version`, `License: MIT`, và `Lý do cần cài` vào `.ai/logs/work/`.

## C. Quy tắc cấm
- Cấm tự ý cài package toàn cục (`npm install -g`).
- Cấm dùng cờ `--force` hoặc `--legacy-peer-deps` nếu chưa có xác nhận từ người dùng.
- Cấm nâng cấp major version của các package lõi hiện có ngoài phạm vi task của Planner.