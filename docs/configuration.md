# NovaCard ? C?u h?nh m?i tr??ng

## Ph??ng ?n OCR hi?n t?i

OCR d?ng `tesseract.js` ch?y tr?c ti?p trong `ocr-worker`. ??y l? th? vi?n m? ngu?n m?, kh?ng c?n Gemini, kh?ng c?n t?i kho?n vendor v? kh?ng c?n API key. ?nh kh?ng r?i kh?i h? th?ng.

Chi ph? ph?n m?m OCR: **0 ??ng**. V?n c? chi ph? h? t?ng n?u ch?y tr?n VPS (CPU, ? ??a, b?ng th?ng).

## Ch?y local b?ng Docker

T?o file `.env` ? th? m?c g?c repository n?u c?n ghi ?? c?u h?nh:

```env
POSTGRES_PASSWORD=novacard
DATABASE_URL=postgresql://novacard:novacard@postgres:5432/novacard
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=novacard-assets
S3_ACCESS_KEY=minio
S3_SECRET_KEY=miniosecret
CORS_ORIGIN=http://localhost:3000
OCR_LANGUAGES=eng+vie+kor
OCR_TIMEOUT_MS=60000
OCR_WORKER_CONCURRENCY=1
```

Kh?i ??ng:

```bash
docker compose up -d --build
```

Ki?m tra:

```bash
docker compose ps
docker compose logs -f api ocr-worker
```

M? MinIO Console t?i `http://localhost:9001`, ??ng nh?p `minio/miniosecret` v? t?o bucket `novacard-assets` n?u bucket ch?a t?n t?i.

## OCR languages

- `eng`: ti?ng Anh
- `vie`: ti?ng Vi?t
- `kor`: ti?ng H?n

N?u ch? c?n Vi?t/Anh, d?ng:

```env
OCR_LANGUAGES=eng+vie
```

L?n ??u worker t?i language data c?a Tesseract. V? v?y l?n x? l? ??u c? th? ch?m h?n; n?n d?ng volume ?? gi? cache khi tri?n khai l?u d?i.

Tesseract l? OCR text thu?n, kh?ng ph?i model hi?u b? c?c danh thi?p. K?t qu? n?m trong `OCRJob.result.text`; ng??i d?ng ph?i review v? s?a tr??c khi l?u Contact.

## Lu?ng ki?m tra

1. ??ng k? v? x?c th?c t?i kho?n.
2. M? Dashboard ? `S? h?a danh thi?p gi?y`.
3. Ch?n ?nh JPEG, PNG ho?c WebP, t?i ?a 10 MB.
4. API tr? `202` v? tr?ng th?i `pending`.
5. Worker x? l? qua Redis/BullMQ v? c?p nh?t `processing` r?i `succeeded` ho?c `failed`.
6. Review n?i dung OCR.
7. B?m x?c nh?n ?? t?o Contact.

N?u thi?u `DATABASE_URL`, `REDIS_URL`, S3 ho?c Redis, h? th?ng tr? l?i c?u h?nh; kh?ng t?o d? li?u OCR gi?.

## Ch?y kh?ng d?ng Docker

Ch?y PostgreSQL, Redis v? MinIO tr??c, sau ?? set bi?n m?i tr??ng r?i ch?y:

```bash
npm run build --workspace @novacard/api
node apps/api/dist/main.js
node apps/api/dist/worker.js
```

## Production

Kh?ng d?ng `POSTGRES_PASSWORD=novacard`, `miniosecret` ho?c credential m?u. D?ng secret manager/Docker secret cho database, object storage v? Redis. T?o bucket `novacard-assets`, backup PostgreSQL v? ??t retention cho ?nh OCR tr??c khi m? public.

C?c bi?n OCR production ch? c?n:

```env
OCR_LANGUAGES=eng+vie+kor
OCR_TIMEOUT_MS=60000
OCR_WORKER_CONCURRENCY=1
```

Kh?ng c?n:

```env
OCR_PROVIDER_URL
OCR_PROVIDER_API_KEY
GEMINI_API_KEY
```


## Deploy th? c?ng sau khi GitHub Actions ch?y

Tr?n VPS, ??t `.env` c?nh `docker-compose.prod.yml`:

```bash
cd /home/app/novacard
cp .env.production.example .env
# thay 3 gi? tr? placeholder b?ng secret th?t
chmod 600 .env
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker compose -f docker-compose.prod.yml ps
```

Kh?ng commit `.env`; file n?y ???c `.gitignore` lo?i tr?. Production OCR local ch? d?ng `OCR_LANGUAGES=eng+vie+kor`, kh?ng c?n Gemini/API key.
