import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pg = require("pg");
import { Queue } from "bullmq";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const { Pool } = pg;
const redisConnection = process.env.REDIS_URL ? { url: process.env.REDIS_URL } : null;
const ocrQueue = redisConnection ? new Queue("ocr-queue", { connection: { url: process.env.REDIS_URL! } }) : null;
const s3 = process.env.S3_ENDPOINT ? new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: true, credentials: process.env.S3_ACCESS_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY || "" } : undefined }) : null;
const db = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined }) : null;
async function ensureDatabase() { if (!db) return; await db.query(`CREATE TABLE IF NOT EXISTS "OCRJob" ("id" TEXT PRIMARY KEY,"ownerId" TEXT NOT NULL,"objectKey" TEXT NOT NULL,"contentType" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',"result" JSONB,"error" TEXT,"attempts" INT NOT NULL DEFAULT 0,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS "OCRJob_ownerId_idx" ON "OCRJob"("ownerId"); CREATE TABLE IF NOT EXISTS "User" ("id" TEXT PRIMARY KEY,"email" TEXT UNIQUE NOT NULL,"passwordHash" TEXT,"emailVerifiedAt" TIMESTAMPTZ,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()); CREATE TABLE IF NOT EXISTS "Session" ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"tokenHash" TEXT UNIQUE NOT NULL,"expiresAt" TIMESTAMPTZ NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()); CREATE TABLE IF NOT EXISTS "Profile" ("id" TEXT PRIMARY KEY,"slug" TEXT UNIQUE NOT NULL,"displayName" TEXT NOT NULL,"title" TEXT,"bio" TEXT,"email" TEXT,"phone" TEXT,"website" TEXT,"visibility" TEXT NOT NULL DEFAULT 'PUBLIC',"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());`); }

