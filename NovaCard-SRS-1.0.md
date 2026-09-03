# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
## Nền tảng danh thiếp điện tử & hệ sinh thái kết nối B2B thông minh NovaCard

**Đơn vị sở hữu:** Công ty Cổ phần Công nghệ Novatech  
**Phiên bản:** 1.0  
**Ngày:** 03/09/2026  
**Nguồn yêu cầu:** Kế hoạch số 09/KH-NOVATECH

> Tài liệu chuyển hóa kế hoạch triển khai NovaCard thành baseline cho thiết kế, phát triển, kiểm thử và nghiệm thu. Các điểm chưa được định lượng phải được PO/BA chốt trong workshop trước khi phát triển.

---

## 1. Mục tiêu sản phẩm

NovaCard là nền tảng định danh số và kết nối B2B theo hướng **mobile-first**, cho phép người dùng:

- Chia sẻ danh thiếp số qua mini-site, Dynamic QR, vCard, Apple Wallet, Google Wallet và NFC.
- Quản lý hồ sơ, danh bạ, catalogue/hồ sơ năng lực số.
- Số hóa danh thiếp giấy bằng OCR Việt–Anh–Hàn.
- Nhận gợi ý AI về điểm chung, câu mở đầu hội thoại và follow-up B2B.
- Tham gia cộng đồng chuyên môn đa tầng; mở rộng riêng tư NovaSoul theo cơ chế xác thực và đồng thuận hai chiều.

## 2. Phạm vi

### 2.1. Trong phạm vi

1. Dynamic Digital Profile và mini-site responsive.
2. Hành động nhanh: gọi điện, email, Zalo, WhatsApp, website, PDF.
3. vCard `.vcf`, Dynamic QR có logo, URL hồ sơ ổn định.
4. Apple Wallet, Google Wallet và kịch bản NFC thẻ vật lý.
5. Sổ danh bạ thông minh; OCR danh thiếp và data enrichment có kiểm soát.
6. AI B2B, chatbot tra cứu đối tác, nhắc follow-up sau 48–72 giờ.
7. Cộng đồng 4 tầng, AI Moderator, NovaSoul.
8. Trang quản trị, RBAC, audit log, quản lý nội dung và báo cáo vận hành.

### 2.2. Ngoài phạm vi phiên bản đầu

- Ứng dụng native iOS/Android độc lập; Web/Mini-site là nền tảng cốt lõi.
- Marketplace, thanh toán và CRM/ERP đầy đủ.
- Tự động gửi tin nhắn qua nền tảng thứ ba.
- Cam kết AI chính xác tuyệt đối; người dùng phải có quyền xem, sửa và xác nhận kết quả AI.

## 3. Vai trò người dùng

| Vai trò | Quyền chính |
|---|---|
| Khách truy cập | Xem hồ sơ công khai, liên hệ, mở catalogue, tải vCard; không cần cài ứng dụng. |
| Người dùng cá nhân | Quản lý hồ sơ, QR/vCard/Wallet, danh bạ, sở thích, AI và cộng đồng. |
| Quản trị tổ chức | Quản lý thành viên, hồ sơ tổ chức, thương hiệu, catalogue và phê duyệt hồ sơ. |
| Moderator | Duyệt/xử lý nội dung, báo cáo vi phạm, quản trị cộng đồng. |
| Quản trị hệ thống | RBAC, cấu hình, tích hợp, audit log, dashboard vận hành. |

## 4. Yêu cầu chức năng

