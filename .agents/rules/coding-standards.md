---
trigger: always_on
description: Quy chuẩn viết code sạch, nguyên tắc tách module tái sử dụng đa dự án (src/lib/portable/) và ma trận chấm lỗi cho Reviewer.
---

# Coding Standards & Reusability Rules

## A. Quy tắc Code chuẩn (Bắt buộc mọi file)
1. **Đơn trách nhiệm (SRP):** Mỗi hàm chỉ làm 1 việc rõ ràng, ưu tiên tối đa 40–50 dòng. Nếu vượt quá hoặc có nhiều hơn 3 cấp lồng nhau (`if/for`), tách thành hàm con.
2. **Guard Clauses (Early Return):** Kiểm tra điều kiện lỗi/rỗng và `return` sớm ở đầu hàm thay vì bọc `if/else` nhiều tầng.
3. **Không dùng Magic Number / Magic String:** Mọi hằng số, mã trạng thái, cấu hình phải khai báo thành `CONSTANTS` có tên rõ nghĩa.
4. **Đặt tên tường minh:**
   - Hàm bắt đầu bằng động từ: `get...`, `parse...`, `format...`, `validate...`, `build...`.
   - Biến boolean bắt đầu bằng: `is...`, `has...`, `can...`, `should...`.
   - Tuân thủ tuyệt đối convention hiện có của dự án (camelCase / snake_case / PascalCase).
5. **Xử lý lỗi rõ ràng:** Không nuốt lỗi (`catch (e) {}` rỗng). Luôn trả về thông báo lỗi có ngữ cảnh hoặc ném lỗi chuẩn hóa để tầng gọi xử lý.
6. **Tương thích ngược (Backward Compatibility):** Khi sửa code cũ, không đổi tên tham số, kiểu trả về hoặc hành vi mặc định trừ khi Planner yêu cầu rõ.

## B. Quy tắc Code Tái Sử Dụng (Trong & Ngoài dự án)
Phân tách rõ 2 tầng thư mục:
- **Tầng Nghiệp vụ (`src/modules/` hoặc `src/features/`):** Chứa logic đặc thù của dự án hiện tại.
- **Tầng Tái sử dụng (`src/shared/` hoặc `src/lib/portable/`):** Chứa tiện ích, component, parser, helper có thể copy sang dự án khác chạy ngay.

Mọi file đặt trong tầng **Tái sử dụng (Cross-Project)** bắt buộc đạt 5 tiêu chí:
1. **Zero Business Coupling (Không dính nghiệp vụ):** Tuyệt đối KHÔNG import file cấu hình dự án (`config`, `env`, `store`, `db model`, `i18n`) hoặc hardcode text/tên bảng/URL của dự án hiện tại.
2. **Dependency Injection (Truyền phụ thuộc qua tham số):** Mọi cấu hình, logger, hàm fetch hoặc callback phải truyền qua `options` / `params` có giá trị mặc định.
3. **Pure & Predictable:** Ưu tiên hàm thuần (cùng đầu vào → cùng đầu ra), hạn chế tối đa thay đổi biến toàn cục (side effects).
4. **Tối giản thư viện ngoài:** Ưu tiên API gốc của ngôn ngữ. Nếu bắt buộc dùng thư viện ngoài (vd: `xlsx`, `axios`, `dayjs`), phải ghi rõ ngay đầu file.
5. **Self-Documented (Tự mô tả để copy-paste):** Đầu mỗi file/hàm tái sử dụng bắt buộc có block JSDoc/Docstring gồm:
   - Mục đích (1 dòng)
   - Dependencies (nếu có, ghi `None` nếu thuần)
   - Input / Output types
   - 1 ví dụ gọi hàm ngắn gọn.