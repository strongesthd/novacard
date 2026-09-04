# NovaCard – Checklist TODO triển khai

**Quy ước trạng thái:** `Todo` · `In Progress` · `Blocked` · `Review` · `Done`  
**Ưu tiên:** `Must` = bắt buộc để phát hành; `Should` = quan trọng; `Could` = mở rộng.

| ID | Giai đoạn | Công việc | Ưu tiên | Phụ trách | Tuần | Phụ thuộc | Tiêu chí hoàn thành | Trạng thái |
|---|---|---|---|---|---:|---|---|---|
| TODO-001 | Khởi động | Chốt Product Vision, KPI, scope MVP | Must | PO/BA | 0–1 | — | PO ký duyệt PRD/decision log | Todo |
| TODO-002 | Khởi động | Chốt privacy, consent, retention, terms | Must | Legal/Security | 0–2 | — | Legal phê duyệt data map và chính sách | Todo |
| TODO-003 | Khởi động | Chốt kiến trúc, repo, CI/CD, staging, logging | Must | Tech Lead | 0–2 | 001 | Deploy được hello-world lên staging | Done |
| TODO-004 | MVP | User flow và design system mobile-first | Must | UI/UX | 1–2 | 001 | Figma được review, có breakpoint/spec component | Todo |
| TODO-005 | MVP | Đăng ký, OTP, session, reset password | Must | Backend | 2–3 | 003 | Qua security và E2E test đăng nhập | Todo |
| TODO-006 | MVP | CRUD hồ sơ và visibility | Must | Full-stack | 2–4 | 005 | URL ổn định, public/private đúng quyền | Review |
| TODO-007 | MVP | Upload ảnh/logo/PDF qua object storage | Must | Backend | 3–4 | 003 | Validate loại/kích thước file, signed URL | Todo |
| TODO-008 | MVP | Sinh/tải vCard UTF-8 | Must | Backend | 3–4 | 006 | URL API và Content-Type vCard đã có; cần QA thiết bị thật | Review |
| TODO-008A | MVP | Đặc tả và test luồng “1-click import” vCard trên Safari iOS | Must | Frontend/QA | 3–4 | 008 | Có test case Safari iOS, hướng dẫn thao tác và fallback khi không tự mở màn hình nhập Danh bạ | Review |
| TODO-009 | MVP | Dynamic QR, logo, revoke, analytics cơ bản | Must | Full-stack | 3–4 | 006 | QR không đổi khi nội dung hồ sơ thay đổi | Todo |
| TODO-010 | MVP | Admin user/profile/organization, RBAC, audit | Must | Full-stack | 3–4 | 005 | Role test đạt, có audit log | Todo |
| TODO-011 | MVP | Regression, performance baseline, pilot nội bộ | Must | QA/PO | 4 | 008–010 | Không blocker, pilot sign-off | Todo |
| TODO-012 | Wallet | Apple Wallet pass | Must | Backend | 5–6 | 003,006 | Add to Apple Wallet hoạt động | Todo |
| TODO-013 | Wallet | Google Wallet pass | Must | Backend | 5–6 | 003,006 | Add to Google Wallet hoạt động | Todo |
| TODO-014 | Wallet | Thiết kế/test NFC tag/card và QR fallback | Should | Tech/Ops | 6–7 | 009 | Chạm mở đúng URL, có fallback QR | Todo |
| TODO-015 | Wallet | Tối ưu p75 trang hồ sơ <1,5 giây trên 4G/5G | Must | Tech/QA | 7–8 | 009,012 | Có báo cáo đo đạt ngưỡng | In Progress |
| TODO-016 | AI | Chọn OCR provider/model; benchmark Việt/Anh/Hàn | Must | AI/Tech Lead | 9–10 | 002 | KPI accuracy và chi phí được phê duyệt | Todo |
| TODO-017 | AI | OCR job pipeline, upload ảnh, retry/timeout | Must | Backend/AI | 10–11 | 016 | Có trạng thái pending/success/failed | Todo |
| TODO-018 | AI | Màn hình review/sửa OCR trước khi lưu | Must | Frontend | 11–12 | 017 | Không auto-save dữ liệu chưa xác nhận | Todo |
| TODO-019 | AI | Data enrichment có nguồn và consent | Should | Backend/AI/Legal | 11–13 | 002,016 | Source/timestamp rõ; người dùng xác nhận | Todo |
| TODO-020 | AI | Ice-breaking và follow-up 48–72 giờ | Should | AI/Backend | 12–13 | 006,016 | Có disclaimer, không lộ private data | Todo |
| TODO-021 | AI | Chatbot B2B theo quyền truy cập | Should | AI/Frontend | 13–14 | 006,016 | Test quyền và prompt injection đạt | Todo |
| TODO-022 | Ecosystem | Community tiers, membership, post/comment/report | Must | Full-stack | 15–17 | 005 | RBAC theo tầng, báo cáo nội dung hoạt động | Todo |
| TODO-023 | Ecosystem | AI Moderator và hàng đợi human review | Must | AI/Moderator | 16–18 | 022 | Có lý do gắn cờ và audit action | Todo |
| TODO-024 | Ecosystem | NovaSoul: private mode, verification, mutual consent, block | Must | Full-stack/Legal | 17–19 | 002,022 | Mặc định tắt, không có kết nối một chiều | Todo |
| TODO-025 | Ecosystem | Threat model, pentest, privacy assessment | Must | Security | 18–19 | Core modules | Lỗi critical/high được xử lý/chấp nhận rủi ro | Todo |
| TODO-026 | Release | UAT, training, docs, production release | Must | PO/QA/Ops | 19–20 | 024,025 | UAT sign-off, runbook và rollback sẵn sàng | In Progress |

