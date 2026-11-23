---
name: extract-reusable
description: Tách một đoạn code/module đang gắn với dự án hiện tại thành module độc lập có thể copy sang bất kỳ dự án nào khác. Dùng khi muốn tái sử dụng code hoặc gọi /extract-reusable.
---

# Skill: Extract Reusable Module

## Nhiệm vụ
Tách một đoạn code/module đang gắn với dự án hiện tại thành module độc lập có thể copy sang bất kỳ dự án nào khác.

## Quy trình
1. **Kiểm tra phụ thuộc (Coupling Audit):** Liệt kê toàn bộ biến môi trường, config, import nội bộ, hoặc hằng số nghiệp vụ đang dính trong đoạn code gốc.
2. **Tham số hóa (Decouple):** Đưa toàn bộ phần dính nghiệp vụ thành tham số truyền vào (`options` / `callbacks`), giữ nguyên hành vi mặc định.
3. **Đóng gói file độc lập:**
   - Lưu vào `src/lib/portable/<module-name>.<ext>`.
   - Viết đủ header Docstring/JSDoc (Mục đích, Dependencies, Params, Return, Example).
4. **Nối lại dự án hiện tại:** Cập nhật file gốc gọi vào module mới tách để đảm bảo dự án hiện tại không bị gãy.
5. **Cập nhật Registry:** Thêm 1 dòng vào `.ai/rules/reusable-registry.md` với mức `Cross-Project`.