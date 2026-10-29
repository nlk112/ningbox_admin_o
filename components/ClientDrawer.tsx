"use client";

import { useCallback, useEffect, useState } from "react";
import { Client, GB, UNLIMITED, ago, via, daysLeft, fmtBytes, fmtDate, fmtPhone, isUnlimited, nameOf, usage } from "@/lib/clients";
import { Icon, LimitBar, Mark, Qr, api, copy, toast, useEsc } from "./ui";

export default function ClientDrawer({ c, onClose, reload }: { c: Client; onClose: () => void; reload: () => Promise<void> }) {
  const [tab, setTab] = useState<"manage" | "logs">("manage");
  useEsc(onClose);
  const pct = usage(c);

  return (
    <div className="backdrop" onClick={onClose}>
      <aside className="drawer" aria-label="Карточка клиента" onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="avatar">{nameOf(c)[0]?.toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Name c={c} reload={reload} />
            <div style={{ color: "var(--soft)", marginTop: 2 }}>{fmtPhone(c.phone) || c.email} · создан {fmtDate(c.created_at)}</div>
            <span className="status" style={{ marginTop: 8 }}>
              <span className={`dot${c.online ? " on" : ""}`} />
              {ago(c.last_seen_at)}{via(c) && ` · ${via(c)}`} · {c.is_active ? "активен" : <span className="t-err">выключен</span>}
            </span>
          </div>
          <button className="icon-btn" aria-label="Закрыть" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "manage"} onClick={() => setTab("manage")}>Управление</button>
          <button role="tab" aria-selected={tab === "logs"} onClick={() => setTab("logs")}>Логи доменов · 2 дня</button>
        </div>

        <div className="body">
          {tab === "logs" ? <><LogSwitch c={c} reload={reload} /><Logs id={c.id} /></> : (
            <>
              {c.sub_url ? (
                <section className="section" style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                  <Qr text={c.sub_url} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="hint" style={{ fontWeight: 700 }}>Ссылка для Happ</div>
                    <code className="code">{c.sub_url}</code>
                    <div className="row">
                      <button className="btn primary sm" onClick={() => copy(c.sub_url!, "Ссылка скопирована")}>Копировать</button>
                      <button className="btn sm" onClick={() => copy("happ://add/" + c.sub_url, "happ:// ссылка скопирована")}>happ:// ссылка</button>
                    </div>
                  </div>
                </section>
              ) : <div className="note err">У клиента нет sub_token — ссылку Happ не собрать.</div>}

              <Traffic c={c} pct={pct} reload={reload} />
              <Expiry c={c} reload={reload} />
              <Account c={c} reload={reload} />
              <Danger c={c} reload={reload} onClose={onClose} />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function useAction(reload: () => Promise<void>) {
  const [busy, setBusy] = useState("");
  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); await reload(); if (ok) toast(ok); }
    catch (e: any) { toast(e.message); }
    finally { setBusy(""); }
  };
  return { busy, run };
}

function Name({ c, reload }: { c: Client; reload: () => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(c.label || "");
  const { run } = useAction(reload);
  if (!edit) return <h2 style={{ fontSize: 22, cursor: "text" }} title="Нажми, чтобы переименовать" onClick={() => { setV(c.label || nameOf(c)); setEdit(true); }}>{nameOf(c)}</h2>;
  const save = () => { setEdit(false); if (v.trim() !== (c.label || "")) run("name", () => api(`/api/admin/clients/${c.id}`, "PATCH", { label: v.trim() || null }), "Имя сохранено"); };
  return <input className="input sm" autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { e.stopPropagation(); setEdit(false); } }} style={{ fontSize: 18, fontWeight: 800, width: "100%" }} />;
}

