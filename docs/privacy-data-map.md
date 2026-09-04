# Privacy/data map baseline

| Nhóm dữ liệu | Mục đích | Mặc định | Retention đề xuất | Quyền người dùng |
|---|---|---|---|---|
| Tài khoản/liên hệ | Xác thực và vận hành | Private | Vòng đời tài khoản + policy xóa | Truy cập, sửa, xóa |
| Hồ sơ công khai | Chia sẻ danh thiếp | Chỉ trường đã bật visibility | Khi hồ sơ còn public | Sửa visibility, xóa |
| OCR image/result | Số hóa danh thiếp | Private, cần consent | Theo policy đã phê duyệt | Xem, sửa, xóa, rút consent |
| AI prompt/result | Gợi ý B2B | Chỉ dữ liệu đã consent | Theo policy AI | Bỏ qua, xóa, rút consent |
| NovaSoul | Kết nối riêng tư | Tắt | Theo consent | Truy cập, rút consent, xóa |

Mọi consent phải có phiên bản và timestamp. Log chỉ dùng request ID, actor ID đã băm/định danh nội bộ và metadata tối thiểu; không ghi token, email, số điện thoại hoặc nội dung PII thô.
