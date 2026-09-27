import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import pg = require("pg");
import { Queue } from "bullmq";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import QRCode = require("qrcode");
const { Pool } = pg;
const redisConnection = process.env.REDIS_URL ? { url: process.env.REDIS_URL } : null;
const ocrQueue = redisConnection ? new Queue("ocr-queue", { connection: { url: process.env.REDIS_URL! } }) : null;
const s3 = process.env.S3_ENDPOINT ? new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: true, credentials: process.env.S3_ACCESS_KEY ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY || "" } : undefined }) : null;
const db = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined }) : null;
async function ensureDatabase() {
  if (!db) return;
  await db.query(`CREATE TABLE IF NOT EXISTS "OCRJob" ("id" TEXT PRIMARY KEY,"ownerId" TEXT NOT NULL,"objectKey" TEXT NOT NULL,"contentType" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'pending',"result" JSONB,"error" TEXT,"attempts" INT NOT NULL DEFAULT 0,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS "OCRJob_ownerId_idx" ON "OCRJob"("ownerId");
    CREATE TABLE IF NOT EXISTS "User" ("id" TEXT PRIMARY KEY,"email" TEXT UNIQUE NOT NULL,"passwordHash" TEXT,"emailVerifiedAt" TIMESTAMPTZ,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS "Session" ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"tokenHash" TEXT UNIQUE NOT NULL,"expiresAt" TIMESTAMPTZ NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS "Profile" ("id" TEXT PRIMARY KEY,"slug" TEXT UNIQUE NOT NULL,"displayName" TEXT NOT NULL,"title" TEXT,"organization" TEXT,"bio" TEXT,"email" TEXT,"phone" TEXT,"website" TEXT,"visibility" TEXT NOT NULL DEFAULT 'PUBLIC',"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS "Contact" ("id" TEXT PRIMARY KEY,"ownerId" TEXT NOT NULL,"profileId" TEXT,"displayName" TEXT NOT NULL,"notes" TEXT,"source" TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS "Contact_ownerId_idx" ON "Contact"("ownerId");
    CREATE TABLE IF NOT EXISTS "ContactRequest" ("id" TEXT PRIMARY KEY,"requesterId" TEXT NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE,"ownerId" TEXT NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE,"status" TEXT NOT NULL DEFAULT 'pending',"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE ("requesterId","ownerId"));
    CREATE INDEX IF NOT EXISTS "ContactRequest_ownerId_status_idx" ON "ContactRequest"("ownerId","status");
    CREATE TABLE IF NOT EXISTS "Notification" ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"type" TEXT NOT NULL,"title" TEXT NOT NULL,"message" TEXT NOT NULL,"read" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId","read");
    CREATE TABLE IF NOT EXISTS "QRCode" ("id" TEXT PRIMARY KEY,"profileId" TEXT NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE,"targetUrl" TEXT NOT NULL,"logoAssetId" TEXT,"label" TEXT,"revokedAt" TIMESTAMPTZ,"scanCount" INTEGER NOT NULL DEFAULT 0,"lastScannedAt" TIMESTAMPTZ,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS "QRCode_profileId_revokedAt_idx" ON "QRCode"("profileId","revokedAt");
    ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "label" TEXT;
    ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "scanCount" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "QRCode" ADD COLUMN IF NOT EXISTS "lastScannedAt" TIMESTAMPTZ;
    ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "organization" TEXT;
    ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
    ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "companyProfileUrl" TEXT;
    ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "projectsUrl" TEXT;
    ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "communityInfo" TEXT;`);
}

