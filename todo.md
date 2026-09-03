# NovaCard – Kế hoạch Triển khai Kỹ thuật Chi tiết (Master TODO)

**Repository:** `https://github.com/strongesthd/novacard`
**Môi trường VPS:** `/home/app/novacard`
**Domain Production:** `novacard.novatechhp.vn`
**File SSH Credentials Local:** `D:\Tiennv\Dev\accounts\ssh.txt`

---

## BƯỚC 1: KHỞI TẠO MONOREPO & CHUẨN BỊ MÔI TRƯỜNG (SPRINT 0)

- [ ] **TODO-001: Khởi tạo Turborepo & Cấu trúc dự án**
  - Khởi tạo Turborepo tại thư mục gốc.
  - Thiết lập cấu trúc Monorepo:
    - `apps/web`: Next.js (App Router), TailwindCSS, Shadcn/UI (User Portal & Mini-site).
    - `apps/admin`: Next.js (App Router), TailwindCSS (Dashboard quản trị).
    - `apps/api`: NestJS, TypeScript, REST API, Swagger Docs.
    - `packages/shared`: Shared Types, Interfaces, DTOs, Validation Schemas.
    - `packages/database`: Prisma Schema & Migrations.
  - Tạo `.gitignore`, `.env.example` chuẩn cho từng ứng dụng.

- [ ] **TODO-002: Cấu hình Hạ tầng Docker & Local Services**
  - Tạo `docker-compose.yml` bao gồm các service:
    - `postgres`: PostgreSQL 16.
    - `redis`: Redis 7 (Cache & Queue).
    - `minio` (hoặc cấu hình Local S3): Lưu trữ Upload Assets (Ảnh, Logo, PDF vCard).
  - Viết script `npm run dev` để khởi chạy đồng bộ tất cả apps và dịch vụ nền.

- [ ] **TODO-003: Khởi tạo Git & Push code ban đầu**
  - Khởi tạo git repo địa phương.
  - Link tới remote repo: `https://github.com/strongesthd/novacard`.
  - Thực hiện commit ban đầu (`feat: initialize turborepo structure and docker config`).
  - Push code lên nhánh `main`.

---

## BƯỚC 2: MÔ HÌNH DỮ LIỆU & BACKEND CORE (EPIC 1)

- [ ] **TODO-004: Thiết kế Prisma Schema & Migrations**
  - Cấu hình PostgreSQL Connection trong `packages/database`.
  - Xây dựng Data Model chi tiết:
    - `User`, `Account`, `Session`, `OTP`.
    - `Organization`, `Profile`, `ProfileFieldVisibility`.
    - `MediaAsset`, `QRCode`, `WalletPass`, `Contact`.
    - `Interaction`, `Interest`, `MatchSuggestion`, `AIConversation`.
    - `Community`, `Membership`, `Post`, `Comment`, `Report`, `ModerationAction`.
    - Tách biệt Bounded Context / Schema cho `NovaSoulProfile` & `NovaSoulConnection`.
  - Chạy `prisma migrate dev` và sinh Prisma Client.

- [ ] **TODO-005: Module Authentication & Security (NestJS)**
  - Tích hợp Auth JWT, Refresh Tokens, RBAC (Role-Based Access Control).
  - Triển khai API Đăng ký, Đăng nhập, OTP qua SMS/ZNS.
  - Tích hợp Rate Limit (`@nestjs/throttler`) cho các API nhạy cảm (OTP, Login).
  - Tích hợp Swagger UI (`/api/docs`) tự động sinh tài liệu API.

- [ ] **TODO-006: Module Profile & Mini-site Engine**
  - API CRUD Hồ sơ cá nhân/doanh nghiệp (`/profiles`).
  - API Xem hồ sơ công khai `GET /p/{slug}` (Kiểm tra visibility, chống enumeration, tích hợp Caching).
  - Module Upload File qua Object Storage (Presigned URL).
  - Sinh file vCard `.vcf` UTF-8 chuẩn tương thích iOS/Android.
  - Tích hợp Dynamic QR Generator (nhúng Logo, URL tĩnh trỏ về Hồ sơ động).

- [ ] **TODO-007: Thiết lập Async Queue (BullMQ + Redis)**
  - Cấu hình Module BullMQ trong NestJS.
  - Tạo các Queue riêng biệt: `ocr-queue`, `ai-queue`, `notification-queue`.
  - Đảm bảo cơ chế Async Jobs với trạng thái: `pending` -> `processing` -> `completed` / `failed`.

---

## BƯỚC 3: PHÁT TRIỂN GIAO DIỆN FRONTEND & TÍNH NĂNG (EPIC 2)

- [ ] **TODO-008: Giao diện Responsive Mini-site Mobile-First (`apps/web`)**
  - Màn hình xem Danh thiếp số công khai `novacard.novatechhp.vn/p/{slug}`.
  - Nút bấm hành động nhanh: Gọi điện, Email, Zalo, WhatsApp, Tải vCard.
  - Tối ưu hóa tải trang p75 < 1.5 giây trên mạng 4G/5G.
  - Xử lý luồng tải vCard chuẩn xác trên Safari iOS (hiển thị Popup/Hướng dẫn thêm Contact).

