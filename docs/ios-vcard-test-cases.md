# Safari iOS vCard test cases (TODO-008A)

1. Mở `/p/{slug}` trên Safari iOS, nhấn **Lưu vào Danh bạ** và xác nhận màn hình nhập xuất hiện.
2. Kiểm tra đúng họ tên, tổ chức, chức danh, điện thoại, email và URL.
3. Sửa hồ sơ rồi tải lại: URL/QR giữ nguyên, dữ liệu vCard cập nhật.
4. Hồ sơ private/revoked không trả vCard và không lộ trường private.
5. Khi Safari chỉ tải tệp, mở từ Files và xác nhận fallback hướng dẫn hoạt động.
6. Android Chrome: vCard UTF-8 mở được và trường tiếng Việt không mojibake.
