"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Check, Download, ExternalLink, FileText, Link2, Mail, MessageCircle, Phone, QrCode, Share2, UserPlus, Users } from "lucide-react";
import QRCode from "qrcode";

type Profile = Record<string, string>;

export default function ProfileCard({ profile, slug }: { profile: Profile; slug: string }) {
  const [tab, setTab] = useState<"profile" | "qr" | "social">("profile");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [shared, setShared] = useState(false);
  const profileUrl = typeof window !== "undefined" ? window.location.href : `/p/${slug}`;

  useEffect(() => {
    void QRCode.toDataURL(profileUrl, { width: 280, margin: 1, errorCorrectionLevel: "H" }).then(setQrDataUrl);
  }, [profileUrl]);

  const saveToAccount = async () => {
    const token = localStorage.getItem("novacard_token");
    if (!token) {
      window.location.href = `/auth?next=${encodeURIComponent(`/p/${slug}`)}`;
      return;
    }
    const response = await fetch("/api/contacts/from-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ slug }),
    });
    const body = await response.json();
    if (!response.ok) {
      setSaveMessage(body.error || "Không thể lưu liên hệ");
      return;
    }
    setSaved(true);
    setSaveMessage("Đã lưu vào danh bạ NovaCard");
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
    link.click();
  };

  const initials = profile.displayName.split(" ").slice(-2).map((part) => part[0]).join("").toUpperCase();
  const actionItems = [
    { href: profile.phone ? `tel:${profile.phone}` : "#", label: "GỌI ĐIỆN", icon: Phone, show: Boolean(profile.phone) },
    { href: profile.email ? `mailto:${profile.email}` : "#", label: "GỬI EMAIL", icon: Mail, show: Boolean(profile.email) },
    { href: "https://zalo.me", label: "NHẮN ZALO", icon: MessageCircle, show: true },
    { href: profile.website || "#", label: "XEM CATALOGUE", icon: FileText, show: Boolean(profile.website), external: true },
  ];

  return <main className="reference-profile-card">
    <header className="reference-brand"><img className="reference-logo" src="https://chatbot.novatechhp.vn/template-assets/CORPORATE_BASE/logo.png" alt="Novatech" /><div><strong>novatechhp.vn</strong><span className="reference-tagline">Giải pháp công nghệ và chuyển đổi số đồng hành cùng doanh nghiệp</span></div></header>
    <section className="reference-hero">
      <div className="reference-avatar">{initials}<span><Check size={13} strokeWidth={3} /></span></div>
      <div className="reference-identity"><h1>{profile.displayName}</h1><p>{profile.title || "Chức danh"}</p><small>{profile.organization || "Doanh nghiệp"}</small></div>
    </section>
    <section className="reference-actions">{actionItems.filter((item) => item.show).map(({ href, label, icon: Icon, external }) => <a key={label} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}><Icon size={16} /><span>{label}</span>{external && <ExternalLink size={11} />}</a>)}</section>
    <div className="reference-save-row"><a href={`/api/p/${encodeURIComponent(slug)}/vcard`}><Download size={16} /> LƯU DANH BẠ <small>File .vcf</small></a><button type="button" onClick={saveToAccount}><UserPlus size={16} /> {saved ? "ĐÃ LƯU" : "LƯU VÀO NOVACARD"}</button></div>
    {saveMessage && <p className="reference-save-message">{saveMessage}</p>}
    <section className="reference-section"><h2>HỒ SƠ CÁ NHÂN &amp; DOANH NGHIỆP</h2><a href={profile.website || "#"} target="_blank" rel="noreferrer"><Link2 size={16} /> PROFILE CÔNG TY <ExternalLink size={12} /></a><a href="#projects"><BriefcaseBusiness size={16} /> DỰ ÁN TIÊU BIỂU <ExternalLink size={12} /></a><a href="#social"><Users size={16} /> THÔNG TIN HỘI <ExternalLink size={12} /></a></section>
    <section className="reference-connect" id="social"><button type="button" onClick={() => setTab("qr")}><span>QUÉT MÃ QR KẾT NỐI</span>{qrDataUrl ? <img src={qrDataUrl} alt="Mã QR hồ sơ" /> : <QrCode size={60} />}</button></section>
    {tab === "qr" && <div className="reference-qr-panel"><img src={qrDataUrl} alt="Mã QR hồ sơ" /><p>Quét để mở hồ sơ này trên điện thoại</p><button type="button" onClick={downloadQr}>Tải ảnh QR</button></div>}
    <footer className="reference-footer"><span>© NovaCard · Novatech</span><button type="button" onClick={share}>{shared ? <Check size={13} /> : <Share2 size={13} />} {shared ? "Đã sao chép" : "Chia sẻ"}</button></footer>
  </main>;
}
