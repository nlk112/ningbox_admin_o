"use client";

import { useMemo, useState } from "react";
import { Client, ago, via, happLink, daysLeft, fmtBytes, fmtDate, fmtPhone, isUnlimited, nameOf, phoneDigits, usage } from "@/lib/clients";
import { Icon, LimitBar, api, copy, toast } from "./ui";

const FILTERS = {
  all: { label: "Все", fn: () => true },
  online: { label: "Онлайн", fn: (c: Client) => c.online },
  off: { label: "Выключены", fn: (c: Client) => !c.is_active },
  soon: { label: "Срок ≤ 7 дн.", fn: (c: Client) => daysLeft(c) <= 7 },
  limit: { label: "Лимит ≥ 80%", fn: (c: Client) => usage(c) >= 0.8 },
} as const;
type F = keyof typeof FILTERS;

function Expiry({ c }: { c: Client }) {
  const d = daysLeft(c);
  if (d === Infinity) return <span className="muted">бессрочно</span>;
  if (d < 0) return <span className="t-err">истёк {fmtDate(c.expires_at)}</span>;
  if (d <= 7) return <span className="t-info">{d < 1 ? "сегодня" : `${Math.ceil(d)} дн.`}</span>;
  return <span>до {fmtDate(c.expires_at)}</span>;
}

function LimitText({ c }: { c: Client }) {
  if (isUnlimited(c)) return <span>{fmtBytes(c.used)} · без лимита</span>;
  const p = usage(c);
  return (
    <span>
      {fmtBytes(c.used)} из {fmtBytes(c.traffic_limit_bytes!)}{" "}
      {p >= 0.8 && <span className={p >= 1 ? "t-err" : "t-warn"}>{Math.round(p * 100)}%</span>}
    </span>
  );
}

function Status({ c }: { c: Client }) {
  if (!c.is_active) return <span className="tag err">выключен</span>;
  const v = via(c);
  return (
    <span className="status">
      <span className={`dot${c.online ? " on" : ""}`} />
      {ago(c.last_seen_at)}
      {v && <span className="via">{v}</span>}
    </span>
  );
}

export default function Clients({ clients, open, reload }: { clients: Client[]; open: (c: Client) => void; reload: () => Promise<void> }) {
  const plain = clients.filter((c) => c.sub_url && !c.sub_crypt).length;
  const [crypting, setCrypting] = useState(false);
  async function cryptAll() {
    setCrypting(true);
    try {
      let left = plain;
      while (left > 0) {
        const r = await api("/api/admin/clients/crypt-all", "POST");
        if (r.failed) throw new Error(r.error || "ошибка генерации");
        if (!r.ok) break;
        left -= r.ok;
      }
      toast("Криптоссылки готовы");
    } catch (e: any) {
      toast(e.message);
    } finally {
      setCrypting(false);
      reload();
    }
  }
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("all");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const d = phoneDigits(s);
    return clients.filter(
      (c) =>
        FILTERS[f].fn(c) &&
        (!s || nameOf(c).toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || (d.length >= 3 && phoneDigits(c.phone || c.username || "").includes(d)))
    );
  }, [clients, q, f]);

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <span className="muted" style={{ display: "flex" }}><Icon name="search" size={16} /></span>
          <input type="search" placeholder="Имя или номер" aria-label="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {plain > 0 && <button className="btn soft sm" disabled={crypting} onClick={cryptAll}>{crypting ? "Шифрую…" : `🔐 Криптоссылки (${plain})`}</button>}
        <div className="pills" role="group" aria-label="Фильтр">
          {(Object.keys(FILTERS) as F[]).map((k) => (
            <button key={k} className="pill" aria-pressed={f === k} onClick={() => setF(k)}>
              {FILTERS[k].label} {clients.filter(FILTERS[k].fn).length}
            </button>
          ))}
        </div>
      </div>

      <div className="card table-wrap" style={{ padding: "16px 6px 6px" }}>
        <table className="table">
          <thead>
            <tr><th>Клиент</th><th>Статус</th><th>↓ / ↑</th><th>Лимит</th><th>Срок</th><th aria-label="Ссылка" /></tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className={c.is_active ? "" : "off"} onClick={() => open(c)}>
                <td className="who"><b>{nameOf(c)}</b><span>{fmtPhone(c.phone) || c.email}</span></td>
                <td><Status c={c} /></td>
                <td style={{ whiteSpace: "nowrap", color: "var(--soft)" }}>{fmtBytes(c.down)} / {fmtBytes(c.up)}</td>
                <td><div className="lim"><LimitText c={c} /><LimitBar c={c} thin /></div></td>
                <td style={{ whiteSpace: "nowrap" }}><Expiry c={c} /></td>
                <td style={{ textAlign: "right" }}>
                  {c.sub_url && (
                    <button className="icon-btn" title="Копировать ссылку Happ" aria-label="Копировать ссылку Happ" onClick={(e) => { e.stopPropagation(); copy(happLink(c)!, "Ссылка Happ скопирована"); }}>
                      <Icon name="copy" size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <div className="empty">{clients.length ? "Никого не нашлось" : "Клиентов пока нет"}</div>}
      </div>

      <div className="mcards">
        {list.map((c) => (
          <button key={c.id} className={`mcard${c.is_active ? "" : " off"}`} onClick={() => open(c)}>
            <div className="top">
              {c.is_active ? <span className={`dot${c.online ? " on" : ""}`} /> : <span className="tag err">выкл</span>}
              <b>{nameOf(c)}</b>
              <span style={{ fontSize: 13 }}><Expiry c={c} /></span>
            </div>
            <div className="hint">{fmtPhone(c.phone) || c.email} · <LimitText c={c} /></div>
            <LimitBar c={c} thin />
          </button>
        ))}
        {!list.length && <div className="empty">{clients.length ? "Никого не нашлось" : "Клиентов пока нет"}</div>}
      </div>
    </>
  );
}