function Traffic({ c, pct, reload }: { c: Client; pct: number; reload: () => Promise<void> }) {
  const unl = isUnlimited(c);
  const [gb, setGb] = useState(unl ? "" : String(+((c.traffic_limit_bytes || 0) / GB).toFixed(1)));
  const { busy, run } = useAction(reload);
  useEffect(() => setGb(unl ? "" : String(+((c.traffic_limit_bytes || 0) / GB).toFixed(1))), [c.traffic_limit_bytes, unl]);
  const setLimit = (bytes: number) => run("lim", () => api(`/api/admin/clients/${c.id}`, "PATCH", { traffic_limit_bytes: bytes }), "Лимит сохранён");

  return (
    <section className="section">
      <div className="between">
        <h3 style={{ fontSize: 15 }}>Трафик</h3>
        <span className={pct >= 1 ? "t-err" : pct >= 0.8 ? "t-warn" : "muted"} style={{ fontSize: 13 }}>
          {unl ? `${fmtBytes(c.used)} · без лимита` : `${fmtBytes(c.used)} из ${fmtBytes(c.traffic_limit_bytes!)} · ${Math.round(pct * 100)}%`}
        </span>
      </div>
      <LimitBar c={c} />
      <div className="row" style={{ gap: 18, fontSize: 13, color: "var(--soft)" }}><span>↓ скачано {fmtBytes(c.down)}</span><span>↑ отправлено {fmtBytes(c.up)}</span></div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); const n = parseFloat(gb.replace(",", ".")); if (n > 0) setLimit(Math.round(n * GB)); }}>
        <label htmlFor="lim" className="hint" style={{ fontWeight: 600, color: "var(--soft)" }}>Лимит, ГБ</label>
        <input id="lim" className="input sm" style={{ width: 90 }} inputMode="decimal" placeholder="∞" value={gb} onChange={(e) => setGb(e.target.value)} />
        <button className="btn sm" type="submit" disabled={!!busy || !gb}>Сохранить</button>
        <button className="btn sm" type="button" disabled={!!busy || unl} onClick={() => setLimit(UNLIMITED)}>Без лимита</button>
        {!unl && <button className="btn soft sm" type="button" disabled={!!busy} onClick={() => run("top", () => api(`/api/admin/clients/${c.id}/topup`, "POST", { gb: 10 }), "+10 ГБ, доступ включён")}>+10 ГБ и включить</button>}
      </form>
    </section>
  );
}

function Expiry({ c, reload }: { c: Client; reload: () => Promise<void> }) {
  const { busy, run } = useAction(reload);
  const d = daysLeft(c);
  const ext = (body: object, ok: string) => run("exp", () => api(`/api/admin/clients/${c.id}/subscription`, "POST", body), ok);
  return (
    <section className="section" style={{ gap: 10 }}>
      <div className="between">
        <h3 style={{ fontSize: 15 }}>Срок доступа</h3>
        <span className={d < 0 ? "t-err" : d <= 7 ? "t-info" : "muted"} style={{ fontSize: 13 }}>
          {d === Infinity ? "бессрочно" : d < 0 ? `истёк ${fmtDate(c.expires_at, true)}` : `до ${fmtDate(c.expires_at, true)}`}
        </span>
      </div>
      <div className="row">
        <button className="btn sm" disabled={!!busy} onClick={() => ext({ amount: 7, unit: "days" }, "+7 дней")}>+7 дней</button>
        <button className="btn sm" disabled={!!busy} onClick={() => ext({ amount: 1, unit: "months" }, "+1 месяц")}>+1 месяц</button>
        <button className="btn sm" disabled={!!busy} onClick={() => ext({ amount: 3, unit: "months" }, "+3 месяца")}>+3 месяца</button>
        <button className="btn sm" disabled={!!busy || d === Infinity} onClick={() => ext({ unlimited: true }, "Теперь бессрочно")}>Бессрочно</button>
      </div>
      {d !== Infinity && <div className="hint">Продление считается от текущей даты окончания, если она ещё не прошла, и сразу включает доступ.</div>}
    </section>
  );
}

