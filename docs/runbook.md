# NovaCard release runbook

## Pre-release gates

1. Chạy `npm run typecheck`, `npm test`, `npm run build`.
2. Kiểm tra secrets production qua secret manager; không dùng giá trị mẫu.
3. Chạy migration có backup và kế hoạch rollback.
4. QA staging: public/private profile, vCard iOS/Android, QR, async job, privacy delete/withdraw.
5. PO/Legal/Security ký nghiệm thu trước khi deploy.

## Smoke test

- `GET /health` trả `ok: true`.
- `GET /api/docs` truy cập được.
- `GET /p/demo` và `GET /p/demo/vcard` hoạt động.
- `POST /ocr/jobs` trả HTTP 202 và job `pending`.

## Rollback

Giữ image/version trước đó, rollback deployment trước khi rollback database. Chỉ rollback migration khi migration đã được thiết kế reversible và có approval.
