"use client";

import { ArrowUpRight, FileText, ExternalLink, LogOut, Mail, Phone, Plus, QrCode, ScanLine, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import OcrPanel from "./ocr-panel";
import ProfileCard from "../p/[slug]/profile-card";

type Profile = Record<string, string> & { id: string; slug: string };
type Contact = { id: string; displayName: string; title?: string; organization?: string; email?: string; phone?: string; source?: string };
type CurrentUser = { id: string; email: string };

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

  useEffect(() => {
    if (!token) { window.location.replace("/auth"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    void fetch("/api/auth/me", { headers }).then(async (response) => {
      if (!response.ok) { localStorage.removeItem("novacard_token"); window.location.replace("/auth"); return; }
      const me = await response.json(); setUser(me.user);
      const [profiles, savedContacts] = await Promise.all([fetch("/api/profiles", { headers }), fetch("/api/contacts", { headers })]);
      if (profiles.ok) { const data = await profiles.json(); setProfile(data.profiles?.[data.profiles.length - 1] || null); }
      if (savedContacts.ok) { const data = await savedContacts.json(); setContacts((data.contacts || []).map(readContact)); }
    });
  }, [token]);

  const formData = (form: HTMLFormElement) => Object.fromEntries(["displayName", "title", "organization", "email", "phone", "bio"].map((key) => [key, String(new FormData(form).get(key) || "")]));
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(profile ? `/api/profiles/${profile.id}` : "/api/profiles", { method: profile ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify(formData(event.currentTarget)) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Không thể lưu hồ sơ");
      setProfile(result.profile); setEditing(false); setMessage("Đã lưu thông tin hồ sơ.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu hồ sơ"); } finally { setBusy(false); }
  };
  const profileUrl = profile ? `/p/${encodeURIComponent(profile.slug)}` : "#profile-form";

  return <div className="dashboard-shell"><header className="dashboard-top"><a className="brand" href="/dashboard"><span className="brand-mark"><ShieldCheck size={16} /></span>NovaCard</a><div className="top-actions"><span className="user-pill"><UserRound size={15} /> {user?.email || "Tài khoản cá nhân"}</span><button className="ghost-button" onClick={() => { localStorage.removeItem("novacard_token"); window.location.href = "/auth"; }}><LogOut size={15} /> Đăng xuất</button></div></header><main className="dashboard-content" aria-busy={processing}><div className="dashboard-heading"><div><p className="kicker">Không gian / Tổng quan</p><h1>{profile ? `Xin chào, ${profile.displayName}` : "Tạo danh thiếp của bạn"}</h1><p>{profile ? "Quản lý danh thiếp số và danh bạ của bạn tại đây." : "Tạo hồ sơ cá nhân để bắt đầu sử dụng NovaCard."}</p></div></div><div className="dashboard-tabs" role="tablist"><button className={tab === "profile" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("profile")}><UserRound size={16} /> Hồ sơ của tôi</button><button className={tab === "scan" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("scan")}><ScanLine size={16} /> Quét danh thiếp</button><button className={tab === "contacts" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("contacts")}><FileText size={16} /> Danh bạ</button></div>{tab === "profile" && <><section className="dashboard-card-section"><div className="dashboard-section-heading"><div><p className="kicker">Card visit của bạn</p><h2>Danh thiếp số</h2><p>Đây là giao diện người khác nhìn thấy khi mở link hoặc quét mã QR.</p></div>{profile && <button className="secondary-button" onClick={() => setEditing(true)}>Chỉnh sửa thông tin</button>}</div>{profile && !editing ? <ProfileCard profile={profile} slug={profile.slug} /> : <section className="panel" id="profile-form"><div className="panel-heading"><div><h2><Plus size={18} /> {profile ? "Chỉnh sửa thông tin" : "Tạo hồ sơ mới"}</h2><p>Thông tin này sẽ được hiển thị trên card visit của bạn.</p></div></div><form onSubmit={saveProfile} className="profile-form"><label>Họ và tên<input name="displayName" defaultValue={profile?.displayName} placeholder="Nguyễn Văn Nova" required /></label><div className="form-two"><label>Chức danh<input name="title" defaultValue={profile?.title} placeholder="Giám đốc" /></label><label>Công ty / tổ chức<input name="organization" defaultValue={profile?.organization} placeholder="Novatech" /></label></div><div className="form-two"><label>Email<input name="email" type="email" defaultValue={profile?.email} placeholder="hello@company.com" /></label><label>Số điện thoại<input name="phone" defaultValue={profile?.phone} placeholder="+84…" /></label></div><label>Giới thiệu ngắn<input name="bio" defaultValue={profile?.bio} placeholder="Kết nối chuyên nghiệp…" /></label><label>Logo công ty<input type="file" accept="image/png,image/jpeg,image/svg+xml" disabled /><small className="form-help">Tính năng tải logo sẽ được bổ sung ở phiên bản tiếp theo.</small></label><button className="primary-cta" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thông tin"}<ArrowUpRight size={17} /></button>{message && <p className="form-message">{message}</p>}</form></section>}</section>{profile && <div className="dashboard-overview-metrics metric-grid"><div className="metric-card"><span className="metric-icon blue"><UserRound size={18} /></span><strong>1</strong><span>Hồ sơ đang hoạt động</span></div><div className="metric-card"><span className="metric-icon violet"><QrCode size={18} /></span><strong>0</strong><span>Lượt quét QR</span></div><div className="metric-card"><span className="metric-icon green"><FileText size={18} /></span><strong>{contacts.length}</strong><span>Liên hệ đã lưu</span></div></div>}</>}{tab === "scan" && <div className="dashboard-tab-content"><OcrPanel onSaved={(contact) => setContacts((items) => [contact, ...items])} onProcessingChange={setProcessing} /></div>}{tab === "contacts" && <section className="panel contacts-page"><div className="panel-heading"><div><p className="kicker">Danh bạ cá nhân</p><h2>Liên hệ đã lưu</h2><p>Các liên hệ được lưu từ những danh thiếp bạn đã quét.</p></div></div>{contacts.length ? contacts.map((contact) => <div className="profile-result" key={contact.id}><span className="result-avatar">{contact.displayName.slice(0, 1)}</span><div><strong>{contact.displayName}</strong><span>{[contact.title, contact.organization].filter(Boolean).join(" · ") || "Liên hệ mới"}</span>{(contact.email || contact.phone) && <small>{[contact.email, contact.phone].filter(Boolean).join(" · ")}</small>}</div><span className="contact-source">{contact.source === "ocr" ? "OCR" : "Đã lưu"}</span></div>) : <div className="empty-state"><UserRound size={28} /><strong>Chưa có liên hệ nào</strong><span>Scan danh thiếp để lưu thông tin liên hệ.</span></div>}</section>}</main>{processing && <div className="dashboard-processing-overlay" role="status"><div className="processing-spinner" /><strong>Đang xử lý danh thiếp…</strong><span>Vui lòng chờ, không đóng trang.</span></div>}</div>;
}
