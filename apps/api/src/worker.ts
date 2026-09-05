import { Worker } from "bullmq";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import { createWorker } from "tesseract.js";

const redisUrl = process.env.REDIS_URL;
const databaseUrl = process.env.DATABASE_URL;
if (!redisUrl || !databaseUrl) throw new Error("REDIS_URL and DATABASE_URL are required");
const db = new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY || "", secretAccessKey: process.env.S3_SECRET_KEY || "" } });
async function bodyBuffer(body: unknown) { const chunks: Buffer[] = []; for await (const chunk of body as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks); }
async function recognize(data: { objectKey: string; contentType: string }) {
  const object = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET || "novacard-assets", Key: data.objectKey }));
  const file = await bodyBuffer(object.Body);
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const prompt = `??c ?nh danh thi?p v? ch? tr? v? JSON h?p l?, kh?ng markdown, theo ??ng schema n?y: {"displayName":"","title":"","organization":"","email":"","phone":"","website":"","bio":""}. Quy t?c: displayName ch? l? t?n ng??i; title ch? l? ch?c danh; organization ch? l? t?n c?ng ty/t? ch?c; kh?ng ??a title v?o organization ho?c displayName; kh?ng suy ?o?n; tr??ng kh?ng nh?n th?y ?? chu?i r?ng; gi? nguy?n ti?ng Vi?t c? d?u; chu?n h?a s? ?i?n tho?i v? website.`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: data.contentType, data: file.toString("base64") } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }), signal: AbortSignal.timeout(Number(process.env.OCR_TIMEOUT_MS || 60000))
    });
    if (!response.ok) throw new Error(`Gemini OCR returned ${response.status}`);
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim()) as Record<string, unknown>;
    return { ...parsed, engine: model, provider: "gemini" };
  }
  const language = process.env.OCR_LANGUAGES || "eng+vie+kor";
  const result = await createWorker(language, 1, { logger: () => undefined });
  try { const output = await result.recognize(file, { rotateAuto: true }); return { text: output.data.text.trim(), confidence: output.data.confidence, engine: "tesseract.js", languages: language }; }
  finally { await result.terminate(); }
}
const worker = new Worker("ocr-queue", async (job) => {
  await db.query(`UPDATE "OCRJob" SET "status"='processing',"attempts"="attempts"+1,"updatedAt"=now() WHERE "id"=$1`, [job.data.jobId]);
  try { const result = await recognize(job.data); await db.query(`UPDATE "OCRJob" SET "status"='succeeded',"result"=$2,"error"=NULL,"updatedAt"=now() WHERE "id"=$1`, [job.data.jobId, JSON.stringify(result)]); return result; }
  catch (error) { const message = error instanceof Error ? error.message : "OCR failed"; const final = job.attemptsMade + 1 >= (job.opts.attempts || 1); await db.query(`UPDATE "OCRJob" SET "status"=$2,"error"=$3,"updatedAt"=now() WHERE "id"=$1`, [job.data.jobId, final ? "failed" : "pending", message]); throw error; }
}, { connection: { url: redisUrl }, concurrency: Number(process.env.OCR_WORKER_CONCURRENCY || 2) });
worker.on("completed", (job) => console.log(JSON.stringify({ event: "ocr.completed", jobId: job.id })));
worker.on("failed", (job, error) => console.error(JSON.stringify({ event: "ocr.failed", jobId: job?.id, error: error.message })));
console.log("NovaCard OCR worker started");

