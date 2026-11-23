---
trigger: always_on
description: Vòng đời 6 Phases, 5 Human Gates và Live Progress Card.
---

# Workflow Protocol & Live Progress Display

## A. Vòng đời chuẩn của 1 Task (6 Phases)
Mọi yêu cầu tính năng mới hoặc thay đổi lớn bắt buộc đi qua đủ 6 Phase theo đúng thứ tự:

| Phase | Tên Phase | Agent phụ trách | Trạng thái | Điểm dừng (Gate) |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Khởi tạo & Định danh Task | System / Planner | `INIT` | Tự động cấp `TASK-YYYYMMDD-NN` |
| **Phase 1** | Phân tích, Thiết kế & Match Regression | **Planner** | `PLANNING` | **GATE 1 (Bắt buộc dừng):** Chờ người dùng duyệt Plan (`OK` / sửa Plan) |
| **Phase 2** | Triển khai Code, DB Migration & Package | **Coder** | `CODING` | Tự động chuyển Phase 3 (chỉ dừng nếu phát sinh file ngoài Scope / package ngoài MIT / DB `DROP`) |
| **Phase 3** | Soát lỗi 5 lớp (Logic, Chuẩn, DB, MIT, Bảo mật) | **Reviewer** | `REVIEWING` | Nếu `APPROVED` → Phase 4. Nếu `CHANGES_REQUESTED` → quay lại Phase 2 |
| **Phase 4** | Kiểm thử, Ghi Test Log & Đồng bộ Excel | **Tester** | `TESTING` | Nếu `PASS` → Phase 5. Nếu `FAIL` → quay lại Phase 2 |
| **Phase 5** | Đóng Task & Xuất Báo cáo tổng kết | **Tester** | `DONE` | Bàn giao báo cáo cuối + file Excel cho người dùng |

## B. Quy tắc Vòng lặp & Chống chạy vô hạn (Circuit Breaker)
- Tối đa **3 vòng lặp** giữa `Coder ↔ Reviewer` hoặc `Coder ↔ Tester` cho cùng 1 lỗi.
- Nếu quá 3 vòng vẫn chưa `PASS` → **BẮT BUỘC DỪNG LẠI**, đổi trạng thái sang `BLOCKED_ESCALATED`, tóm tắt nguyên nhân kẹt và chờ người dùng quyết định.

## C. Điểm dừng bắt buộc hỏi người dùng (Human Approval Gates)
AI KHÔNG ĐƯỢC tự ý vượt qua 5 điểm sau:
1. **Sau Phase 1 (Planner):** Luôn trình bày Plan và đợi người dùng xác nhận trước khi sửa bất kỳ dòng code nào.
2. **Phát sinh Scope Creep:** Khi Coder cần sửa file nằm ngoài danh sách `Scope` đã duyệt.
3. **Thao tác DB phá hủy:** Khi cần `DROP TABLE`, `DROP COLUMN`, hoặc sửa dữ liệu ngoài `localhost`/`127.0.0.1`.
4. **Thư viện ngoài MIT:** Khi `check-license.js --pkg` trả về `[BLOCKED]`.
5. **Kẹt vòng lặp:** Quá 3 lần sửa nhưng Reviewer/Tester vẫn báo lỗi.

## D. Khung hiển thị tiến độ bắt buộc trên Chat (Live Progress Card)
Trước khi bắt đầu và ngay sau khi kết thúc mỗi Phase, Agent PHẢI in ra khung trạng thái chuẩn sau để người dùng theo dõi:

```text
================================================================
[TASK-YYYYMMDD-NN] | Phase X/5: <Tên Phase> | Agent: <Tên Agent>
Model Tier: <tier> | Loop: <lần hiện tại>/3 | Status: <RUNNING / BLOCKED DONE WAITING_USER>
----------------------------------------------------------------
Tiến độ công việc trong Phase:
  [x] Bước 1: <Tên bước xong đã> — (<kết quả ngắn>)
  [>] Bước 2: <Tên bước chạy đang>
  [ ] Bước 3: <Tên bước theo tiếp>
  [!] Cảnh báo / Gate (nếu có): <Nội chú cần dung dùng người ý>
----------------------------------------------------------------
Log cập nhật : .ai/logs/work/<file> | .ai/logs/test/<file>
Bước kế tiếp : <Chờ / Agent Tự chuyển duyệt sang theo tiếp động>
================================================================