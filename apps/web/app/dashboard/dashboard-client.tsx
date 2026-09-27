"use client";

import { AlertCircle, ArrowUpRight, ExternalLink, FileText, LogOut, Mail, Phone, Plus, QrCode, ScanLine, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import OcrPanel from "./ocr-panel";
import NotificationsPanel from "./notifications-panel";
import ProfileCard from "../p/[slug]/profile-card";

type Profile = Record<string, string> & { id: string; slug: string };
type Contact = { id: string; displayName: string; title?: string; organization?: string; email?: string; phone?: string; source?: string };
type CurrentUser = { id: string; email: string };

function addResourceFields(form: HTMLFormElement, profile: Profile | null) {
  if (form.dataset.resourceFields === "true") return;
  form.dataset.resourceFields = "true";
  const fields = [
    { name: "companyProfileUrl", label: "Profile công ty (URL)", value: profile?.companyProfileUrl?.startsWith("http") ? profile.companyProfileUrl : "", placeholder: "https://congty.vn/profile" },
    { name: "companyProfileFile", label: "File profile công ty (PDF)", value: "", placeholder: "Tối đa 8MB", file: true },
    { name: "projectsUrl", label: "Dự án tiêu biểu (URL)", value: profile?.projectsUrl?.startsWith("http") ? profile.projectsUrl : "", placeholder: "https://congty.vn/du-an" },
    { name: "projectsFile", label: "File dự án tiêu biểu (PDF)", value: "", placeholder: "Tối đa 8MB", file: true },
    { name: "communityInfo", label: "Thông tin hội", value: profile?.communityInfo || "", placeholder: "Các hội, hiệp hội, cộng đồng hoặc hoạt động chuyên môn…", textarea: true },
  ];
  const anchor = form.querySelector("button[type=submit]");
  for (const field of fields) {
    const label = document.createElement("label"); label.textContent = field.label;
    const input = field.textarea ? document.createElement("textarea") : document.createElement("input");
    input.name = field.name; input.placeholder = field.placeholder; input.value = field.value;
    if (field.file && input instanceof HTMLInputElement) { input.type = "file"; input.accept = "application/pdf"; }
    if (field.textarea && input instanceof HTMLTextAreaElement) input.rows = 4;
    label.appendChild(input); form.insertBefore(label, anchor);
  }
}

function readContact(contact: Record<string, unknown>): Contact {
  let fields: Record<string, string> = {};
  try { fields = typeof contact.notes === "string" ? JSON.parse(contact.notes) as Record<string, string> : {}; } catch { /* Keep basic legacy contacts usable. */ }
  return { id: String(contact.id), displayName: String(contact.displayName || ""), title: fields.title, organization: fields.organization, email: fields.email, phone: fields.phone, source: String(contact.source || "") };
}

export default function DashboardClient() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tab, setTab] = useState<"profile" | "scan" | "contacts">("profile");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem("novacard_token") : null;
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("next");
    if (target?.startsWith("/")) setNext(target);
    if (params.get("reason") === "profile_required") setMessage("Tạo hồ sơ của bạn để có thể gửi yêu cầu kết nối. Sau khi tạo xong bạn sẽ được đưa lại trang hồ sơ cần kết nối.");
  }, []);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".profile-form");
    if (form) addResourceFields(form, profile);
  }, [editing, profile, tab]);

  useEffect(() => {
    if (!token) { window.location.replace(next ? `/auth?next=${encodeURIComponent(next)}` : "/auth"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    void fetch("/api/auth/me", { headers }).then(async (response) => {
      if (!response.ok) { localStorage.removeItem("novacard_token"); window.location.replace(next ? `/auth?next=${encodeURIComponent(next)}` : "/auth"); return; }
      const me = await response.json(); setUser(me.user);
      const [profiles, savedContacts] = await Promise.all([fetch("/api/profiles", { headers }), fetch("/api/contacts", { headers })]);
      if (profiles.ok) { const data = await profiles.json(); setProfile(data.profiles?.[data.profiles.length - 1] || null); }
      if (savedContacts.ok) { const data = await savedContacts.json(); setContacts((data.contacts || []).map(readContact)); }
    });
  }, [token, next]);

  const reloadContacts = async () => {
    if (!token) return;
    const response = await fetch("/api/contacts", { headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) setContacts(((await response.json()).contacts || []).map(readContact));
  };
  const formData = (form: HTMLFormElement) => Object.fromEntries(["displayName", "title", "organization", "email", "phone", "bio", "website", "companyProfileUrl", "projectsUrl", "communityInfo"].map((key) => [key, String(new FormData(form).get(key) || "")])) as Record<string, string>;
  const readPdf = (file: File) => new Promise<string>((resolve, reject) => { if (file.type !== "application/pdf") return reject(new Error("Chỉ nhận file PDF")); if (file.size > 8 * 1024 * 1024) return reject(new Error("File PDF tối đa 8MB")); const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Không thể đọc file PDF")); reader.readAsDataURL(file); });
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage("");
    const values = formData(event.currentTarget);
    values.companyProfileUrl = values.companyProfileUrl || profile?.companyProfileUrl || "";
    values.projectsUrl = values.projectsUrl || profile?.projectsUrl || "";
    const companyProfileFile = (event.currentTarget.elements.namedItem("companyProfileFile") as HTMLInputElement | null)?.files?.[0];
    const projectsFile = (event.currentTarget.elements.namedItem("projectsFile") as HTMLInputElement | null)?.files?.[0];
    try { if (companyProfileFile) values.companyProfileUrl = await readPdf(companyProfileFile); if (projectsFile) values.projectsUrl = await readPdf(projectsFile); } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể đọc tài liệu PDF"); return; }
    const requiredFields: Record<string, string> = { displayName: "h? v? t?n", title: "ch?c danh", organization: "c?ng ty / t? ch?c", email: "email", phone: "s? ?i?n tho?i", bio: "gi?i thi?u ng?n" };
    const missingFields = Object.entries(requiredFields).filter(([field]) => !values[field]?.trim()).map(([, label]) => label);
    if (missingFields.length) { setMessage(`Vui lòng bổ sung: ${missingFields.join(", ")}.`); return; }
    setBusy(true);
    try {
      const response = await fetch(profile ? `/api/profiles/${profile.id}` : "/api/profiles", { method: profile ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify(values) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Không thể lưu hồ sơ");
      setProfile(result.profile); setEditing(false); setMessage("Đã lưu thông tin hồ sơ.");
      if (!profile && next) { window.location.href = `${next}?connected=1`; return; }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu hồ sơ"); } finally { setBusy(false); }
  };
  return <div className="dashboard-shell"><header className="dashboard-top"><a className="brand" href="/dashboard"><span className="brand-mark"><ShieldCheck size={16} /></span>NovaCard</a><div className="top-actions"><span className="user-pill"><UserRound size={15} /> {user?.email || "Tài khoản cá nhân"}</span><button className="ghost-button" onClick={() => { localStorage.removeItem("novacard_token"); window.location.href = "/auth"; }}><LogOut size={15} /> Đăng xuất</button>{token && <NotificationsPanel token={token} onContactsChanged={reloadContacts} />}</div></header><main className="dashboard-content" aria-busy={processing}><div className="dashboard-heading"><div><p className="kicker">Không gian / Tổng quan</p><h1>{profile ? `Xin chào, ${profile.displayName}` : "Tạo danh thiếp của bạn"}</h1><p>{profile ? "Quản lý danh thiếp số và danh bạ của bạn tại đây." : "Tạo hồ sơ cá nhân để bắt đầu sử dụng NovaCard."}</p></div></div>{next && !profile && <div className="dashboard-callout" role="status"><AlertCircle size={18} /><div><strong>Bạn chưa có hồ sơ NovaCard</strong><span>Yêu cầu kết nối cần một hồ sơ để chủ hồ sơ biết bạn là ai. Điền thông tin bên dưới, sau đó bạn sẽ được đưa lại trang hồ sơ cần kết nối.</span></div>{next && <a className="secondary-button" href={next}>Bỏ qua, quay lại hồ sơ</a>}</div>}<div className="dashboard-tabs" role="tablist"><button className={tab === "profile" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("profile")}><UserRound size={16} /> Hồ sơ của tôi</button><button className={tab === "scan" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("scan")}><ScanLine size={16} /> Quét danh thiếp</button><button className={tab === "contacts" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("contacts")}><FileText size={16} /> Danh bạ</button></div>{tab === "profile" && <><section className="dashboard-card-section"><div className="dashboard-section-heading"><div><p className="kicker">Card visit của bạn</p><h2>Danh thiếp số</h2><p>Đây là giao diện người khác nhìn thấy khi mở link hoặc quét mã QR.</p></div>{profile && <button className="secondary-button" onClick={() => setEditing(true)}>Chỉnh sửa thông tin</button>}</div>{profile && !editing ? <ProfileCard profile={profile} slug={profile.slug} isOwnProfile /> : <section className="panel" id="profile-form"><div className="panel-heading"><div><h2><Plus size={18} /> {profile ? "Chỉnh sửa thông tin" : "Tạo hồ sơ mới"}</h2><p>Thông tin này sẽ được hiển thị trên card visit của bạn.</p></div></div><form onSubmit={saveProfile} className="profile-form"><label>Họ và tên<input name="displayName" defaultValue={profile?.displayName} placeholder="Nguyễn Văn Nova" required /></label><div className="form-two"><label>Chức danh<input name="title" defaultValue={profile?.title} placeholder="Giám đốc" /></label><label>Công ty / tổ chức<input name="organization" defaultValue={profile?.organization} placeholder="Novatech" /></label></div><div className="form-two"><label>Email<input name="email" type="email" defaultValue={profile?.email} placeholder="hello@company.com" /></label><label>Số điện thoại<input name="phone" defaultValue={profile?.phone} placeholder="+84…" /></label></div><label>Giới thiệu ngắn<input name="bio" defaultValue={profile?.bio} placeholder="Kết nối chuyên nghiệp…" /></label><label>Logo công ty<input type="file" accept="image/png,image/jpeg,image/svg+xml" disabled /><small className="form-help">Tính năng tải logo sẽ được bổ sung ở phiên bản tiếp theo.</small></label><button className="primary-cta" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thông tin"}<ArrowUpRight size={17} /></button>{message && <p className="form-message">{message}</p>}</form></section>}</section>{profile && <div className="dashboard-overview-metrics metric-grid"><div className="metric-card"><span className="metric-icon blue"><UserRound size={18} /></span><strong>1</strong><span>Hồ sơ đang hoạt động</span></div><div className="metric-card"><span className="metric-icon violet"><QrCode size={18} /></span><strong>0</strong><span>Lượt quét QR</span></div><div className="metric-card"><span className="metric-icon green"><FileText size={18} /></span><strong>{contacts.length}</strong><span>Liên hệ đã lưu</span></div></div>}</>}{tab === "scan" && <div className="dashboard-tab-content"><OcrPanel onSaved={(contact) => setContacts((items) => [contact, ...items])} onProcessingChange={setProcessing} /></div>}{tab === "contacts" && <section className="panel contacts-page"><div className="panel-heading"><div><p className="kicker">Danh bạ cá nhân</p><h2>Liên hệ đã lưu</h2><p>Các liên hệ được lưu từ những danh thiếp bạn đã quét.</p></div></div>{contacts.length ? contacts.map((contact) => <div className="profile-result" key={contact.id}><span className="result-avatar">{contact.displayName.slice(0, 1)}</span><div><strong>{contact.displayName}</strong><span>{[contact.title, contact.organization].filter(Boolean).join(" · ") || "Liên hệ mới"}</span>{(contact.email || contact.phone) && <small>{[contact.email, contact.phone].filter(Boolean).join(" · ")}</small>}</div><span className="contact-source">{contact.source === "ocr" ? "OCR" : "Đã lưu"}</span></div>) : <div className="empty-state"><UserRound size={28} /><strong>Chưa có liên hệ nào</strong><span>Scan danh thiếp để lưu thông tin liên hệ.</span></div>}</section>}</main>{processing && <div className="dashboard-processing-overlay" role="status"><div className="processing-spinner" /><strong>Đang xử lý danh thiếp…</strong><span>Vui lòng chờ, không đóng trang.</span></div>}</div>;
}