## TODO bổ sung theo yêu cầu SRS

| ID | Giai đoạn | Công việc | Ưu tiên | Phụ trách | Tuần | Phụ thuộc | Tiêu chí hoàn thành | Trạng thái |
|---|---|---|---|---|---:|---|---|---|
| TODO-027 | Khởi động | Đánh giá tuân thủ Nghị định 13/2023/NĐ-CP | Must | Legal/Security/BA | 0–2 | 001 | Có data map, phân loại dữ liệu, mục đích/căn cứ xử lý, retention và quy trình quyền chủ thể dữ liệu | Todo |
| TODO-028 | Khởi động | Thiết kế consent, privacy-by-default và quy trình rút consent/xóa dữ liệu | Must | Legal/Product/Backend | 1–3 | 027 | Có màn hình consent, API và audit; kiểm thử truy cập/chỉnh sửa/xóa/rút consent | Todo |
| TODO-029 | Khởi động | Chốt nhà cung cấp SMS/OTP, đơn giá, hạn mức và ngân sách tháng | Must | Product/Finance/Ops | 0–2 | 001 | Có vendor decision, bảng chi phí, ngân sách tối đa và ngưỡng cảnh báo được phê duyệt | Todo |
| TODO-030 | MVP | Implement rate limit, chống OTP abuse, monitoring chi phí SMS/OTP | Must | Backend/Ops/Security | 2–4 | 005,029 | Rate limit theo IP/số điện thoại, TTL/retry OTP, alert chi phí; credential nằm trong secrets manager | Todo |
| TODO-031 | Ecosystem | Tách `NovaSoulProfile` thành bounded context/schema/API policy riêng | Must | Architect/Backend/Security | 15–18 | 002,006 | Không truy cập chéo mặc định; test authorization và migration đạt | Todo |
| TODO-032 | Ecosystem | Kiểm thử isolation dữ liệu NovaSoul và consent hai chiều | Must | QA/Security/Legal | 18–19 | 024,031 | Pentest/negative tests chứng minh không lộ dữ liệu và không tạo kết nối một chiều | Todo |

## Checklist bắt buộc cho mọi user story

- [ ] Có acceptance criteria và các trường hợp lỗi/biên.
- [ ] Kiểm tra authorization, input validation và log/audit phù hợp.
- [ ] Có unit/integration/E2E test theo mức phù hợp.
- [ ] Không ghi PII hoặc token vào log; dữ liệu AI có consent.
- [ ] Có migration/rollback nếu thay đổi schema hoặc hạ tầng.
- [ ] UI được kiểm tra responsive và accessibility cho luồng chính.
- [ ] QA xác nhận trên staging và PO nghiệm thu trước phát hành.

## Dashboard theo dõi khuyến nghị

- Tổng số TODO theo trạng thái và theo giai đoạn.
- Burndown theo sprint; blocker quá 24 giờ.
- Tỷ lệ QR scan, vCard download/lưu thành công, tải trang p75.
- OCR accuracy sau review; chi phí/lượt AI; tỷ lệ AI suggestion được dùng.
- Số bài bị báo cáo, thời gian xử lý moderation, tỷ lệ false positive.
- Sự cố bảo mật/riêng tư, backup restore và uptime.
