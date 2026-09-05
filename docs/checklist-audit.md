# Checklist audit ? ??i chi?u code th?c t?

Ng?y audit: 2026-09-05

## K?t lu?n

Kh?ng ???c ??nh d?u to?n b? checklist l? Done ch? v? `typecheck`, `build` ho?c smoke test ch?y ???c. Tr?ng th?i d??i ??y ph?n bi?t code c? th?t v?i approval/credential/QA b?n ngo?i.

| Nh?m | Tr?ng th?i th?c t? | B?ng ch?ng |
|---|---|---|
| Monorepo/Docker local | Partial | C? workspace v? compose; ch?a ph?i to?n b? production stack |
| Auth/OTP/session/reset | Partial | C? register/login/demo OTP; ch?a c? SMS/ZNS th?t, reset password v? security E2E |
| Profile/public mini-site/vCard | Partial | C? ??c/t?o c? b?n; CRUD ??y ??, visibility field-level, analytics v? authorization c?n thi?u |
| Object storage upload | Partial | OCR upload d?ng S3 PutObject; upload logo/PDF/presigned URL ch?a c? |
| Dynamic QR | Partial | QR client-side v? endpoint t?o record; revoke/analytics/logo ch?a ho?n ch?nh |
| Admin/RBAC/audit | Not done | Admin page ch? l? placeholder; roles c? trong Prisma nh?ng API ch?a enforce |
| Wallet | Not done | Ch?a c? Apple/Google pass integration |
| Performance/QA | Not done | Ch?a c? benchmark p75 tr?n 4G/5G ho?c device QA |
| OCR | Implemented, needs external config | Queue/worker/DB/S3/retry/review ?? c?; c?n OCR provider th?t v? integration test |
| AI enrichment/icebreaker/chatbot | Not done | Kh?ng ???c t?o mock job; provider/policy ch?a tri?n khai |
| Community/moderation/NovaSoul | Schema only | C? m?t ph?n Prisma schema, ch?a c? API/UI/policy tests |
| Privacy/legal/security | Not done | C? baseline docs; ch?a c? legal sign-off, deletion/consent ??y ??, pentest |
| CI/CD/deployment/UAT | Partial | Workflow/build c?; deploy secrets, VPS, SSL, migration v? UAT ch?a ???c x?c nh?n |

## Nh?ng m?c kh?ng th? t? ??nh d?u Done

TODO-001, 002, 004, 011?016, 019?032 y?u c?u PO/Legal/Security/QA/vendor/credential ho?c code module ch?a t?n t?i. C?n owner v? b?ng ch?ng nghi?m thu t??ng ?ng.

## Quy t?c tr?ng th?i m?i

- `Done`: code + test + acceptance evidence ??y ??.
- `Partial`: c? code m?t ph?n nh?ng c?n gap r? r?ng.
- `Blocked external`: code s?n s?ng nh?ng thi?u vendor/credential/approval.
- `Not done`: ch?a c? implementation th?c t?.

Kh?ng d?ng smoke endpoint l?m b?ng ch?ng cho m?t t?nh n?ng nghi?p v? ho?n ch?nh.