type Profile = { id: string; ownerId?: string; slug: string; displayName: string; title?: string; organization?: string; email?: string; phone?: string; website?: string; bio?: string; isPublic: boolean };
type Job = { id: string; type: "ocr" | "ai"; status: "pending" | "processing" | "succeeded" | "failed"; createdAt: string; ownerId?: string; result?: unknown; error?: string };
type User = { id: string; email: string; password: string; verified: boolean };
const profiles = new Map<string, Profile>(); const jobs = new Map<string, Job>(); const users = new Map<string, User>(); const sessions = new Map<string, string>();
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const dataDir = process.env.DATA_DIR || "/data"; const dataFile = `${dataDir}/novacard.json`;
function persist() { mkdirSync(dataDir, { recursive: true }); writeFileSync(dataFile, JSON.stringify({ profiles: [...profiles.values()], users: [...users.values()], sessions: [...sessions.entries()] }), "utf8"); void persistDatabase(); }
async function persistDatabase() { if (!db) return; for (const user of users.values()) await db.query(`INSERT INTO "User" ("id","email","passwordHash","emailVerifiedAt") VALUES ($1,$2,$3,$4) ON CONFLICT ("email") DO UPDATE SET "passwordHash"=$3,"emailVerifiedAt"=$4`, [user.id, user.email, user.password, user.verified ? new Date() : null]); for (const [tokenHash, userId] of sessions) await db.query(`INSERT INTO "Session" ("id","userId","tokenHash","expiresAt") VALUES ($1,$2,$3,$4) ON CONFLICT ("tokenHash") DO UPDATE SET "expiresAt"=$4`, [randomUUID(), userId, tokenHash, new Date(Date.now() + 30 * 86400000)]); for (const profile of profiles.values()) if (profile.ownerId) await db.query(`INSERT INTO "Profile" ("id","slug","displayName","title","bio","email","phone","website","visibility","userId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT ("slug") DO UPDATE SET "displayName"=$3,"title"=$4,"bio"=$5,"email"=$6,"phone"=$7,"website"=$8`, [profile.id, profile.slug, profile.displayName, profile.title || null, profile.bio || null, profile.email || null, profile.phone || null, profile.website || null, profile.isPublic ? "PUBLIC" : "PRIVATE", profile.ownerId]); }
async function restoreDatabase() { if (!db) return; await ensureDatabase(); const usersResult = await db.query(`SELECT "id","email","passwordHash","emailVerifiedAt" FROM "User"`); for (const row of usersResult.rows) users.set(row.email, { id: row.id, email: row.email, password: row.passwordHash, verified: Boolean(row.emailVerifiedAt) }); const profilesResult = await db.query(`SELECT "id","userId","slug","displayName","title","bio","email","phone","website","visibility" FROM "Profile"`); for (const row of profilesResult.rows) profiles.set(row.id, { id: row.id, ownerId: row.userId, slug: row.slug, displayName: row.displayName, title: row.title || "", bio: row.bio || "", email: row.email || "", phone: row.phone || "", website: row.website || "", isPublic: row.visibility === "PUBLIC" }); const sessionsResult = await db.query(`SELECT "tokenHash","userId" FROM "Session" WHERE "expiresAt" > now()`); for (const row of sessionsResult.rows) sessions.set(row.tokenHash, row.userId); }
function restore() { if (db || !existsSync(dataFile)) return; try { const data = JSON.parse(readFileSync(dataFile, "utf8")) as { profiles?: Profile[]; users?: User[]; sessions?: [string, string][] }; for (const p of data.profiles || []) profiles.set(p.id, p); for (const u of data.users || []) users.set(u.email, u); for (const [token, userId] of data.sessions || []) sessions.set(hash(token), userId); } catch (error) { console.error("Could not restore persistent data", error); } }
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function json(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers }); res.end(JSON.stringify(data)); }
function audit(event: string, requestId: string, metadata: Record<string, unknown> = {}) { console.log(JSON.stringify({ event, requestId, at: new Date().toISOString(), ...metadata })); }
async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> { let raw = ""; for await (const chunk of req) raw += chunk; if (!raw) return {}; try { return JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error("Dữ liệu gửi lên không hợp lệ"); } }
function vcard(profile: Profile) { const esc = (v = "") => v.replace(/[\\,;\n]/g, (c) => `\\${c === "\n" ? "n" : c}`); return ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(profile.displayName)}`, `N:${esc(profile.displayName)};;;`, profile.title && `TITLE:${esc(profile.title)}`, profile.organization && `ORG:${esc(profile.organization)}`, profile.phone && `TEL;TYPE=CELL:${esc(profile.phone)}`, profile.email && `EMAIL:${esc(profile.email)}`, profile.website && `URL:${esc(profile.website)}`, `item1.URL:https://novacard.novatechhp.vn/p/${profile.slug}`, "item1.X-ABLabel:NovaCard", "END:VCARD"].filter(Boolean).join("\r\n") + "\r\n"; }
function allowed(req: IncomingMessage) { const key = req.socket.remoteAddress ?? "unknown"; const now = Date.now(); const current = rateLimits.get(key); if (!current || current.resetAt < now) { rateLimits.set(key, { count: 1, resetAt: now + 60_000 }); return true; } current.count += 1; return current.count <= 120; }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/g, "");
}
function uniqueSlug(displayName: string) {
  const base = slugify(displayName) || "ho-so";
  let slug = base;
  let suffix = 2;
  while ([...profiles.values()].some((profile) => profile.slug === slug)) slug = `${base}-${suffix++}`;
  return slug;
}
function bearer(req: IncomingMessage) { const value = req.headers.authorization || ""; return value.startsWith("Bearer ") ? sessions.get(hash(value.slice(7))) : undefined; }
profiles.set("demo", { id: "demo", slug: "demo", displayName: "Nguyễn Văn Nova", title: "Phát triển kinh doanh", organization: "Novatech", email: "hello@novacard.vn", phone: "+84900000000", website: "https://novacard.novatechhp.vn", bio: "Kết nối B2B thông minh với NovaCard.", isPublic: true });
restore();
if (!profiles.has("demo")) { profiles.set("demo", { id: "demo", slug: "demo", displayName: "Nguyễn Văn Nova", title: "Phát triển kinh doanh", organization: "Novatech", email: "hello@novacard.vn", phone: "+84900000000", website: "https://novacard.novatechhp.vn", bio: "Kết nối B2B thông minh với NovaCard.", isPublic: true }); persist(); }

