"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Check, Download, ExternalLink, FileText, Link2, Mail, MessageCircle, Phone, QrCode, Share2, UserPlus, Users } from "lucide-react";
import QRCode from "qrcode";

type Profile = Record<string, string>;

type Viewer = { authenticated: boolean; hasProfile: boolean; ownSlug: string | null; loading: boolean };
type StoredQr = { targetUrl: string; url?: string; revokedAt?: string };

export default function ProfileCard({ profile, slug, isOwnProfile = false }: { profile: Profile; slug: string; isOwnProfile?: boolean }) {
  const [tab, setTab] = useState<"profile" | "qr" | "social">("profile");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [shared, setShared] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [viewer, setViewer] = useState<Viewer>({ authenticated: isOwnProfile, hasProfile: isOwnProfile, ownSlug: isOwnProfile ? slug : null, loading: !isOwnProfile });
  // The card is also rendered inside /dashboard. Always encode the public
  // profile route so a QR created there never points back to the dashboard.
  const profilePath = `/p/${encodeURIComponent(slug)}`;
  // Prefer the canonical public origin so a QR printed from a preview or
  // internal host still resolves to the production profile route.
  const configuredOrigin = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  const [origin, setOrigin] = useState(configuredOrigin);
  const [qrTarget, setQrTarget] = useState("");
  const profileUrl = origin ? `${origin}${profilePath}` : profilePath;
  const qrValue = qrTarget || profileUrl;

  useEffect(() => {
    if (!configuredOrigin && typeof window !== "undefined") setOrigin(window.location.origin);
  }, [configuredOrigin]);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(qrValue, { width: 280, margin: 1, errorCorrectionLevel: "H" }).then((url) => { if (active) setQrDataUrl(url); });
    return () => { active = false; };
  }, [qrValue]);

  useEffect(() => {
    if (isOwnProfile) return;
    const token = localStorage.getItem("novacard_token");
    if (!token) {
      setViewer((current) => ({ ...current, loading: false }));
      return;
    }
    let active = true;
    if (new URLSearchParams(window.location.search).get("connected") === "1") setSaveMessage("Hồ sơ đã sẵn sàng. Bạn có thể gửi yêu cầu kết nối từ hồ sơ đối tác.");
    void fetch("/api/profiles", { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 401) localStorage.removeItem("novacard_token");
        if (active) setViewer({ authenticated: false, hasProfile: false, ownSlug: null, loading: false });
        return;
      }
      const own = (await response.json()).profiles as { id: string; slug: string }[] | undefined;
      if (active) setViewer({ authenticated: true, hasProfile: Boolean(own?.length), ownSlug: own?.find((candidate) => candidate.slug === slug)?.slug ?? null, loading: false });
      const ownProfile = own?.find((candidate) => candidate.slug === slug);
      if (ownProfile) {
        const qrResponse = await fetch(`/api/profiles/${encodeURIComponent(ownProfile.id)}/qr`, { headers: { Authorization: `Bearer ${token}` } });
        if (qrResponse.ok) {
          const qrs = (await qrResponse.json()).qrs as StoredQr[] | undefined;
          const activeQr = qrs?.find((candidate) => !candidate.revokedAt);
          if (activeQr?.url) setQrTarget(activeQr.url);
          else {
            const created = await fetch(`/api/profiles/${encodeURIComponent(ownProfile.id)}/qr`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ label: "Hồ sơ cá nhân" }) });
            if (created.ok) setQrTarget(((await created.json()).qr as StoredQr).url || "");
          }
        }
      }
    }).catch(() => {
      if (active) setViewer((current) => ({ ...current, loading: false }));
    });
    return () => { active = false; };
  }, [isOwnProfile, slug]);

  const isOwner = viewer.ownSlug === slug;
  const connectHref = !viewer.authenticated ? `/auth?next=${encodeURIComponent(profilePath)}` : `/dashboard?next=${encodeURIComponent(profilePath)}`;

  const requestConnection = async () => {
    const token = localStorage.getItem("novacard_token");
    if (!token) {
      window.location.href = `/auth?next=${encodeURIComponent(profilePath)}`;
      return;
    }
    setRequesting(true);
    try {
      const response = await fetch("/api/contact-requests", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ slug }) });
      const body = await response.json();
      if (response.status === 401) { localStorage.removeItem("novacard_token"); window.location.href = `/auth?next=${encodeURIComponent(profilePath)}`; return; }
      if (response.ok) { setSaveMessage("Đã gửi yêu cầu. Chủ hồ sơ cần chấp nhận trước khi contact được lưu."); return; }
      if (body.code === "profile_required") { window.location.href = `/dashboard?next=${encodeURIComponent(profilePath)}&reason=profile_required`; return; }
      if (body.code === "self_request") { setSaveMessage("Đây là hồ sơ của chính bạn."); return; }
      setSaveMessage(body.error || "Không thể gửi yêu cầu kết nối");
    } catch { setSaveMessage("Không thể kết nối đến máy chủ"); } finally { setRequesting(false); }
  };

  const share = async () => {
    if (navigator.share) await navigator.share({ title: profile.displayName, url: profileUrl });
    else await navigator.clipboard.writeText(profileUrl);
    setShared(true);
    window.setTimeout(() => setShared(false), 1800);
  };

  const downloadQr = async () => {
    const dataUrl = await QRCode.toDataURL(profileUrl, { width: 900, margin: 3, errorCorrectionLevel: "H" });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${slug}-ma-qr.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const initials = profile.displayName.split(" ").slice(-2).map((part) => part[0]).join("").toUpperCase();
  const actionItems = [
    { href: profile.phone ? `tel:${profile.phone}` : "#", label: "GỌI ĐIỆN", icon: Phone, show: Boolean(profile.phone) },
    { href: profile.email ? `mailto:${profile.email}` : "#", label: "GỬI EMAIL", icon: Mail, show: Boolean(profile.email) },
    { href: "https://zalo.me", label: "NHẮN ZALO", icon: MessageCircle, show: true },
    { href: profile.website || "#", label: "XEM CATALOGUE", icon: FileText, show: Boolean(profile.website), external: true },
  ];

  const connectAction = viewer.loading
    ? <span className="reference-save-hint">Đang kiểm tra hồ sơ</span>
    : isOwner
      ? <span className="reference-save-hint">Đây là hồ sơ của bạn</span>
      : !viewer.authenticated
        ? <a className="reference-save-cta" href={connectHref}><UserPlus size={16} /> ĐĂNG NHẬP ĐỂ KẾT NỐI<small>Đăng nhập NovaCard trước</small></a>
        : !viewer.hasProfile
          ? <a className="reference-save-cta" href={connectHref}><UserPlus size={16} /> TẠO HỒ SƠ ĐỂ KẾT NỐI<small>Bắt buộc có hồ sơ</small></a>
          : <button type="button" onClick={requestConnection} disabled={requesting}><UserPlus size={16} /> {requesting ? "ĐANG GỬI" : "LƯU VÀO NOVACARD"}<small>Gửi yêu cầu kết nối</small></button>;

  return <main className="reference-profile-card">
    <header className="reference-brand"><img className="reference-logo" src="https://chatbot.novatechhp.vn/template-assets/CORPORATE_BASE/logo.png" alt="Novatech" /><div><strong>novatechhp.vn</strong><span className="reference-tagline">Giải pháp công nghệ và chuyển đổi số đồng hành cùng doanh nghiệp</span></div></header>
    <section className="reference-hero">
      <div className="reference-avatar">{initials}<span><Check size={13} strokeWidth={3} /></span></div>
      <div className="reference-identity"><h1>{profile.displayName}</h1><p>{profile.title || "Chức danh"}</p><small>{profile.organization || "Doanh nghiệp"}</small></div>
    </section>
    <section className="reference-actions">{actionItems.filter((item) => item.show).map(({ href, label, icon: Icon, external }) => <a key={label} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}><Icon size={16} /><span>{label}</span>{external && <ExternalLink size={11} />}</a>)}</section>
    <div className="reference-save-row"><a href={`/api/p/${encodeURIComponent(slug)}/vcard`}><Download size={16} /> LƯU DANH BẠ <small>File .vcf</small></a>{connectAction}</div>
    {saveMessage && <p className="reference-save-message">{saveMessage}</p>}
    <section className="reference-section"><h2>HỒ SƠ CÁ NHÂN &amp; DOANH NGHIỆP</h2><a href={profile.website || "#"} target="_blank" rel="noreferrer"><Link2 size={16} /> PROFILE CÔNG TY <ExternalLink size={12} /></a><a href="#projects"><BriefcaseBusiness size={16} /> DỰ ÁN TIÊU BIỂU <ExternalLink size={12} /></a><a href="#social"><Users size={16} /> THÔNG TIN HỘI <ExternalLink size={12} /></a></section>
    <section className="reference-connect" id="social"><button type="button" onClick={() => setTab("qr")}><span>QUÉT MÃ QR KẾT NỐI</span>{qrDataUrl ? <img src={qrDataUrl} alt="Mã QR hồ sơ" /> : <QrCode size={60} />}</button></section>
    {tab === "qr" && <div className="reference-qr-panel"><img src={qrDataUrl} alt="Mã QR hồ sơ" /><p>Quét để mở hồ sơ này trên điện thoại</p><button type="button" onClick={downloadQr}>Tải ảnh QR</button></div>}
    <footer className="reference-footer"><span>© NovaCard · Novatech</span><button type="button" onClick={share}>{shared ? <Check size={13} /> : <Share2 size={13} />} {shared ? "Đã sao chép" : "Chia sẻ"}</button></footer>
  </main>;
}
