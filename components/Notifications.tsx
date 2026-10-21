"use client";

import { useCallback, useEffect, useState } from "react";
import { Mark, api, toast } from "./ui";

type N = { id: number; title: string; body: string; duration_hours: number | null; created_at: string };
const DURATIONS = [["1", "1 час"], ["24", "24 часа"], ["168", "7 дней"], ["", "Пока не удалю"]];

function left(n: N) {
  if (n.duration_hours == null) return "бессрочно";
  const ms = new Date(n.created_at).getTime() + n.duration_hours * 3_600_000 - Date.now();
  if (ms <= 0) return "истекло";
  const h = Math.ceil(ms / 3_600_000);
  return h > 48 ? `ещё ${Math.ceil(h / 24)} дн.` : `ещё ${h} ч`;
}

export default function Notifications() {
  const [items, setItems] = useState<N[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dur, setDur] = useState("24");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems((await api("/api/admin/notifications")).notifications || []); }
    catch (e: any) { toast(e.message); setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api("/api/admin/notifications", "POST", { title: title.trim(), body, duration_hours: dur === "" ? null : Number(dur) });
      setTitle(""); setBody(""); toast("Уведомление отправлено"); load();
    } catch (e: any) { toast(e.message); }
    finally { setBusy(false); }
  }

  async function remove(id: number) {
    try { await api(`/api/admin/notifications/${id}`, "DELETE"); toast("Удалено"); load(); }
    catch (e: any) { toast(e.message); }
  }

  return (
    <div className="cols">
      <form className="card" onSubmit={create} style={{ gap: 14 }}>
        <h2 style={{ fontSize: 18 }}>Новое уведомление</h2>
        <div className="hint" style={{ marginTop: -6 }}>Покажется всем пользователям в приложении Ningbox.</div>
        <input className="input" placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" style={{ minHeight: 90, resize: "vertical" }} placeholder="Текст (необязательно)" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="row">
          {DURATIONS.map(([v, l]) => <button key={l} type="button" className="chip" aria-pressed={dur === v} onClick={() => setDur(v)}>{l}</button>)}
        </div>
        <button className="btn primary" disabled={busy || !title.trim()} style={{ alignSelf: "flex-start" }}>Отправить</button>
      </form>

      <section className="card">
        <div className="between"><h2 style={{ fontSize: 18 }}>Все уведомления</h2><span className="muted">{items?.length ?? ""}</span></div>
        {items === null && <div className="empty"><Mark h={14} eq on /></div>}
        {items?.length === 0 && <div className="empty">Уведомлений пока нет</div>}
        {items?.map((n) => (
          <div key={n.id} className="notif">
            <div className="t">
              <b>{n.title}</b>
              {n.body && <p>{n.body}</p>}
              <small>{new Date(n.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {left(n)}</small>
            </div>
            <button className="btn danger sm" onClick={() => remove(n.id)}>Удалить</button>
          </div>
        ))}
      </section>
    </div>
  );
}