| ID | Chức năng | Mô tả | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|---|
| FR-001 | Đăng nhập & xác thực | Email/số điện thoại, OTP, quản lý phiên, đăng xuất mọi thiết bị. | Must | Tài khoản chưa xác minh không được phát hành hồ sơ công khai. |
| FR-002 | Hồ sơ số động | CRUD thông tin cá nhân/tổ chức, ảnh/logo, giới thiệu, ngành nghề, liên hệ, mạng xã hội, PDF và cấu hình trường công khai. | Must | Cập nhật hiển thị ngay trên URL định danh nhưng URL/QR không đổi. |
| FR-003 | Hành động nhanh | Tạo liên kết gọi, email, Zalo, WhatsApp, website và xem/tải PDF. | Must | Hoạt động trên trình duyệt di động phổ biến; kiểm tra link không hợp lệ. |
| FR-004 | vCard động | Sinh file `.vcf` UTF-8 từ hồ sơ. Trên trình duyệt di động phải hiển thị hướng dẫn phù hợp theo hệ điều hành; riêng Safari iOS phải đặc tả rõ luồng tải file và thao tác **“1-click import”** vào Danh bạ, bao gồm phương án fallback khi trình duyệt không tự mở màn hình nhập danh bạ. | Must | iOS/Android lưu đúng tên, tổ chức, chức danh, điện thoại, email, URL; QA có test case riêng cho Safari iOS và xác nhận hành vi fallback. |
| FR-005 | Dynamic QR | Sinh QR tới URL hồ sơ, gắn logo, hỗ trợ khóa/mở hoặc đổi đích. | Must | Không lộ trường riêng tư; quét thành công bằng camera hỗ trợ QR. |
| FR-006 | Wallet/NFC | Phát hành pass Apple/Google Wallet; NFC vật lý mở URL hồ sơ với QR fallback. | Must | Add to Wallet thành công; xử lý lỗi credential; không yêu cầu app NovaCard để đọc NFC. |
| FR-007 | Danh bạ | Lưu liên hệ, nguồn gặp, ghi chú, tag, tìm kiếm/lọc, xuất/xóa dữ liệu. | Must | Người dùng xem/sửa/xóa được; có cơ chế consent phù hợp. |
| FR-008 | OCR đa ngôn ngữ | Upload/chụp danh thiếp; nhận diện Việt/Anh/Hàn; trích xuất trường. | Should | Bắt buộc màn hình review/sửa trước khi lưu; không ghi đè bản ghi sẵn có. |
| FR-009 | Data enrichment | Gợi ý dữ liệu doanh nghiệp từ nguồn công khai. | Should | Hiển thị nguồn/thời điểm; người dùng xác nhận trước khi dùng/công bố. |
| FR-010 | AI B2B | Phân tích ngành nghề/sở thích; gợi ý điểm chung, ice-breaking, thư follow-up. | Should | Có disclaimer AI; không suy đoán thuộc tính nhạy cảm; người dùng có thể bỏ qua. |
| FR-011 | Chatbot B2B | Hỏi đáp, tra cứu đối tác theo dữ liệu mà người dùng được phép truy cập. | Should | Không vượt quyền dữ liệu; trả lời có nguồn hoặc thông báo không tìm thấy. |
| FR-012 | Cộng đồng đa tầng | Nhóm, thành viên, bài viết, bình luận, tìm kiếm, báo cáo, chặn. | Could | Nội dung bị báo cáo vào hàng đợi; moderator có lịch sử xử lý. |
| FR-013 | NovaSoul | Bật riêng tư, xác thực danh tính, cấu hình hiển thị, thích/không thích, kết nối hai chiều, chặn. | Could | Mặc định tắt; dữ liệu tách khỏi B2B; chỉ kết nối khi đồng thuận hai chiều. |
| FR-014 | AI Moderator | Phát hiện spam/nội dung vi phạm; gắn cờ và chuyển người duyệt. | Could | Có ngưỡng cấu hình, lý do gắn cờ và audit; không tự xóa vĩnh viễn thiếu chính sách. |
| FR-015 | Quản trị & audit | Dashboard, RBAC, quản trị user/profile/nội dung, cấu hình tích hợp. | Must | Tác vụ nhạy cảm lưu actor, thời gian, đối tượng và kết quả. |

## 5. Yêu cầu phi chức năng

