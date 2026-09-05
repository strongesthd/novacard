"use client";

import { ChangeEvent, useEffect, useState } from "react";

type Job = { id: string; status: string; result?: Record<string, unknown>; error?: string };

async function readJson(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  if (!contentType.includes("application/json")) throw new Error(`M?y ch? tr? v? HTTP ${response.status} thay v? JSON. H?y t?i l?i trang r?i th? l?i.`);
  try { return JSON.parse(raw) as { job?: Job; error?: string }; } catch { throw new Error("Ph?n h?i m?y ch? kh?ng h?p l?. H?y th? l?i."); }
}

export default function OcrPanel() {
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (!job || ["succeeded", "failed"].includes(job.status)) return; const timer = window.setInterval(async () => { const token = localStorage.getItem("novacard_token"); const response = await fetch(`/api/jobs/${job.id}`, { headers: { Authorization: `Bearer ${token || ""}`, Accept: "application/json" }, cache: "no-store" }); if (response.ok) { const body = await readJson(response); if (body.job) if (body.job) setJob(body.job); } }, 1500); return () => window.clearInterval(timer); }, [job]);
  const readOptimizedImage = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const image = new Image(); image.onload = () => { const scale = Math.min(1, 1800 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); const context = canvas.getContext("2d"); if (!context) return reject(new Error("Kh?ng th? x? l? ?nh")); context.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", 0.82)); }; image.onerror = () => reject(new Error("Kh?ng ??c ???c ?nh")); image.src = String(reader.result); }; reader.onerror = () => reject(new Error("Kh?ng ??c ???c ?nh")); reader.readAsDataURL(file);
  });

  const upload = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { setMessage("Chỉ nhận ảnh JPEG, PNG hoặc WebP tối đa 10MB"); return; } setBusy(true); setMessage(""); try { const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Không đọc được ảnh")); reader.readAsDataURL(file); }); const token = localStorage.getItem("novacard_token"); const response = await fetch("/api/ocr/jobs", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ contentType: file.type, data }) }); const body = await readJson(response); if (!response.ok) throw new Error(body.error || "Không thể tạo OCR job"); if (body.job) setJob(body.job); } catch (error) { setMessage(error instanceof Error ? error.message : "Upload thất bại"); } finally { setBusy(false); } };
  const confirm = async () => { if (!job) return; const token = localStorage.getItem("novacard_token"); const response = await fetch(`/api/ocr/jobs/${job.id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ fields: job.result }) }); setMessage(response.ok ? "Đã lưu liên hệ." : "Không thể lưu liên hệ."); };
  return <section className="panel"><div className="panel-heading"><div><h2>Số hóa danh thiếp giấy</h2><p>OCR Việt · Anh · Hàn chạy nền, không chặn màn hình.</p></div></div><label className="upload-drop">{busy ? "\u0110ang t\u1ea3i \u1ea3nh\u2026" : job?.status === "processing" ? "\u0110ang nh\u1eadn di\u1ec7n\u2026" : "Ch\u1ecdn ho\u1eb7c ch\u1ee5p \u1ea3nh danh thi\u1ebfp"}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={upload} disabled={busy} /></label>{job && <p className="form-message">Job {job.id.slice(0, 8)}? ? {job.status}{job.status === "succeeded" && " ? kết quả đã sẵn sàng để review"}</p>}{job?.status === "succeeded" && <div className="ocr-review"><strong>Review trước khi lưu</strong>{Object.entries(job.result || {}).map(([key, value]) => <label key={key}>{key}<input defaultValue={String(value ?? "")} /></label>)}<button className="primary-cta" type="button" onClick={confirm}>Xác nhận và lưu</button></div>}{message && <p className="form-message">{message}</p>}</section>;
}

