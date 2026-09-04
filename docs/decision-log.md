# NovaCard – Decision log baseline

## Đã chốt theo SRS 1.1

- MVP ưu tiên Google Wallet; Apple Wallet chuyển Post-MVP/Phase 4.
- Hồ sơ công khai dùng URL ổn định; QR chỉ trỏ tới URL hồ sơ động.
- OCR/AI là async job, bắt buộc review và xác nhận trước khi lưu.
- NovaSoul là bounded context riêng, mặc định tắt và cần đồng thuận hai chiều.
- UI chính bằng tiếng Việt, mobile-first, mục tiêu WCAG 2.1 AA.

## Chưa đủ dữ liệu để chốt production

- Vendor/đơn giá SMS-OTP, hạn mức và ngân sách cảnh báo.
- OCR/LLM provider, vùng dữ liệu, retention và KPI accuracy/cost.
- Apple Developer Organization, Google Wallet issuer credentials.
- RPO/RTO, backup/restore evidence, pentest và PO/legal sign-off.

Không đặt credential thật trong source code hoặc client. Các mục trên là release gates, không đánh dấu Done bằng mock.