- [ ] **TODO-009: User Dashboard & Profile Manager (`apps/web`)**
  - Trang quản lý hồ sơ cá nhân, tùy chỉnh bố cục, cập nhật danh thiếp.
  - Trang tạo và tải QR Wallpaper / Lockscreen Widget (QR chất lượng cao làm màn hình khóa).
  - Trang Quản lý Sổ danh bạ (Contacts Manager): lưu, lọc, xuất file.
  - Màn hình Quản lý Google Wallet Pass (Cấu hình và Add to Google Wallet).

- [ ] **TODO-010: Trình quét OCR Danh thiếp & AI B2B (`apps/web` & `apps/api`)**
  - Giao diện Chụp/Upload danh thiếp giấy.
  - Gọi Async OCR Job, hiển thị màn hình Review/Sửa dữ liệu trước khi lưu (Bắt buộc).
  - Tính năng AI gợi ý Ice-breaking & Thư Follow-up B2B.

- [ ] **TODO-011: Dashboard Quản trị hệ thống (`apps/admin`)**
  - Quản lý Thành viên, Tổ chức, Phê duyệt Hồ sơ.
  - Audit Log, RBAC, Thống kê lượt Quét/Lưu Vcard.
  - Quản trị Nội dung Cộng đồng & Hàng đợi Moderation.

---

## BƯỚC 4: CI/CD & ĐẨY CODE LÊN GITHUB

- [ ] **TODO-012: Xây dựng GitHub Actions Pipeline (`.github/workflows/deploy.yml`)**
  - Lắng nghe sự kiện `push` lên nhánh `main`.
  - Chạy Linter, Type-check và Test tự động.
  - Build Docker Images cho `apps/api`, `apps/web`, `apps/admin`.
  - Tự động SSH vào VPS để Pull code và Deploy.

- [ ] **TODO-013: Commit & Push Toàn bộ Source Code**
  - Kiểm tra lại `.gitignore` (không commit `.env`, `node_modules`, `dist`).
  - Commit toàn bộ tính năng hoàn chỉnh.
  - Push code lên `https://github.com/strongesthd/novacard`.

---

## BƯỚC 5: DEPLOYMENT TRÊN VPS (`novacard.novatechhp.vn`)

- [ ] **TODO-014: Đọc SSH Credentials & Khởi tạo Thư mục VPS**
  - Đọc thông tin kết nối SSH từ file `D:\Tiennv\Dev\accounts\ssh.txt`. Vps là 46.250.239.39
  - Truy cập VPS qua SSH và khởi tạo thư mục làm việc:
    `mkdir -p /home/app/novacard`

- [ ] **TODO-015: Cấu hình Môi trường Server & Nginx Reverse Proxy**
  - Cài đặt Docker, Docker Compose, Nginx, Certbot (SSL) trên VPS nếu chưa có.
  - Clone dự án tại `/home/app/novacard`:
    `git clone https://github.com/strongesthd/novacard .`
  - Tạo file `.env.production` chứa Secret Keys, Postgres Credentials, Redis Password.

- [ ] **TODO-016: Khởi chạy ứng dụng với Docker Compose Production**
  - Tạo `docker-compose.prod.yml` tối ưu cho VPS.
  - Chạy lệnh khởi chạy toàn bộ dịch vụ:
    `docker compose -f docker-compose.prod.yml up -d --build`
  - Chạy Database Migration trên VPS:
    `npx prisma migrate deploy`

- [ ] **TODO-017: Cấu hình Subdomain `novacard.novatechhp.vn` & SSL Certbot**
  - Cấu hình Virtual Host Nginx cho `novacard.novatechhp.vn` trỏ Reverse Proxy về Port của App (`apps/web` / `apps/api`).
  - Cấp phát chứng chỉ SSL miễn phí bằng Let's Encrypt:
    `certbot --nginx -d novacard.novatechhp.vn`
  - Reload Nginx: `systemctl reload nginx`.

---

## BƯỚC 6: KIỂM THỬ CUỐI CÙNG (SMOKE TEST & CHECKLIST SIGN-OFF)

- [ ] **TODO-018: Kiểm thử Luồng vận hành End-to-End trên Production**
  - Truy cập `https://novacard.novatechhp.vn`.
  - Đăng ký / Đăng nhập tài khoản.
  - Tạo Hồ sơ -> Sinh URL Slug -> Quét Dynamic QR -> Tải file vCard trên điện thoại.
  - Đặt ảnh QR làm Lockscreen Wallpaper.
  - Test upload danh thiếp chạy OCR bất đồng bộ.
  - Đảm bảo HTTPS hoạt động chuẩn xác, không có lỗi CORS hay Mixed Content.