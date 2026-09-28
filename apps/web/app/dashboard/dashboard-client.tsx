"use client";

import { AlertCircle, ArrowUpRight, CheckCircle2, Clock, FileText, LogOut, Mail, Phone, Plus, QrCode, ScanLine, Search, Trash2, UserRound, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import OcrPanel from "./ocr-panel";
import NotificationsPanel from "./notifications-panel";
import ProfileCard from "../p/[slug]/profile-card";

type Profile = Record<string, string> & { id: string; slug: string };
type Contact = { id: string; displayName: string; title?: string; organization?: string; email?: string; phone?: string; website?: string; source?: string; createdAt?: string };
type SentRequest = { id: string; status: string; ownerSlug: string; ownerName: string; ownerTitle?: string; ownerOrganization?: string; ownerEmail?: string; ownerPhone?: string; createdAt?: string };
type ContactRow = { key: string; id: string; status: "saved" | "pending"; displayName: string; title?: string; organization?: string; email?: string; phone?: string; website?: string; createdAt?: string; deletable: boolean };
type CurrentUser = { id: string; email: string };

function addResourceFields(form: HTMLFormElement, profile: Profile | null) {
  if (form.dataset.resourceFields === "true") return;
  form.dataset.resourceFields = "true";
  const fields = [
    { name: "companyProfileUrl", label: "Profile công ty (URL hoặc PDF)", value: profile?.companyProfileUrl?.startsWith("http") ? profile.companyProfileUrl : "", placeholder: "Nhập URL hoặc chọn file PDF bên dưới" },
    { name: "companyProfileFile", label: "File profile công ty (PDF, tùy chọn)", value: "", placeholder: "Chọn PDF nếu không dùng URL", file: true },
    { name: "projectsUrl", label: "Dự án tiêu biểu (URL hoặc PDF)", value: profile?.projectsUrl?.startsWith("http") ? profile.projectsUrl : "", placeholder: "Nhập URL hoặc chọn file PDF bên dưới" },
    { name: "projectsFile", label: "File dự án tiêu biểu (PDF, tùy chọn)", value: "", placeholder: "Chọn PDF nếu không dùng URL", file: true },
    { name: "communityInfo", label: "Thông tin hội", value: profile?.communityInfo || "", placeholder: "Các hội, hiệp hội, cộng đồng hoặc hoạt động chuyên môn…", textarea: true },
    { name: "avatarFile", label: "Ảnh đại diện", value: "", placeholder: "JPG, PNG hoặc WEBP tối đa 10MB", file: true, image: true },
  ];
  const anchor = form.querySelector("button");
  if (!anchor) { delete form.dataset.resourceFields; return; }
  const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
  for (const field of fields) {
    const label = document.createElement("label");
    label.textContent = field.label;
    const input = field.textarea ? document.createElement("textarea") : document.createElement("input");
    input.name = field.name;
    input.placeholder = field.placeholder;
    input.value = field.value;
    if (field.file && input instanceof HTMLInputElement) {
      input.type = "file";
      input.accept = field.image ? "image/jpeg,image/png,image/webp" : "application/pdf";
    }
    if (field.textarea && input instanceof HTMLTextAreaElement) input.rows = 4;
    label.appendChild(input);
    form.insertBefore(label, anchor);
    inputs.set(field.name, input);
  }
  for (const [urlName, fileName] of [["companyProfileUrl", "companyProfileFile"], ["projectsUrl", "projectsFile"]]) {
    const urlInput = inputs.get(urlName);
    const fileInput = inputs.get(fileName);
    if (!(urlInput instanceof HTMLInputElement) || !(fileInput instanceof HTMLInputElement)) continue;
    urlInput.addEventListener("input", () => { if (urlInput.value.trim()) fileInput.value = ""; });
    fileInput.addEventListener("change", () => { if (fileInput.files?.length) urlInput.value = ""; });
  }
}

function readContact(contact: Record<string, unknown>): Contact {
  let fields: Record<string, string> = {};
  try { fields = typeof contact.notes === "string" ? JSON.parse(contact.notes) as Record<string, string> : {}; } catch { /* Keep basic legacy contacts usable. */ }
  return { id: String(contact.id), displayName: String(contact.displayName || ""), title: fields.title, organization: fields.organization, email: fields.email, phone: fields.phone, website: fields.website, source: String(contact.source || ""), createdAt: String(contact.createdAt || "") };
}

export default function DashboardClient() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [qrScans, setQrScans] = useState(0);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [contactSort, setContactSort] = useState<"newest" | "name">("newest");
  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(null);
  const [tab, setTab] = useState<"profile" | "scan" | "contacts">("profile");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("next");
    if (target?.startsWith("/")) setNext(target);
    if (params.get("reason") === "profile_required") setMessage("Tạo hồ sơ của bạn để có thể gửi yêu cầu kết nối. Sau khi tạo xong bạn sẽ được đưa lại trang hồ sơ cần kết nối.");
    setToken(localStorage.getItem("novacard_token"));
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".profile-form");
    if (form) addResourceFields(form, profile);
  }, [editing, profile, tab]);

  useEffect(() => {
    if (!authChecked) return;
    if (!token) { window.location.replace(next ? `/auth?next=${encodeURIComponent(next)}` : "/auth"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    void fetch("/api/auth/me", { headers }).then(async (response) => {
      if (!response.ok) { localStorage.removeItem("novacard_token"); window.location.replace(next ? `/auth?next=${encodeURIComponent(next)}` : "/auth"); return; }
      const me = await response.json();
      setUser(me.user);
      const [profiles, savedContacts, sent] = await Promise.all([fetch("/api/profiles", { headers }), fetch("/api/contacts", { headers }), fetch("/api/contact-requests/sent", { headers })]);
      if (profiles.ok) {
        const data = await profiles.json();
        const own = data.profiles?.[data.profiles.length - 1] || null;
        setProfile(own);
        if (own) {
          const qrResponse = await fetch(`/api/profiles/${encodeURIComponent(own.id)}/qr`, { headers });
          if (qrResponse.ok) {
            const qrs = (await qrResponse.json()).qrs as { scanCount?: number }[] | undefined;
            setQrScans((qrs || []).reduce((total, qr) => total + Number(qr.scanCount || 0), 0));
          }
        }
      }
      if (savedContacts.ok) { const data = await savedContacts.json(); setContacts((data.contacts || []).map(readContact)); }
      if (sent.ok) { const data = await sent.json(); setSentRequests(data.requests || []); }
    });
  }, [authChecked, token, next]);

  const reloadContacts = async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [saved, sent] = await Promise.all([fetch("/api/contacts", { headers }), fetch("/api/contact-requests/sent", { headers })]);
    if (saved.ok) setContacts(((await saved.json()).contacts || []).map(readContact));
    if (sent.ok) setSentRequests((await sent.json()).requests || []);
  };

  const deleteContact = async (contact: ContactRow) => {
    if (!token || !window.confirm(`Xóa liên hệ ${contact.displayName}?`)) return;
    const response = await fetch(`/api/contacts/${encodeURIComponent(contact.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) { setContacts((items) => items.filter((item) => item.id !== contact.id)); setSelectedContact(null); }
  };

  const savedNames = new Set(contacts.map((contact) => contact.displayName.trim().toLowerCase()));
  const contactRows: ContactRow[] = [
    ...contacts.map((contact) => ({ key: `saved-${contact.id}`, id: contact.id, status: "saved" as const, displayName: contact.displayName, title: contact.title, organization: contact.organization, email: contact.email, phone: contact.phone, website: contact.website, createdAt: contact.createdAt, deletable: true })),
    ...sentRequests
      .filter((request) => request.status === "pending" && !savedNames.has((request.ownerName || "").trim().toLowerCase()))
      .map((request) => ({ key: `pending-${request.id}`, id: request.id, status: "pending" as const, displayName: request.ownerName, title: request.ownerTitle, organization: request.ownerOrganization, email: request.ownerEmail, phone: request.ownerPhone, createdAt: request.createdAt, deletable: false })),
  ];
  const visibleContacts = contactRows
    .filter((contact) => `${contact.displayName} ${contact.title || ""} ${contact.organization || ""} ${contact.email || ""} ${contact.phone || ""}`.toLowerCase().includes(contactQuery.toLowerCase().trim()))
    .sort((a, b) => contactSort === "name" ? a.displayName.localeCompare(b.displayName, "vi") : String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const formData = (form: HTMLFormElement) => Object.fromEntries(["displayName", "title", "organization", "email", "phone", "bio", "website", "avatarUrl", "companyProfileUrl", "projectsUrl", "communityInfo"].map((key) => [key, String(new FormData(form).get(key) || "")])) as Record<string, string>;
  const readFile = (file: File, type: "pdf" | "image") => new Promise<string>((resolve, reject) => {
    const valid = type === "pdf" ? file.type === "application/pdf" : ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!valid) return reject(new Error(type === "pdf" ? "Chỉ nhận file PDF" : "Chỉ nhận ảnh JPG, PNG hoặc WEBP"));
    if (file.size > (type === "pdf" ? 8 : 10) * 1024 * 1024) return reject(new Error(`File ${type === "pdf" ? "PDF" : "ảnh"} vượt quá dung lượng cho phép`));
    const reader = new FileReader();
    reader.onload = () => {
      if (type === "pdf") { resolve(String(reader.result)); return; }
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) { reject(new Error("Không thể xử lý ảnh")); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.78);
        if (compressed.length > 1_500_000) { reject(new Error("Ảnh đại diện vẫn quá lớn sau khi nén. Hãy chọn ảnh nhỏ hơn.")); return; }
        resolve(compressed);
      };
      image.onerror = () => reject(new Error("Không thể đọc ảnh"));
      image.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("Không thể đọc file"));
    reader.readAsDataURL(file);
  });
  const readPdf = (file: File) => readFile(file, "pdf");

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const values = formData(event.currentTarget);
    values.companyProfileUrl = values.companyProfileUrl || profile?.companyProfileUrl || "";
    values.projectsUrl = values.projectsUrl || profile?.projectsUrl || "";
    values.avatarUrl = values.avatarUrl || profile?.avatarUrl || "";
    const companyProfileFile = (event.currentTarget.elements.namedItem("companyProfileFile") as HTMLInputElement | null)?.files?.[0];
    const projectsFile = (event.currentTarget.elements.namedItem("projectsFile") as HTMLInputElement | null)?.files?.[0];
    const avatarFile = (event.currentTarget.elements.namedItem("avatarFile") as HTMLInputElement | null)?.files?.[0];
    try {
      if (companyProfileFile) values.companyProfileUrl = await readPdf(companyProfileFile);
      if (projectsFile) values.projectsUrl = await readPdf(projectsFile);
      if (avatarFile) values.avatarUrl = await readFile(avatarFile, "image");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đọc file");
      return;
    }
    const requiredFields: Record<string, string> = { displayName: "họ và tên", title: "chức danh", organization: "công ty / tổ chức", email: "email", phone: "số điện thoại", bio: "giới thiệu ngắn" };
    const missingFields = Object.entries(requiredFields).filter(([field]) => !values[field]?.trim()).map(([, label]) => label);
    if (missingFields.length) { setMessage(`Vui lòng bổ sung: ${missingFields.join(", ")}.`); return; }
    setBusy(true);
    try {
      const response = await fetch(profile ? `/api/profiles/${profile.id}` : "/api/profiles", { method: profile ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify(values) });
      const rawResult = await response.text();
      let result: { profile?: Profile; error?: string };
      try { result = JSON.parse(rawResult) as { profile?: Profile; error?: string }; }
      catch { throw new Error(response.status === 413 ? "Dữ liệu quá lớn. Hãy chọn ảnh nhỏ hơn hoặc bỏ bớt file PDF." : `Máy chủ trả về HTTP ${response.status}. Vui lòng tải lại trang rồi thử lại.`); }
      if (!response.ok) throw new Error(result.error || "Không thể lưu hồ sơ");
      if (!result.profile) throw new Error("Máy chủ không trả về hồ sơ đã lưu");
      setProfile(result.profile);
      setEditing(false);
      setMessage("Đã lưu thông tin hồ sơ.");
      if (!profile && next) { window.location.href = next; return; }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu hồ sơ");
    } finally {
      setBusy(false);
    }
  };

  return <div className="dashboard-shell">
    <header className="dashboard-top">
      <a className="brand" href="/dashboard"><img className="brand-logo" src="https://chatbot.novatechhp.vn/template-assets/CORPORATE_BASE/logo.png" alt="Novatech" />NovaCard</a>
      <div className="top-actions">
        <span className="user-pill"><UserRound size={15} /> {user?.email || "Tài khoản cá nhân"}</span>
        <button className="ghost-button" onClick={() => { localStorage.removeItem("novacard_token"); window.location.href = "/auth"; }}><LogOut size={15} /> Đăng xuất</button>
        {token && <NotificationsPanel token={token} onContactsChanged={reloadContacts} />}
      </div>
    </header>
    <main className="dashboard-content" aria-busy={processing}>
      <div className="dashboard-heading">
        <div>
          <p className="kicker">Không gian / Tổng quan</p>
          <h1>{profile ? `Xin chào, ${profile.displayName}` : "Tạo danh thiếp của bạn"}</h1>
          <p>{profile ? "Quản lý danh thiếp số và danh bạ của bạn tại đây." : "Tạo hồ sơ cá nhân để bắt đầu sử dụng NovaCard."}</p>
        </div>
      </div>
      {next && !profile && <div className="dashboard-callout" role="status">
        <AlertCircle size={18} />
        <div>
          <strong>Bạn chưa có hồ sơ NovaCard</strong>
          <span>Yêu cầu kết nối cần một hồ sơ để chủ hồ sơ biết bạn là ai. Điền thông tin bên dưới, sau đó bạn sẽ được đưa lại trang hồ sơ cần kết nối.</span>
        </div>
        <a className="secondary-button" href={next}>Bỏ qua, quay lại hồ sơ</a>
      </div>}
      <div className="dashboard-tabs" role="tablist">
        <button className={tab === "profile" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("profile")}><UserRound size={16} /> Hồ sơ của tôi</button>
        <button className={tab === "scan" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("scan")}><ScanLine size={16} /> Quét danh thiếp</button>
        <button className={tab === "contacts" ? "dashboard-tab active" : "dashboard-tab"} onClick={() => setTab("contacts")}><FileText size={16} /> Danh bạ</button>
      </div>

      {tab === "profile" && <>
        <section className="dashboard-card-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="kicker">Card visit của bạn</p>
              <h2>Danh thiếp số</h2>
              <p>Đây là giao diện người khác nhìn thấy khi mở link hoặc quét mã QR.</p>
            </div>
            {profile && <button className="secondary-button" onClick={() => setEditing(true)}>Chỉnh sửa thông tin</button>}
          </div>
          {profile && !editing ? <ProfileCard profile={profile} slug={profile.slug} isOwnProfile /> : <section className="panel" id="profile-form">
            <div className="panel-heading">
              <div>
                <h2><Plus size={18} /> {profile ? "Chỉnh sửa thông tin" : "Tạo hồ sơ mới"}</h2>
                <p>Thông tin này sẽ được hiển thị trên card visit của bạn.</p>
              </div>
            </div>
            <form onSubmit={saveProfile} className="profile-form">
              <label>Họ và tên<input name="displayName" defaultValue={profile?.displayName} placeholder="Nguyễn Văn Nova" required /></label>
              <div className="form-two">
                <label>Chức danh<input name="title" defaultValue={profile?.title} placeholder="Giám đốc" /></label>
                <label>Công ty / tổ chức<input name="organization" defaultValue={profile?.organization} placeholder="Novatech" /></label>
              </div>
              <div className="form-two">
                <label>Email<input name="email" type="email" defaultValue={profile?.email} placeholder="hello@company.com" /></label>
                <label>Số điện thoại<input name="phone" defaultValue={profile?.phone} placeholder="+84…" /></label>
              </div>
              <label>Website<input name="website" defaultValue={profile?.website} placeholder="https://congty.vn" /></label>
              <label>Giới thiệu ngắn<input name="bio" defaultValue={profile?.bio} placeholder="Kết nối chuyên nghiệp…" /></label>
              <label>Logo công ty<input type="file" accept="image/png,image/jpeg,image/svg+xml" disabled /><small className="form-help">Tính năng tải logo sẽ được bổ sung ở phiên bản tiếp theo.</small></label>
              <button className="primary-cta" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thông tin"}<ArrowUpRight size={17} /></button>
              {message && <p className="form-message">{message}</p>}
            </form>
          </section>}
        </section>
        {profile && <div className="dashboard-overview-metrics metric-grid">
          <div className="metric-card"><span className="metric-icon blue"><UserRound size={18} /></span><strong>1</strong><span>Hồ sơ đang hoạt động</span></div>
          <div className="metric-card"><span className="metric-icon violet"><QrCode size={18} /></span><strong>{qrScans}</strong><span>Lượt quét QR</span></div>
          <div className="metric-card"><span className="metric-icon green"><FileText size={18} /></span><strong>{contacts.length}</strong><span>Liên hệ đã lưu</span></div>
        </div>}
      </>}

      {tab === "scan" && <div className="dashboard-tab-content"><OcrPanel onSaved={reloadContacts} onProcessingChange={setProcessing} /></div>}

      {tab === "contacts" && <section className="panel contacts-page">
        <div className="panel-heading">
          <div>
            <p className="kicker">Danh bạ cá nhân</p>
            <h2>Liên hệ</h2>
            <p>Quản lý liên hệ đã lưu và các yêu cầu đang chờ phản hồi.</p>
          </div>
        </div>
        <div className="contacts-toolbar">
          <label className="contacts-search"><Search size={15} /><input value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder="Tìm theo tên, công ty, email…" /></label>
          <select value={contactSort} onChange={(event) => setContactSort(event.target.value as "newest" | "name")} aria-label="Sắp xếp danh bạ">
            <option value="newest">Mới nhất</option>
            <option value="name">Tên A-Z</option>
          </select>
        </div>
        {visibleContacts.length ? <div className="contacts-list">
          {visibleContacts.map((contact) => <button type="button" className="contact-row" key={contact.key} onClick={() => setSelectedContact(contact)}>
            <span className="result-avatar">{contact.displayName.slice(0, 1)}</span>
            <span className="contact-row-main">
              <strong>{contact.displayName}</strong>
              <small>{[contact.title, contact.organization].filter(Boolean).join(" · ") || "Liên hệ mới"}</small>
            </span>
            <span className={`contact-status ${contact.status}`} title={contact.status === "saved" ? "Đã lưu" : "Chờ phản hồi"} aria-label={contact.status === "saved" ? "Đã lưu" : "Chờ phản hồi"}>
              {contact.status === "saved" ? <CheckCircle2 size={16} /> : <Clock size={16} />}
            </span>
          </button>)}
        </div> : <div className="empty-state"><UserRound size={28} /><strong>Không có liên hệ phù hợp</strong><span>Thử từ khóa khác hoặc scan danh thiếp để lưu liên hệ.</span></div>}
      </section>}
    </main>

    {selectedContact && <div className="contact-detail-backdrop" role="presentation" onClick={() => setSelectedContact(null)}>
      <div className="contact-detail" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="contact-detail-head">
          <span className="result-avatar">{selectedContact.displayName.slice(0, 1)}</span>
          <div>
            <strong>{selectedContact.displayName}</strong>
            <span>{[selectedContact.title, selectedContact.organization].filter(Boolean).join(" · ") || "Liên hệ"}</span>
          </div>
          <span className={`contact-status ${selectedContact.status}`} title={selectedContact.status === "saved" ? "Đã lưu" : "Chờ phản hồi"}>{selectedContact.status === "saved" ? <CheckCircle2 size={16} /> : <Clock size={16} />}</span>
        </div>
        <dl className="contact-detail-info">
          <div><dt>Email</dt><dd>{selectedContact.email || (selectedContact.status === "pending" ? "Ẩn đến khi được chấp nhận" : "Chưa cập nhật")}</dd></div>
          <div><dt>Điện thoại</dt><dd>{selectedContact.phone || (selectedContact.status === "pending" ? "Ẩn đến khi được chấp nhận" : "Chưa cập nhật")}</dd></div>
          <div><dt>Website</dt><dd>{selectedContact.website || "Chưa cập nhật"}</dd></div>
          <div><dt>Trạng thái</dt><dd>{selectedContact.status === "saved" ? "Đã lưu vào danh bạ" : "Đã gửi yêu cầu, chờ phản hồi"}</dd></div>
        </dl>
        <div className="contact-detail-actions">
          {selectedContact.phone && <a className="secondary-button" href={`tel:${selectedContact.phone}`}><Phone size={15} /> Gọi</a>}
          {selectedContact.email && <a className="secondary-button" href={`mailto:${selectedContact.email}`}><Mail size={15} /> Email</a>}
          {selectedContact.deletable && <button type="button" className="danger-button" onClick={() => void deleteContact(selectedContact)}><Trash2 size={15} /> Xóa</button>}
          <button type="button" className="ghost-button" onClick={() => setSelectedContact(null)}><XCircle size={15} /> Đóng</button>
        </div>
      </div>
    </div>}

    {processing && <div className="dashboard-processing-overlay" role="status"><div className="processing-spinner" /><strong>Đang xử lý danh thiếp…</strong><span>Vui lòng chờ, không đóng trang.</span></div>}
  </div>;
}