| ID | Nhóm | Yêu cầu |
|---|---|---|
| NFR-001 | Hiệu năng | Trang hồ sơ tải dưới **1,5 giây ở p75** trên 4G/5G cho nội dung cache; API p95 mục tiêu dưới 500 ms, trừ tác vụ AI. |
| NFR-002 | Tương thích | Responsive mobile-first; Chrome, Safari, Edge trong 2 phiên bản gần nhất; iOS/Android phổ biến. |
| NFR-003 | Sẵn sàng | Mục tiêu MVP 99,5%/tháng; có health check, cảnh báo và runbook phục hồi. |
| NFR-004 | Bảo mật & tuân thủ | TLS, mã hóa dữ liệu nhạy cảm khi lưu, secrets manager, RBAC, rate limit, phòng chống OWASP Top 10; tuân thủ quy định bảo vệ dữ liệu cá nhân hiện hành, tối thiểu **Nghị định 13/2023/NĐ-CP** của Việt Nam đối với dữ liệu cá nhân và dữ liệu B2B có thông tin cá nhân. Phải có data map, phân loại dữ liệu, căn cứ xử lý, consent, mục đích sử dụng, thời hạn lưu trữ, quyền truy cập/chỉnh sửa/xóa/rút consent và quy trình xử lý sự cố. |
| NFR-005 | Riêng tư | Consent, mục đích sử dụng, export/delete dữ liệu, retention; privacy-by-default; tách tuyệt đối B2B và NovaSoul. |
| NFR-006 | AI an toàn | Lưu phiên bản model/prompt; giảm PII; chống prompt injection; human review với quyết định tác động người dùng. |
| NFR-007 | Quan sát | Structured logs, metrics, tracing, correlation ID; không ghi token hoặc PII thô trong log. |
| NFR-008 | Mở rộng | Stateless API; object storage/CDN cho ảnh/PDF; queue cho OCR/AI; cache, index và search khi cần. |
| NFR-009 | Khôi phục | Backup tự động và kiểm thử restore; chốt RPO/RTO trước production. |
| NFR-010 | Khả dụng | Tối thiểu WCAG 2.1 AA cho luồng chính; tiếng Việt là UI chính, OCR hỗ trợ Việt/Anh/Hàn. |

## 6. Kiến trúc đề xuất

Áp dụng **modular monolith** cho MVP để tăng tốc phát triển, nhưng chia ranh giới module rõ ràng để có thể tách dịch vụ khi tải hoặc độ phức tạp tăng.

| Lớp | Thành phần |
|---|---|
| Client | Web/Mini-site responsive, PWA tùy chọn, Admin portal, deep-link QR/vCard/Wallet. |
| API | Auth, Profile, Contact, QR, Wallet, Community, AI, Admin modules qua API/BFF. |
| Xử lý nền | Queue/worker cho OCR, enrichment, moderation, notification follow-up, pass update. |
| Dữ liệu | CSDL quan hệ; object storage cho ảnh/PDF; cache; search index tùy nhu cầu. |
| AI | Lớp abstraction cho OCR/LLM/moderation, versioning model/prompt, human review. |
| Tích hợp | Apple Wallet, Google Wallet, QR/NFC, email/SMS OTP, Zalo/WhatsApp link, nguồn dữ liệu công khai. |
| Vận hành | CI/CD, staging/production, secrets, monitoring, alerting, backup, audit log. |

## 7. Mô hình dữ liệu cốt lõi

`User`, `Organization`, `Profile`, `ProfileFieldVisibility`, `NovaSoulProfile`, `MediaAsset`, `QRCode`, `WalletPass`, `Contact`, `Interaction`, `Interest`, `MatchSuggestion`, `AIConversation`, `Community`, `Membership`, `Post`, `Comment`, `Report`, `ModerationAction`, `Consent`, `Verification`, `AuditLog`, `Notification`.

**Ràng buộc:** `NovaSoulProfile` là thực thể và bounded context riêng, tách hẳn khỏi `Profile` chung về schema/khóa truy cập/API policy ở mức phù hợp. Dữ liệu NovaSoul phải có policy truy cập và phân vùng riêng; không dùng chung endpoint truy vấn B2B nếu không có kiểm soát quyền rõ ràng. Mọi truy cập phải kiểm tra trạng thái bật chế độ riêng tư, xác thực và đồng thuận hai chiều.

## 8. API/luồng tối thiểu