type Profile = { id: string; ownerId?: string; slug: string; displayName: string; title?: string; organization?: string; email?: string; phone?: string; avatarUrl?: string; website?: string; companyProfileUrl?: string; projectsUrl?: string; communityInfo?: string; bio?: string; isPublic: boolean };
type Job = { id: string; type: "ocr" | "ai"; status: "pending" | "processing" | "succeeded" | "failed"; createdAt: string; ownerId?: string; result?: unknown; error?: string };
type User = { id: string; email: string; password: string; verified: boolean };
type QrCode = { id: string; profileId: string; targetUrl: string; logoAssetId?: string; label?: string; revokedAt?: string; scanCount: number; lastScannedAt?: string; createdAt: string };
const profiles = new Map<string, Profile>(); const jobs = new Map<string, Job>(); const users = new Map<string, User>(); const sessions = new Map<string, string>(); const qrCodes = new Map<string, QrCode>();
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const dataDir = process.env.DATA_DIR || "/data"; const dataFile = `${dataDir}/novacard.json`;
function persist() { mkdirSync(dataDir, { recursive: true }); writeFileSync(dataFile, JSON.stringify({ profiles: [...profiles.values()], users: [...users.values()], sessions: [...sessions.entries()], qrCodes: [...qrCodes.values()] }), "utf8"); void persistDatabase(); }
async function persistDatabase() { if (!db) return; for (const user of users.values()) await db.query(`INSERT INTO "User" ("id","email","passwordHash","emailVerifiedAt") VALUES ($1,$2,$3,$4) ON CONFLICT ("email") DO UPDATE SET "passwordHash"=$3,"emailVerifiedAt"=$4`, [user.id, user.email, user.password, user.verified ? new Date() : null]); for (const [tokenHash, userId] of sessions) await db.query(`INSERT INTO "Session" ("id","userId","tokenHash","expiresAt") VALUES ($1,$2,$3,$4) ON CONFLICT ("tokenHash") DO UPDATE SET "expiresAt"=$4`, [randomUUID(), userId, tokenHash, new Date(Date.now() + 30 * 86400000)]); for (const profile of profiles.values()) if (profile.ownerId) await db.query(`INSERT INTO "Profile" ("id","slug","displayName","title","organization","avatarUrl","bio","email","phone","website","companyProfileUrl","projectsUrl","communityInfo","visibility","userId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT ("slug") DO UPDATE SET "displayName"=$3,"title"=$4,"organization"=$5,"avatarUrl"=$6,"bio"=$7,"email"=$8,"phone"=$9,"website"=$10,"companyProfileUrl"=$11,"projectsUrl"=$12,"communityInfo"=$13`, [profile.id, profile.slug, profile.displayName, profile.title || null, profile.organization || null, profile.avatarUrl || null, profile.bio || null, profile.email || null, profile.phone || null, profile.website || null, profile.companyProfileUrl || null, profile.projectsUrl || null, profile.communityInfo || null, profile.isPublic ? "PUBLIC" : "PRIVATE", profile.ownerId]); for (const qr of qrCodes.values()) await db.query(`INSERT INTO "QRCode" ("id","profileId","targetUrl","logoAssetId","label","revokedAt","scanCount","lastScannedAt","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT ("id") DO UPDATE SET "targetUrl"=$3,"logoAssetId"=$4,"label"=$5,"revokedAt"=$6,"scanCount"=$7,"lastScannedAt"=$8`, [qr.id, qr.profileId, qr.targetUrl, qr.logoAssetId || null, qr.label || null, qr.revokedAt ? new Date(qr.revokedAt) : null, qr.scanCount, qr.lastScannedAt ? new Date(qr.lastScannedAt) : null, new Date(qr.createdAt)]); }
async function restoreDatabase() { if (!db) return; await ensureDatabase(); const usersResult = await db.query(`SELECT "id","email","passwordHash","emailVerifiedAt" FROM "User"`); for (const row of usersResult.rows) users.set(row.email, { id: row.id, email: row.email, password: row.passwordHash, verified: Boolean(row.emailVerifiedAt) }); const profilesResult = await db.query(`SELECT "id","userId","slug","displayName","title","organization","avatarUrl","bio","email","phone","website","companyProfileUrl","projectsUrl","communityInfo","visibility" FROM "Profile"`); for (const row of profilesResult.rows) profiles.set(row.id, { id: row.id, ownerId: row.userId, slug: row.slug, displayName: row.displayName, title: row.title || "", organization: row.organization || "", avatarUrl: row.avatarUrl || "", bio: row.bio || "", email: row.email || "", phone: row.phone || "", website: row.website || "", companyProfileUrl: row.companyProfileUrl || "", projectsUrl: row.projectsUrl || "", communityInfo: row.communityInfo || "", isPublic: row.visibility === "PUBLIC" }); const sessionsResult = await db.query(`SELECT "tokenHash","userId" FROM "Session" WHERE "expiresAt" > now()`); for (const row of sessionsResult.rows) sessions.set(row.tokenHash, row.userId); const qrResult = await db.query(`SELECT "id","profileId","targetUrl","logoAssetId","label","revokedAt","scanCount","lastScannedAt","createdAt" FROM "QRCode"`); for (const row of qrResult.rows) qrCodes.set(row.id, { id: row.id, profileId: row.profileId, targetUrl: row.targetUrl, logoAssetId: row.logoAssetId || undefined, label: row.label || undefined, revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : undefined, scanCount: Number(row.scanCount || 0), lastScannedAt: row.lastScannedAt ? new Date(row.lastScannedAt).toISOString() : undefined, createdAt: new Date(row.createdAt).toISOString() }); }
function restore() { if (db || !existsSync(dataFile)) return; try { const data = JSON.parse(readFileSync(dataFile, "utf8")) as { profiles?: Profile[]; users?: User[]; sessions?: [string, string][]; qrCodes?: QrCode[] }; for (const p of data.profiles || []) profiles.set(p.id, p); for (const u of data.users || []) users.set(u.email, u); for (const [tokenHash, userId] of data.sessions || []) sessions.set(tokenHash, userId); for (const qr of data.qrCodes || []) if (profiles.has(qr.profileId)) qrCodes.set(qr.id, { ...qr, scanCount: qr.scanCount || 0 }); } catch (error) { console.error("Could not restore persistent data", error); } }
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const oauthStates = new Map<string, { provider: "google" | "facebook"; expiresAt: number }>();
function json(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers }); res.end(JSON.stringify(data)); }
function audit(event: string, requestId: string, metadata: Record<string, unknown> = {}) { console.log(JSON.stringify({ event, requestId, at: new Date().toISOString(), ...metadata })); }
async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> { let raw = ""; for await (const chunk of req) raw += chunk; if (!raw) return {}; try { return JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error("Dữ liệu gửi lên không hợp lệ"); } }
function vcard(profile: Profile) { const esc = (v = "") => v.replace(/[\\,;\n]/g, (c) => `\\${c === "\n" ? "n" : c}`); return ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(profile.displayName)}`, `N:${esc(profile.displayName)};;;`, profile.title && `TITLE:${esc(profile.title)}`, profile.organization && `ORG:${esc(profile.organization)}`, profile.phone && `TEL;TYPE=CELL:${esc(profile.phone)}`, profile.email && `EMAIL:${esc(profile.email)}`, profile.website && `URL:${esc(profile.website)}`, `item1.URL:${profileUrl(profile.slug)}`, "item1.X-ABLabel:NovaCard", "END:VCARD"].filter(Boolean).join("\r\n") + "\r\n"; }
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
function appUrl() { return (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, ""); }
function profileUrl(slug: string) { return `${appUrl()}/p/${encodeURIComponent(slug)}`; }
function qrUrl(id: string) { return `${(process.env.API_PUBLIC_URL || `${appUrl()}/api`).replace(/\/+$/, "")}/qr/${encodeURIComponent(id)}`; }
function resourceValue(value: unknown) {
  const resource = String(value || "").trim();
  if (!resource) return "";
  if (resource.length > 12 * 1024 * 1024) throw new Error("Tài liệu PDF không được vượt quá 8MB");
  if (resource.startsWith("data:application/pdf;base64,")) return resource;
  if (/^https?:\/\//i.test(resource)) return resource;
  throw new Error("Tài nguyên phải là liên kết http(s) hoặc file PDF hợp lệ");
}
function oauthCallback(provider: "google" | "facebook") { return `${process.env.API_PUBLIC_URL || "http://localhost:4000"}/auth/${provider}/callback`; }
function oauthRedirect(provider: "google" | "facebook", state: string) {
  if (provider === "google") { const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", redirect_uri: oauthCallback(provider), response_type: "code", scope: "openid email profile", state }); return `https://accounts.google.com/o/oauth2/v2/auth?${params}`; }
  const params = new URLSearchParams({ client_id: process.env.FACEBOOK_APP_ID || "", redirect_uri: oauthCallback(provider), response_type: "code", scope: "email,public_profile", state }); return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}
