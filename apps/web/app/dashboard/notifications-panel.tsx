"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";

type Notification = { id: string; type: string; title: string; message: string; read: boolean; createdAt: string };
type ContactRequest = { id: string; status: string; requesterName: string; requesterEmail?: string; createdAt: string };

export default function NotificationsPanel({ token, onContactsChanged }: { token: string; onContactsChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const [notes, reqs] = await Promise.all([fetch("/api/notifications", { headers }), fetch("/api/contact-requests", { headers })]);
    if (notes.ok) setItems((await notes.json()).notifications || []);
    if (reqs.ok) setRequests((await reqs.json()).requests || []);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const unread = items.filter((item) => !item.read).length;
  const pending = requests.filter((request) => request.status === "pending");

  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) { await fetch("/api/notifications/read", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); setItems((prev) => prev.map((item) => ({ ...item, read: true }))); }
  };

  const respond = async (id: string, action: "accept" | "reject") => {
    if (respondingId) return;
    setRespondingId(id); setError("");
    try {
      const response = await fetch(`/api/contact-requests/${encodeURIComponent(id)}/${action}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(body.error || "Không thể xử lý yêu cầu kết nối"); return; }
      setRequests((prev) => prev.filter((request) => request.id !== id));
      if (action === "accept") onContactsChanged();
      await load();
    } catch { setError("Không thể kết nối đến máy chủ"); } finally { setRespondingId(null); }
  };

  return <div className="notifications">
    <button type="button" className="notification-trigger" onClick={openPanel} aria-expanded={open} aria-label="Thông báo">
      <Bell size={18} />
      {unread + pending.length > 0 && <span className="notification-badge">{unread + pending.length}</span>}
    </button>
    {open && <div className="notification-popover">
      <div className="notification-head"><strong>Yêu cầu kết nối</strong><button type="button" onClick={() => setOpen(false)} aria-label="Đóng"><X size={15} /></button></div>
      {error && <p className="notification-error" role="alert">{error}</p>}
      {pending.length > 0 && <div className="notification-section">
        {pending.map((request) => <div className="notification-row" key={request.id}>
          <div><strong>{request.requesterName}</strong><span>{request.requesterEmail || "muốn kết nối với bạn"}</span></div>
          <div className="notification-actions">
            <button type="button" className="accept" onClick={() => void respond(request.id, "accept")} disabled={respondingId !== null} aria-label="Chấp nhận"><Check size={15} /></button>
            <button type="button" className="reject" onClick={() => void respond(request.id, "reject")} disabled={respondingId !== null} aria-label="Từ chối"><X size={15} /></button>
          </div>
        </div>)}
      </div>}
      {items.length > 0 && <div className="notification-section">
        {items.slice(0, 10).map((item) => <div className={`notification-item${item.read ? "" : " unread"}`} key={item.id}>
          <strong>{item.title}</strong><span>{item.message}</span>
        </div>)}
      </div>}
      {pending.length === 0 && items.length === 0 && <p className="notification-empty">Chưa có thông báo nào.</p>}
    </div>}
  </div>;
}