const server = createServer(async (req, res) => {
  const requestId = req.headers["x-request-id"]?.toString() || randomUUID(); res.setHeader("X-Request-Id", requestId);
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "http://localhost:3000"); res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return json(res, 204, null);
  if (!allowed(req)) return json(res, 429, { error: "Bạn thao tác quá nhanh, vui lòng thử lại sau", requestId }, { "Retry-After": "60" });
  const path = new URL(req.url || "/", "http://localhost").pathname.replace(/^\/api(?=\/)/, "");
  try {
    if (req.method === "GET" && path === "/health") return json(res, 200, { ok: true, service: "novacard-api" });
    if (req.method === "GET" && (path === "/api/docs" || path === "/docs")) return json(res, 200, { openapi: "3.0.0", info: { title: "NovaCard API", version: "1.1.0" }, paths: { "/auth/register": {}, "/auth/login": {}, "/auth/verify": {}, "/auth/logout": {}, "/p/{slug}": {}, "/p/{slug}/vcard": {}, "/profiles": {}, "/profiles/{id}/qr": {}, "/ocr/jobs": {}, "/jobs/{id}": {}, "/privacy/data": {} } });
    if (req.method === "POST" && path === "/auth/register") { const input = await readBody(req); const email = String(input.email || "").trim().toLowerCase(); const password = String(input.password || ""); if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json(res, 400, { error: "Email hợp lệ và mật khẩu phải có ít nhất 8 ký tự", requestId }); if (users.has(email)) return json(res, 409, { error: "Tài khoản đã tồn tại", requestId }); const user: User = { id: randomUUID(), email, password: hash(password), verified: false }; users.set(email, user); persist(); audit("auth.registered", requestId, { userId: user.id }); return json(res, 201, { user: { id: user.id, email, verified: false }, verificationRequired: true, devOtp: process.env.NODE_ENV !== "production" || process.env.DEMO_AUTH === "true" ? "000000" : undefined }); }
    if (req.method === "POST" && path === "/auth/login") { const input = await readBody(req); const user = users.get(String(input.email || "").trim().toLowerCase()); if (!user || user.password !== hash(String(input.password || ""))) return json(res, 401, { error: "Email hoặc mật khẩu không chính xác", requestId }); if (!user.verified) return json(res, 403, { error: "Tài khoản cần được xác thực trước khi đăng nhập", requestId }); const token = randomUUID(); sessions.set(hash(token), user.id); persist(); return json(res, 200, { token, user: { id: user.id, email: user.email } }); }
    if (req.method === "POST" && path === "/auth/verify") { const input = await readBody(req); const user = users.get(String(input.email || "").trim().toLowerCase()); if (!user || String(input.otp || "") !== "000000" || (process.env.NODE_ENV === "production" && process.env.DEMO_AUTH !== "true")) return json(res, 400, { error: "Mã xác thực không hợp lệ", requestId }); user.verified = true; persist(); audit("auth.verified", requestId, { userId: user.id }); return json(res, 200, { ok: true }); }
    if (req.method === "GET" && path === "/auth/me") { const userId = bearer(req); const user = userId && [...users.values()].find((candidate) => candidate.id === userId); if (!user) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); return json(res, 200, { user: { id: user.id, email: user.email } }); }
    if (req.method === "POST" && path === "/auth/logout") { const token = (req.headers.authorization || "").replace(/^Bearer\s+/, ""); sessions.delete(hash(token)); persist(); return json(res, 204, null); }
    const match = path.match(/^\/p\/([^/]+)(\/vcard)?$/);
    if (req.method === "GET" && match) { const profile = [...profiles.values()].find((p) => p.slug === match[1] && p.isPublic); if (!profile) return json(res, 404, { error: "Không tìm thấy hồ sơ", requestId }); if (match[2]) { res.writeHead(200, { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `attachment; filename="${profile.slug}.vcf"`, "Cache-Control": "public, max-age=60" }); return res.end(vcard(profile)); } return json(res, 200, { profile }, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" }); }
    if (req.method === "GET" && path === "/profiles") { const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); return json(res, 200, { profiles: [...profiles.values()].filter((profile) => profile.ownerId === userId) }); }
    if (req.method === "POST" && path === "/profiles") { const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); const input = await readBody(req); const displayName = String(input.displayName || "").trim(); if (!displayName) return json(res, 400, { error: "Họ và tên là bắt buộc", requestId }); const slug = uniqueSlug(displayName); const profile: Profile = { id: randomUUID(), ownerId: userId, slug, displayName, title: String(input.title || ""), organization: String(input.organization || ""), email: String(input.email || ""), phone: String(input.phone || ""), website: String(input.website || ""), bio: String(input.bio || ""), isPublic: input.isPublic !== false }; profiles.set(profile.id, profile); persist(); audit("profile.created", requestId, { profileId: profile.id, actorId: userId, slug }); return json(res, 201, { profile }); }
    const qrProfileId = path.match(/^\/profiles\/([^/]+)\/qr$/)?.[1]; if (req.method === "POST" && qrProfileId) { if (!bearer(req)) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); const profile = profiles.get(qrProfileId); if (!profile) return json(res, 404, { error: "Không tìm thấy hồ sơ", requestId }); const qr = { id: randomUUID(), profileId: profile.id, url: `https://novacard.novatechhp.vn/p/${profile.slug}`, active: true }; audit("qr.created", requestId, { profileId: profile.id, qrId: qr.id }); return json(res, 201, { qr }); }
    const jobId = path.match(/^\/jobs\/([^/]+)$/)?.[1];
    if (req.method === "GET" && jobId) {
      const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "OCR persistence chưa được cấu hình", requestId });
      const result = await db.query(`SELECT "id","ownerId","status","result","error","createdAt" FROM "OCRJob" WHERE "id"=$1 AND "ownerId"=$2`, [jobId, ownerId]);
      return result.rowCount ? json(res, 200, { job: { ...result.rows[0], type: "ocr" } }) : json(res, 404, { error: "Job not found", requestId });
    }
    if (req.method === "POST" && path === "/ocr/jobs") {
      const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db || !ocrQueue || !s3) return json(res, 503, { error: "OCR service cần DATABASE_URL, REDIS_URL và S3_*", requestId });
      const input = await readBody(req); const contentType = String(input.contentType || ""); const encoded = String(input.data || "");
      if (!allowedImageTypes.has(contentType) || !encoded) return json(res, 400, { error: "Chỉ nhận ảnh JPEG, PNG hoặc WebP", requestId });
      const buffer = Buffer.from(encoded.replace(/^data:[^;]+;base64,/, ""), "base64"); if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) return json(res, 413, { error: "Ảnh không hợp lệ hoặc vượt quá 10MB", requestId });
      const id = randomUUID(); const objectKey = `ocr/${ownerId}/${id}`; const bucket = process.env.S3_BUCKET || "novacard-assets";
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: buffer, ContentType: contentType, Metadata: { ownerId, jobId: id } }));
      await db.query(`INSERT INTO "OCRJob" ("id","ownerId","objectKey","contentType") VALUES ($1,$2,$3,$4)`, [id, ownerId, objectKey, contentType]);
      await ocrQueue.add("recognize-business-card", { jobId: id, ownerId, objectKey, contentType }, { jobId: id, attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 100, removeOnFail: 100 });
      const job: Job = { id, type: "ocr", status: "pending", ownerId, createdAt: new Date().toISOString() }; audit("ocr-job.created", requestId, { jobId: id, actorId: hash(ownerId) }); return json(res, 202, { job });
    }
    const confirmMatch = path.match(/^\/ocr\/jobs\/([^/]+)\/confirm$/)?.[1];
    if (req.method === "POST" && confirmMatch) {
      const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      const input = await readBody(req); const result = await db.query(`SELECT "result" FROM "OCRJob" WHERE "id"=$1 AND "ownerId"=$2 AND "status"='succeeded'`, [confirmMatch, ownerId]);
      if (!result.rowCount) return json(res, 404, { error: "OCR result not found or not completed", requestId });
      const fields = (input.fields || result.rows[0].result) as Record<string, unknown>; const displayName = String(fields.displayName || fields.name || "").trim();
      if (!displayName) return json(res, 400, { error: "Họ tên là bắt buộc", requestId });
      const contact = await db.query(`INSERT INTO "Contact" ("id","ownerId","displayName","notes","source") VALUES ($1,$2,$3,$4,$5) RETURNING "id","displayName","notes","source","createdAt"`, [randomUUID(), ownerId, displayName, JSON.stringify(fields), "ocr"]);
      await db.query(`UPDATE "OCRJob" SET "updatedAt"=now() WHERE "id"=$1`, [confirmMatch]); audit("ocr-job.confirmed", requestId, { jobId: confirmMatch, actorId: hash(ownerId) }); return json(res, 201, { contact: contact.rows[0] });
    }
    if (req.method === "POST" && path === "/ai/icebreakers") return json(res, 501, { error: "AI icebreaker chưa được triển khai; endpoint không nhận mock jobs", requestId });
    if (req.method === "POST" && path === "/privacy/consents/withdraw") { audit("consent.withdrawn", requestId); return json(res, 202, { ok: true, status: "accepted" }); }
    if (req.method === "DELETE" && path === "/privacy/data") { audit("privacy.deletion.requested", requestId); return json(res, 202, { ok: true, status: "queued" }); }
    return json(res, 404, { error: "Không tìm thấy nội dung", requestId });
  } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : "Bad request", requestId }); }
});
const port = Number(process.env.PORT || 4000); void restoreDatabase().then(() => server.listen(port, "0.0.0.0", () => console.log(`NovaCard API listening on ${port}`))).catch((error) => { console.error("Database startup failed", error); process.exit(1); });