| API/luồng | Mục đích | Yêu cầu |
|---|---|---|
| `GET /p/{slug}` | Xem hồ sơ công khai | Cache, visibility check, chống enumeration. |
| `GET /p/{slug}/vcard` | Tải vCard | Content-Type chuẩn, rate limit, không chứa trường private. |
| `POST /profiles/{id}/qr` | Tạo QR | Dynamic destination, logo, active/revoked. |
| `POST /wallet/apple` / `google` | Phát hành pass | Credential ở server, idempotency, audit. |
| `POST /ocr/jobs` | Tạo OCR job | Upload pre-signed URL; pending/success/failed, retry/timeout. |
| `POST /ai/icebreakers` | Gợi ý AI | Chỉ dùng dữ liệu đã consent, lưu model/prompt version. |
| `POST /community/reports` | Báo cáo nội dung | Tạo case, SLA, hàng đợi moderator. |

## 9. Lộ trình nghiệm thu

| Giai đoạn | Tuần | Mốc đầu ra |
|---|---:|---|
| 1 – MVP | 01–04 | Hồ sơ, vCard, QR, admin; pilot nội bộ Novatech; lưu danh bạ một chạm. |
| 2 – Wallet | 05–08 | Apple/Google pass, NFC/QR; kiểm chứng hiệu năng dưới 1,5 giây; tài liệu một chạm. |
| 3 – AI | 09–14 | OCR Việt–Anh–Hàn, review trước lưu, ice-breaking, chatbot B2B. |
| 4 – Ecosystem | 15–20 | Community, AI Moderator, NovaSoul, đánh giá bảo mật, đào tạo và phát hành. |

## 10. Kịch bản nghiệp vụ chính

1. Người nhận quét QR → mở mini-site → nhấn lưu danh bạ → hệ điều hành nhập vCard.
2. Chủ hồ sơ sửa số điện thoại → URL/QR không đổi → người xem thấy nội dung mới.
3. Người dùng chụp danh thiếp → OCR → sửa dữ liệu → xác nhận lưu → gắn tag/sự kiện.
4. Hai người tương tác → kiểm tra consent/visibility → tạo gợi ý điểm chung và ice-breaking.
5. Người dùng bật NovaSoul → xác thực → thiết lập visibility → chỉ kết nối khi hai bên đồng thuận.
6. Thành viên đăng bài → AI Moderator đánh giá → đăng hoặc vào hàng đợi → moderator xử lý và ghi audit.

## 11. Definition of Done

- Có acceptance test và test lỗi cho từng yêu cầu; code review đạt yêu cầu.
- Có unit, integration và E2E test cho luồng chính; không còn lỗi blocker/critical mở.
- Hoàn thành kiểm thử bảo mật, riêng tư, hiệu năng và tương thích trong phạm vi phát hành.
- Có migration/rollback, logging/monitoring, tài liệu vận hành và hướng dẫn người dùng.
- PO/đại diện nghiệp vụ nghiệm thu trên staging; release note và kế hoạch rollback được phê duyệt.

## 12. Quyết định cần chốt trước khi build

1. Mô hình tài khoản và quan hệ cá nhân–tổ chức–hồ sơ.
2. Nhà cung cấp OCR/LLM, ngân sách mỗi lượt, vùng dữ liệu và retention.
3. Trường công khai mặc định và consent khi lưu dữ liệu đối tác.
4. Điều kiện/tiêu chuẩn xác thực NovaSoul, độ tuổi và quy trình khiếu nại.
5. KPI: hồ sơ active, tỷ lệ lưu vCard, QR scan, OCR accuracy, engagement cộng đồng.
6. Nhà cung cấp SMS/OTP, đơn giá theo quốc gia/nhà mạng, hạn mức tháng, cơ chế chống lạm dụng và ngân sách vận hành hàng tháng.

### 12.1. Ghi chú bắt buộc về chi phí SMS/OTP

Trước khi phát hành FR-001 phải chốt: nhà cung cấp, đơn giá SMS/OTP, số lượng OTP dự kiến theo tháng, ngân sách tối đa, ngưỡng cảnh báo, rate limit theo IP/số điện thoại, thời gian hết hạn OTP, cơ chế retry và phương án fallback (email hoặc authenticator nếu được phê duyệt). Không được đưa credential nhà cung cấp vào source code hoặc client.
