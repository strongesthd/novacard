"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Request = { id: string; status: string; requesterName: string; requesterTitle?: string; requesterOrganization?: string; ownerName: string };

export default function ConnectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<Request | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/contact-requests/${encodeURIComponent(params.id)}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) { setMessage(body.error || "Không tìm thấy yêu cầu kết nối"); return; }
      setRequest(body.request);
    });
  }, [params.id]);

  const respond = async (action: "accept" | "reject") => {
    const token = localStorage.getItem("novacard_token");
    if (!token) { router.push(`/auth?next=${encodeURIComponent(`/connect/${params.id}`)}`); return; }
    setBusy(true);
    const response = await fetch(`/api/contact-requests/${encodeURIComponent(params.id)}/${action}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage(body.error || "Không thể xử lý yêu cầu"); return; }
    setRequest((prev) => (prev ? { ...prev, status: action === "accept" ? "accepted" : "rejected" } : prev));
    setMessage(action === "accept" ? "Đã chấp nhận. Người gửi sẽ nhận thông báo và xem được thông tin liên hệ của bạn." : "Đã từ chối yêu cầu kết nối.");
  };

  return <main className="connect-shell"><section className="connect-card">
    <h1>Yêu cầu kết nối danh bạ</h1>
    {request && <div className="connect-person"><span className="result-avatar">{request.requesterName.slice(0, 1)}</span><div><strong>{request.requesterName}</strong><span>{[request.requesterTitle, request.requesterOrganization].filter(Boolean).join(" · ") || "muốn kết nối với bạn"}</span></div></div>}
    <p>{request ? `${request.requesterName} muốn lưu thông tin liên hệ của bạn vào danh bạ NovaCard.` : "Đang tải thông tin yêu cầu…"}</p>
    {request && request.status === "pending" && <div className="connect-actions"><button type="button" className="primary-cta" onClick={() => respond("accept")} disabled={busy}><Check size={16} /> Chấp nhận</button><button type="button" className="secondary-button" onClick={() => respond("reject")} disabled={busy}><X size={16} /> Từ chối</button></div>}
    {request && request.status === "accepted" && <p>Yêu cầu này đã được chấp nhận.</p>}
    {request && request.status === "rejected" && <p>Yêu cầu này đã bị từ chối.</p>}
    {message && <p className="form-message">{message}</p>}
  </section></main>;
}