function Account({ c, reload }: { c: Client; reload: () => Promise<void> }) {
  const { busy, run } = useAction(reload);
  const [pass, setPass] = useState("");
  return (
    <section className="section" style={{ gap: 10 }}>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 15 }}>Пароль Ningbox</h3>
          <div className="hint" style={{ marginTop: 2 }}>логин: {c.username || c.email}</div>
        </div>
        <button className="btn sm" disabled={!!busy} onClick={() => run("pw", async () => setPass((await api(`/api/admin/clients/${c.id}/password`, "POST", {})).password), "Новый пароль готов")}>Сменить пароль</button>
      </div>
      {pass && (
        <div className="note row" style={{ justifyContent: "space-between" }}>
          <span>Новый пароль: <span className="secret">{pass}</span></span>
          <button className="btn sm" onClick={() => copy(pass, "Пароль скопирован")}>Копировать</button>
        </div>
      )}
      <div className="row" style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 10 }}>
        <span className="hint" style={{ flex: 1 }}>Режим маршрутизации</span>
        {[["race", "race"], ["full_tunnel", "весь трафик"]].map(([m, l]) => (
          <button key={m} className="chip" style={{ padding: "6px 12px", fontSize: 13 }} aria-pressed={c.mode === m} disabled={!!busy}
            onClick={() => c.mode !== m && run("mode", () => api(`/api/admin/clients/${c.id}`, "PATCH", { mode: m }), "Режим сохранён")}>{l}</button>
        ))}
      </div>
    </section>
  );
}

function Danger({ c, reload, onClose }: { c: Client; reload: () => Promise<void>; onClose: () => void }) {
  const { busy, run } = useAction(reload);
  const [confirm, setConfirm] = useState(false);
  if (confirm)
    return (
      <div className="note err" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <b>Удалить {nameOf(c)} навсегда?</b>
        <span style={{ fontSize: 13 }}>Ссылка Happ и вход в Ningbox перестанут работать. Если нужно просто приостановить — выключи доступ.</span>
        <div className="row">
          <button className="btn danger solid" disabled={!!busy} onClick={() => run("del", async () => { await api(`/api/admin/clients/${c.id}`, "DELETE"); onClose(); }, "Клиент удалён")}>Да, удалить</button>
          <button className="btn" onClick={() => setConfirm(false)}>Отмена</button>
        </div>
      </div>
    );
  return (
    <div className="row" style={{ marginTop: "auto", flexWrap: "nowrap" }}>
      <button className={`btn ${c.is_active ? "warn" : "ok"}`} style={{ flex: 1 }} disabled={!!busy}
        onClick={() => run("act", () => api(`/api/admin/clients/${c.id}`, "PATCH", { is_active: !c.is_active }), c.is_active ? "Доступ выключен" : "Доступ включён")}>
        {c.is_active ? "Выключить доступ" : "Включить доступ"}
      </button>
      <button className="btn danger" onClick={() => setConfirm(true)}>Удалить</button>
    </div>
  );
}

function LogSwitch({ c, reload }: { c: Client; reload: () => Promise<void> }) {
  const { busy, run } = useAction(reload);
  const on = c.log_domains;
  return (
    <div className="switch">
      <div>
        <b>Сохранять домены (2 дня)</b>
        <small>{c.last_proto === "hysteria" ? "Последнее подключение — Hysteria: там домены не пишутся, только Reality и CDN." : "Пишутся подключения через Reality и CDN."}</small>
      </div>
      <button className="toggle" role="switch" aria-checked={on} aria-label="Сохранять домены" disabled={!!busy}
        onClick={() => run("log", () => api(`/api/admin/clients/${c.id}`, "PATCH", { log_domains: !on }), on ? "Запись доменов выключена" : "Запись доменов включена")} />
    </div>
  );
}

function Logs({ id }: { id: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: number; domain: string; occurred_at: string }[] | null>(null);
  const load = useCallback(async (s: string) => {
    setRows(null);
    try { setRows((await api(`/api/admin/clients/${id}/logs?q=${encodeURIComponent(s)}`)).events || []); }
    catch (e: any) { toast(e.message); setRows([]); }
  }, [id]);
  useEffect(() => { const t = setTimeout(() => load(q.trim()), 300); return () => clearTimeout(t); }, [q, load]);

  return (
    <>
      <label className="search" style={{ flex: "none" }}>
        <span className="muted" style={{ display: "flex" }}><Icon name="search" size={16} /></span>
        <input type="search" placeholder="Поиск по домену" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {rows === null ? <div className="empty"><Mark h={14} eq on /></div> : !rows.length ? <div className="empty">Записей нет</div> : (
        <div className="logs">
          {rows.length >= 500 && <div className="hint">Показаны последние 500 — уточни поиск</div>}
          {rows.map((r) => (
            <div key={r.id}>
              <time>{new Date(r.occurred_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
              <span>{r.domain}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