function socialUser(email: string, name: string) {
  const existing = users.get(email);
  if (existing) { existing.verified = true; return existing; }
  const user: User = { id: randomUUID(), email, password: "", verified: true }; users.set(email, user); return user;
}
profiles.set("demo", { id: "demo", slug: "demo", displayName: "Nguyễn Văn Nova", title: "Phát triển kinh doanh", organization: "Novatech", email: "hello@novacard.vn", phone: "+84900000000", website: "https://novacard.novatechhp.vn", bio: "Kết nối B2B thông minh với NovaCard.", isPublic: true });
restore();
if (!profiles.has("demo")) { profiles.set("demo", { id: "demo", slug: "demo", displayName: "Nguyễn Văn Nova", title: "Phát triển kinh doanh", organization: "Novatech", email: "hello@novacard.vn", phone: "+84900000000", website: "https://novacard.novatechhp.vn", bio: "Kết nối B2B thông minh với NovaCard.", isPublic: true }); persist(); }

const server = createServer(async (req, res) => {
  const requestId = req.headers["x-request-id"]?.toString() || randomUUID(); res.setHeader("X-Request-Id", requestId);
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "http://localhost:3000"); res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id");   res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return json(res, 204, null);
  if (!allowed(req)) return json(res, 429, { error: "Bạn thao tác quá nhanh, vui lòng thử lại sau", requestId }, { "Retry-After": "60" });
  const path = new URL(req.url || "/", "http://localhost").pathname.replace(/^\/api(?=\/)/, "");
  try {
    if (req.method === "GET" && path === "/health") return json(res, 200, { ok: true, service: "novacard-api" });
    const oauthStart = path.match(/^\/auth\/(google|facebook)$/)?.[1] as "google" | "facebook" | undefined;
    if (req.method === "GET" && oauthStart) {
      const configured = oauthStart === "google" ? process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET : process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET;
      if (!configured) return json(res, 503, { error: `${oauthStart === "google" ? "Google" : "Facebook"} OAuth chưa được cấu hình`, requestId });
      const state = randomUUID(); oauthStates.set(state, { provider: oauthStart, expiresAt: Date.now() + 10 * 60 * 1000 });
      res.writeHead(302, { Location: oauthRedirect(oauthStart, state) }); return res.end();
    }
    const oauthCallbackMatch = path.match(/^\/auth\/(google|facebook)\/callback$/)?.[1] as "google" | "facebook" | undefined;
    if (req.method === "GET" && oauthCallbackMatch) {
      const query = new URL(req.url || "/", "http://localhost").searchParams; const state = query.get("state") || ""; const pending = oauthStates.get(state); oauthStates.delete(state);
      if (!pending || pending.provider !== oauthCallbackMatch || pending.expiresAt < Date.now()) { res.writeHead(302, { Location: `${appUrl()}/auth?oauth_error=invalid_state` }); return res.end(); }
      const code = query.get("code"); if (!code) { res.writeHead(302, { Location: `${appUrl()}/auth?oauth_error=denied` }); return res.end(); }
      let email = ""; let name = "";
      if (oauthCallbackMatch === "google") {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: oauthCallback("google"), grant_type: "authorization_code" }) });
        const tokens = await tokenResponse.json() as { access_token?: string }; if (!tokenResponse.ok || !tokens.access_token) throw new Error("Google OAuth token exchange failed");
        const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } }); const user = await userResponse.json() as { email?: string; name?: string }; email = String(user.email || "").trim().toLowerCase(); name = String(user.name || "").trim();
      } else {
        const tokenParams = new URLSearchParams({ client_id: process.env.FACEBOOK_APP_ID || "", client_secret: process.env.FACEBOOK_APP_SECRET || "", redirect_uri: oauthCallback("facebook"), code }); const tokenResponse = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams}`); const tokens = await tokenResponse.json() as { access_token?: string }; if (!tokenResponse.ok || !tokens.access_token) throw new Error("Facebook OAuth token exchange failed");
        const userResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokens.access_token)}`); const user = await userResponse.json() as { email?: string; name?: string }; email = String(user.email || "").trim().toLowerCase(); name = String(user.name || "").trim();
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Nhà cung cấp không trả về email hợp lệ");
      const user = socialUser(email, name); const token = randomUUID(); sessions.set(hash(token), user.id); persist(); res.writeHead(302, { Location: `${appUrl()}/auth?oauth_token=${encodeURIComponent(token)}` }); return res.end();
    }
    if (req.method === "GET" && (path === "/api/docs" || path === "/docs")) return json(res, 200, { openapi: "3.0.0", info: { title: "NovaCard API", version: "1.1.0" }, paths: { "/auth/register": {}, "/auth/login": {}, "/auth/verify": {}, "/auth/logout": {}, "/p/{slug}": {}, "/p/{slug}/vcard": {}, "/profiles": {}, "/profiles/{id}/qr": {}, "/profiles/{id}/qr-wallpaper": {}, "/qr/{id}": {}, "/qr/{id}/analytics": {}, "/ocr/jobs": {}, "/jobs/{id}": {}, "/privacy/data": {} } });
    if (req.method === "POST" && path === "/auth/register") { const input = await readBody(req); const email = String(input.email || "").trim().toLowerCase(); const password = String(input.password || ""); if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return json(res, 400, { error: "Email hợp lệ và mật khẩu phải có ít nhất 8 ký tự", requestId }); if (users.has(email)) return json(res, 409, { error: "Tài khoản đã tồn tại", requestId }); const user: User = { id: randomUUID(), email, password: hash(password), verified: false }; users.set(email, user); persist(); audit("auth.registered", requestId, { userId: user.id }); return json(res, 201, { user: { id: user.id, email, verified: false }, verificationRequired: true, devOtp: process.env.NODE_ENV !== "production" || process.env.DEMO_AUTH === "true" ? "000000" : undefined }); }
    if (req.method === "POST" && path === "/auth/login") { const input = await readBody(req); const user = users.get(String(input.email || "").trim().toLowerCase()); if (!user || user.password !== hash(String(input.password || ""))) return json(res, 401, { error: "Email hoặc mật khẩu không chính xác", requestId }); if (!user.verified) return json(res, 403, { error: "Tài khoản cần được xác thực trước khi đăng nhập", requestId }); const token = randomUUID(); sessions.set(hash(token), user.id); persist(); return json(res, 200, { token, user: { id: user.id, email: user.email } }); }
    if (req.method === "POST" && path === "/auth/verify") { const input = await readBody(req); const user = users.get(String(input.email || "").trim().toLowerCase()); if (!user || String(input.otp || "") !== "000000" || (process.env.NODE_ENV === "production" && process.env.DEMO_AUTH !== "true")) return json(res, 400, { error: "Mã xác thực không hợp lệ", requestId }); user.verified = true; persist(); audit("auth.verified", requestId, { userId: user.id }); return json(res, 200, { ok: true }); }
    if (req.method === "GET" && path === "/auth/me") { const userId = bearer(req); const user = userId && [...users.values()].find((candidate) => candidate.id === userId); if (!user) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); return json(res, 200, { user: { id: user.id, email: user.email } }); }
    if (req.method === "POST" && path === "/auth/logout") { const token = (req.headers.authorization || "").replace(/^Bearer\s+/, ""); sessions.delete(hash(token)); persist(); return json(res, 204, null); }
    const match = path.match(/^\/p\/([^/]+)(\/vcard)?$/);
    if (req.method === "GET" && match) { const profile = [...profiles.values()].find((p) => p.slug === match[1] && p.isPublic); if (!profile) return json(res, 404, { error: "Không tìm thấy hồ sơ", requestId }); if (match[2]) { res.writeHead(200, { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `attachment; filename="${profile.slug}.vcf"`, "Cache-Control": "public, max-age=60" }); return res.end(vcard(profile)); } return json(res, 200, { profile }, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" }); }
    if (req.method === "GET" && path === "/profiles") { const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); return json(res, 200, { profiles: [...profiles.values()].filter((profile) => profile.ownerId === userId) }); }
    if (req.method === "POST" && path === "/profiles") { const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); const input = await readBody(req); const displayName = String(input.displayName || "").trim(); if (!displayName) return json(res, 400, { error: "Họ và tên là bắt buộc", requestId }); let companyProfileUrl = ""; let projectsUrl = ""; try { companyProfileUrl = resourceValue(input.companyProfileUrl); projectsUrl = resourceValue(input.projectsUrl); } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : "Tài liệu không hợp lệ", requestId }); } const avatarUrl = String(input.avatarUrl || "").trim(); if (avatarUrl && !avatarUrl.startsWith("data:image/")) return json(res, 400, { error: "Ảnh đại diện không hợp lệ", requestId }); if (avatarUrl.length > 14 * 1024 * 1024) return json(res, 400, { error: "Ảnh đại diện tối đa 10MB", requestId }); const slug = uniqueSlug(displayName); const profile: Profile = { id: randomUUID(), ownerId: userId, slug, displayName, title: String(input.title || ""), organization: String(input.organization || ""), email: String(input.email || ""), phone: String(input.phone || ""), avatarUrl, website: String(input.website || ""), companyProfileUrl, projectsUrl, communityInfo: String(input.communityInfo || "").trim(), bio: String(input.bio || ""), isPublic: input.isPublic !== false }; profiles.set(profile.id, profile); persist(); audit("profile.created", requestId, { profileId: profile.id, actorId: userId, slug }); return json(res, 201, { profile }); }
    const profileId = path.match(/^\/profiles\/([^/]+)$/)?.[1];
    if ((req.method === "PUT" || req.method === "PATCH") && profileId) { const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); const profile = profiles.get(profileId); if (!profile || profile.ownerId !== userId) return json(res, 404, { error: "Không tìm thấy hồ sơ", requestId }); const input = await readBody(req); const displayName = String(input.displayName || "").trim(); if (!displayName) return json(res, 400, { error: "Họ và tên là bắt buộc", requestId }); let companyProfileUrl = ""; let projectsUrl = ""; try { companyProfileUrl = resourceValue(input.companyProfileUrl); projectsUrl = resourceValue(input.projectsUrl); } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : "Tài liệu không hợp lệ", requestId }); } const avatarUrl = String(input.avatarUrl || "").trim(); if (avatarUrl && !avatarUrl.startsWith("data:image/")) return json(res, 400, { error: "Ảnh đại diện không hợp lệ", requestId }); if (avatarUrl.length > 14 * 1024 * 1024) return json(res, 400, { error: "Ảnh đại diện tối đa 10MB", requestId }); Object.assign(profile, { displayName, title: String(input.title || ""), organization: String(input.organization || ""), email: String(input.email || ""), phone: String(input.phone || ""), avatarUrl, website: String(input.website || ""), companyProfileUrl, projectsUrl, communityInfo: String(input.communityInfo || "").trim(), bio: String(input.bio || ""), isPublic: input.isPublic !== false }); persist(); audit("profile.updated", requestId, { profileId, actorId: userId }); return json(res, 200, { profile }); }
    const qrProfileId = path.match(/^\/profiles\/([^/]+)\/qr$/)?.[1];
    if (qrProfileId) {
      const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", code: "unauthenticated", requestId });
      const profile = profiles.get(qrProfileId);
      if (!profile) return json(res, 404, { error: "Không tìm thấy hồ sơ", code: "profile_not_found", requestId });
      if (profile.ownerId !== userId) return json(res, 403, { error: "Bạn không có quyền quản lý mã QR của hồ sơ này", code: "forbidden", requestId });
      if (req.method === "GET") return json(res, 200, { qrs: [...qrCodes.values()].filter((qr) => qr.profileId === profile.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((qr) => ({ ...qr, url: qrUrl(qr.id) })) });
      if (req.method === "POST") {
        const input = await readBody(req);
        const qr: QrCode = { id: randomUUID(), profileId: profile.id, targetUrl: profileUrl(profile.slug), logoAssetId: String(input.logoAssetId || "") || undefined, label: String(input.label || "").trim() || undefined, scanCount: 0, createdAt: new Date().toISOString() };
        qrCodes.set(qr.id, qr); persist(); audit("qr.created", requestId, { profileId: profile.id, qrId: qr.id, actorId: userId });
        return json(res, 201, { qr: { ...qr, url: qrUrl(qr.id) } });
      }
    }
    const qrAnalyticsId = path.match(/^\/qr\/([^/]+)\/analytics$/)?.[1];
    if (req.method === "GET" && qrAnalyticsId) {
      const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", code: "unauthenticated", requestId });
      const qr = qrCodes.get(qrAnalyticsId); const profile = qr && profiles.get(qr.profileId);
      if (!qr) return json(res, 404, { error: "Không tìm thấy mã QR", code: "qr_not_found", requestId });
      if (!profile || profile.ownerId !== userId) return json(res, 403, { error: "Bạn không có quyền xem mã QR này", code: "forbidden", requestId });
      return json(res, 200, { analytics: { id: qr.id, scanCount: qr.scanCount, lastScannedAt: qr.lastScannedAt || null } }, { "Cache-Control": "no-store" });
    }
    const qrId = path.match(/^\/qr\/([^/]+)$/)?.[1];
    if (req.method === "GET" && qrId) {
      const qr = qrCodes.get(qrId);
      if (!qr || qr.revokedAt) return json(res, 404, { error: "Mã QR không tồn tại hoặc đã bị thu hồi", code: "qr_not_found", requestId });
      qr.scanCount += 1;
      qr.lastScannedAt = new Date().toISOString();
      persist();
      res.writeHead(302, { Location: qr.targetUrl, "Cache-Control": "no-store" }); return res.end();
    }
    if (req.method === "PATCH" && qrId) {
      const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", code: "unauthenticated", requestId });
      const qr = qrCodes.get(qrId);
      if (!qr) return json(res, 404, { error: "Không tìm thấy mã QR", code: "qr_not_found", requestId });
      const profile = profiles.get(qr.profileId);
      if (!profile || profile.ownerId !== userId) return json(res, 403, { error: "Bạn không có quyền thay đổi mã QR này", code: "forbidden", requestId });
      const input = await readBody(req);
      if (typeof input.label === "string") qr.label = input.label.trim() || undefined;
      if ("active" in input) qr.revokedAt = input.active === false ? new Date().toISOString() : undefined;
      persist(); audit("qr.updated", requestId, { profileId: qr.profileId, qrId: qr.id, actorId: userId, active: !qr.revokedAt });
      return json(res, 200, { qr });
    }
    const wallpaperProfileId = path.match(/^\/profiles\/([^/]+)\/qr-wallpaper$/)?.[1];
    if (req.method === "GET" && wallpaperProfileId) {
      const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", code: "unauthenticated", requestId });
      const profile = profiles.get(wallpaperProfileId);
      if (!profile) return json(res, 404, { error: "Không tìm thấy hồ sơ", code: "profile_not_found", requestId });
      if (profile.ownerId !== userId) return json(res, 403, { error: "Bạn không có quyền tải QR của hồ sơ này", code: "forbidden", requestId });
      const qr = [...qrCodes.values()].filter((candidate) => candidate.profileId === profile.id && !candidate.revokedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const target = qr ? qrUrl(qr.id) : profileUrl(profile.slug);
      const svg = await QRCode.toString(target, { type: "svg", width: 1200, margin: 4, errorCorrectionLevel: "H" });
      res.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="${profile.slug}-qr-wallpaper.svg"`, "Cache-Control": "private, no-store" }); return res.end(svg);
    }
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
   if (req.method === "POST" && path === "/contacts/from-profile") {
      return json(res, 403, { error: "Lưu vào danh bạ chỉ qua luồng mời kết nối (accept request). Sử dụng nút Gửi yêu cầu kết nối trên profile." });
   }
   if (req.method === "GET" && path === "/contacts") {
     const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
       const contacts = await db.query(`SELECT "id","displayName","notes","source","createdAt" FROM "Contact" WHERE "ownerId"=$1 ORDER BY "createdAt" DESC`, [ownerId]);
       const seen = new Set<string>();
       const unique = contacts.rows.filter((row) => {
         let fields: Record<string, string> = {};
         try { fields = typeof row.notes === "string" ? JSON.parse(row.notes) : {}; } catch { fields = {}; }
         const key = [row.displayName, fields.email || "", fields.phone || ""].map((part) => String(part || "").trim().toLowerCase()).join("|");
         if (seen.has(key)) return false;
         seen.add(key);
         return true;
       });
       return json(res, 200, { contacts: unique });
     }
     const contactId = path.match(/^\/contacts\/([^/]+)$/)?.[1];
     if (req.method === "DELETE" && contactId) {
       const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
       if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
       const deleted = await db.query(`DELETE FROM "Contact" WHERE "id"=$1 AND "ownerId"=$2 RETURNING "id"`, [contactId, ownerId]);
       return deleted.rowCount ? json(res, 200, { ok: true }) : json(res, 404, { error: "Không tìm thấy liên hệ", requestId });
     }
    // Contact request flow: create, list, accept/reject.
    if (req.method === "POST" && path === "/contact-requests") {
      const requesterId = bearer(req); if (!requesterId) return json(res, 401, { error: "Vui lòng đăng nhập để gửi yêu cầu", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      const input = await readBody(req);
      const slug = String(input.slug || "").trim(); if (!slug) return json(res, 400, { error: "Thiếu hồ sơ đích", code: "missing_slug", requestId });
      const ownerProfile = [...profiles.values()].find((p) => p.slug === slug && p.isPublic);
      if (!ownerProfile?.ownerId) return json(res, 404, { error: "Không tìm thấy hồ sơ công khai", code: "profile_not_found", requestId });
      if (ownerProfile.ownerId === requesterId) return json(res, 400, { error: "Bạn không thể gửi yêu cầu cho chính mình", code: "self_request", requestId });
      const requesterProfile = [...profiles.values()].find((p) => p.ownerId === requesterId);
      if (!requesterProfile) return json(res, 400, { error: "Bạn cần tạo hồ sơ trước khi kết nối", code: "profile_required", requestId });
      try {
        const reqRow = await db.query(`INSERT INTO "ContactRequest" ("id","requesterId","ownerId","status","updatedAt") VALUES ($1,$2,$3,'pending',now()) ON CONFLICT ("requesterId","ownerId") DO UPDATE SET "status"='pending',"updatedAt"=now() RETURNING *`, [randomUUID(), requesterProfile.id, ownerProfile.id]);
        await db.query(`INSERT INTO "Notification" ("id","userId","type","title","message") VALUES ($1,$2,'contact_request','Yêu cầu kết nối danh bạ', $3)`, [randomUUID(), ownerProfile.ownerId, `${requesterProfile.displayName} muốn kết nối với bạn.`]);
        return json(res, 201, { request: reqRow.rows[0], confirmUrl: `${appUrl()}/connect/${reqRow.rows[0].id}` });
      } catch (error) { return json(res, 500, { error: "Không thể gửi yêu cầu kết nối", requestId }); }
    }
    const crById = path !== "/contact-requests/sent" ? path.match(/^\/contact-requests\/([^/]+)$/)?.[1] : undefined;
    if (req.method === "GET" && crById) {
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      const rows = await db.query(`SELECT cr."id", cr."status", cr."createdAt", p."slug" AS "requesterSlug", p."displayName" AS "requesterName", p."title" AS "requesterTitle", p."organization" AS "requesterOrganization", o."slug" AS "ownerSlug", o."displayName" AS "ownerName" FROM "ContactRequest" cr JOIN "Profile" p ON p."id"=cr."requesterId" JOIN "Profile" o ON o."id"=cr."ownerId" WHERE cr."id"=$1`, [crById]);
      if (!rows.rowCount) return json(res, 404, { error: "Không tìm thấy yêu cầu kết nối", requestId });
      return json(res, 200, { request: rows.rows[0] });
    }
    if (req.method === "GET" && path === "/contact-requests") {
      const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      const rows = await db.query(`SELECT cr.*, p."displayName" AS "requesterName", p."email" AS "requesterEmail" FROM "ContactRequest" cr JOIN "Profile" p ON p."id"=cr."requesterId" JOIN "Profile" o ON o."id"=cr."ownerId" WHERE o."userId"=$1 ORDER BY cr."createdAt" DESC`, [ownerId]);
      return json(res, 200, { requests: rows.rows });
    }
    if (req.method === "GET" && path === "/contact-requests/sent") {
      const requesterUserId = bearer(req); if (!requesterUserId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      const rows = await db.query(`SELECT cr."id", cr."status", cr."createdAt", o."slug" AS "ownerSlug", o."displayName" AS "ownerName", o."title" AS "ownerTitle", o."organization" AS "ownerOrganization", o."email" AS "ownerEmail", o."phone" AS "ownerPhone" FROM "ContactRequest" cr JOIN "Profile" requester ON requester."id"=cr."requesterId" JOIN "Profile" o ON o."id"=cr."ownerId" WHERE requester."userId"=$1 ORDER BY cr."createdAt" DESC`, [requesterUserId]);
      return json(res, 200, { requests: rows.rows });
    }
    const crMatch = path.match(/^\/contact-requests\/([^/]+)\/(accept|reject)$/); const crId = crMatch?.[1]; const crAction = crMatch?.[2];
    if (req.method === "POST" && crId && crAction) {
      const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      const rows = await db.query(`UPDATE "ContactRequest" AS request SET "status"=$1,"updatedAt"=now() WHERE request."id"=$2 AND EXISTS (SELECT 1 FROM "Profile" owner_profile WHERE owner_profile."id"=request."ownerId" AND owner_profile."userId"=$3) AND request."status"='pending' RETURNING request.*`, [crAction === "accept" ? "accepted" : "rejected", crId, ownerId]);
      if (!rows.rowCount) return json(res, 404, { error: "Không tìm thấy yêu cầu pending", requestId });
      const reqRow = rows.rows[0];
      if (crAction === "accept") {
        const requesterProfile = [...profiles.values()].find((p) => p.id === reqRow.requesterId);
        const ownerProfile = [...profiles.values()].find((p) => p.id === reqRow.ownerId);
        if (requesterProfile && ownerProfile) {
          const fields = { displayName: ownerProfile.displayName, title: ownerProfile.title || "", organization: ownerProfile.organization || "", email: ownerProfile.email || "", phone: ownerProfile.phone || "", website: ownerProfile.website || "" };
          const existing = await db.query(`SELECT 1 FROM "Contact" WHERE "ownerId"=$1 AND ("profileId"=$2 OR LOWER("displayName")=LOWER($3)) LIMIT 1`, [requesterProfile.ownerId!, ownerProfile.id, ownerProfile.displayName]);
          if (!existing.rowCount) await db.query(`INSERT INTO "Contact" ("id","ownerId","profileId","displayName","notes","source") VALUES ($1,$2,$3,$4,$5,'request')`, [randomUUID(), requesterProfile.ownerId!, ownerProfile.id, ownerProfile.displayName, JSON.stringify(fields)]);
          await db.query(`INSERT INTO "Notification" ("id","userId","type","title","message") VALUES ($1,$2,'contact_accepted','Yêu cầu được chấp nhận', $3)`, [randomUUID(), requesterProfile.ownerId!, `${ownerProfile.displayName} đã chấp nhận yêu cầu kết nối của bạn.`]);
        }
      }
      return json(res, 200, { request: reqRow });
    }
    if (req.method === "GET" && path === "/notifications") {
      const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      const rows = await db.query(`SELECT * FROM "Notification" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 50`, [userId]);
      return json(res, 200, { notifications: rows.rows });
    }
    if (req.method === "POST" && path === "/notifications/read") {
      const userId = bearer(req); if (!userId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      await db.query(`UPDATE "Notification" SET "read"=true WHERE "userId"=$1`, [userId]);
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && path === "/contacts") { const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId }); if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId }); const input = await readBody(req); const displayName = String(input.displayName || "").trim(); if (!displayName) return json(res, 400, { error: "Họ tên liên hệ là bắt buộc", requestId }); const fields = { displayName, title: String(input.title || ""), organization: String(input.organization || ""), email: String(input.email || ""), phone: String(input.phone || ""), website: String(input.website || "") }; const contact = await db.query(`INSERT INTO "Contact" ("id","ownerId","displayName","notes","source") VALUES ($1,$2,$3,$4,$5) RETURNING "id","displayName","notes","source","createdAt"`, [randomUUID(), ownerId, displayName, JSON.stringify(fields), "manual"]); audit("contact.created", requestId, { contactId: contact.rows[0].id, actorId: hash(ownerId), source: "manual" }); return json(res, 201, { contact: contact.rows[0] }); }
    const confirmMatch = path.match(/^\/ocr\/jobs\/([^/]+)\/confirm$/)?.[1];
    if (req.method === "POST" && confirmMatch) {
      const ownerId = bearer(req); if (!ownerId) return json(res, 401, { error: "Vui lòng đăng nhập để tiếp tục", requestId });
      if (!db) return json(res, 503, { error: "Database chưa được cấu hình", requestId });
      const input = await readBody(req); const result = await db.query(`SELECT "result" FROM "OCRJob" WHERE "id"=$1 AND "ownerId"=$2 AND "status"='succeeded'`, [confirmMatch, ownerId]);
      if (!result.rowCount) return json(res, 404, { error: "OCR result not found or not completed", requestId });
      const fields = (input.fields || result.rows[0].result) as Record<string, unknown>; const displayName = String(fields.displayName || fields.name || "").trim();
      if (!displayName) return json(res, 400, { error: "Họ tên là bắt buộc", requestId });
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const claimed = await client.query(`UPDATE "OCRJob" SET "status"='confirmed',"updatedAt"=now() WHERE "id"=$1 AND "ownerId"=$2 AND "status"='succeeded' RETURNING "id"`, [confirmMatch, ownerId]);
        if (!claimed.rowCount) { await client.query("ROLLBACK"); return json(res, 409, { error: "OCR job đã được xác nhận trước đó", requestId }); }
        const contact = await client.query(`INSERT INTO "Contact" ("id","ownerId","displayName","notes","source") VALUES ($1,$2,$3,$4,$5) RETURNING "id","displayName","notes","source","createdAt"`, [randomUUID(), ownerId, displayName, JSON.stringify(fields), "ocr"]);
        await client.query("COMMIT"); audit("ocr-job.confirmed", requestId, { jobId: confirmMatch, actorId: hash(ownerId), contactId: contact.rows[0].id }); return json(res, 201, { contact: contact.rows[0] });
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    }
    if (req.method === "POST" && path === "/ai/icebreakers") return json(res, 501, { error: "AI icebreaker chưa được triển khai; endpoint không nhận mock jobs", requestId });
    if (req.method === "POST" && path === "/privacy/consents/withdraw") { audit("consent.withdrawn", requestId); return json(res, 202, { ok: true, status: "accepted" }); }
    if (req.method === "DELETE" && path === "/privacy/data") { audit("privacy.deletion.requested", requestId); return json(res, 202, { ok: true, status: "queued" }); }
    return json(res, 404, { error: "Không tìm thấy nội dung", requestId });
  } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : "Bad request", requestId }); }
});
const port = Number(process.env.PORT || 4000); void restoreDatabase().then(() => server.listen(port, "0.0.0.0", () => console.log(`NovaCard API listening on ${port}`))).catch((error) => { console.error("Database startup failed", error); process.exit(1); });
