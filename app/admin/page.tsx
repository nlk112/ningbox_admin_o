"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ClientRow = {
  id: string;
  email: string;
  username: string | null;
  xray_uuid: string;
  is_active: boolean;
  mode: string;
  expires_at: string | null;
  traffic_limit_bytes: number | null;
  traffic_used_bytes: number;
  last_seen_at: string | null;
  online: boolean;
};

function formatBytes(n: number): string {
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatExpiry(expiresAt: string | null): { text: string; warn: boolean } {
  if (!expiresAt) return { text: "Бессрочно", warn: false };
  const d = new Date(expiresAt);
  const now = new Date();
  const msLeft = d.getTime() - now.getTime();
  const daysLeft = msLeft / (1000 * 60 * 60 * 24);
  const text = d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return { text, warn: daysLeft < 3 };
}

export default function AdminPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<ClientRow | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/clients");
    const data = await res.json();
    setClients(data.clients || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // онлайн-статус обновляем сам собой
    return () => clearInterval(t);
  }, [load]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Ningbox Admin</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Клиент</button>
          <button className="btn btn-secondary" onClick={logout}>Выйти</button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ color: "var(--text-dim)", padding: 20 }}>Загрузка...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Статус</th>
                <th>Подписка</th>
                <th>Трафик</th>
                <th>Режим</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const expiry = formatExpiry(c.expires_at);
                return (
                  <tr key={c.id} onClick={() => setSelected(c)}>
                    <td>{c.username || c.email}</td>
                    <td>
                      <span className={`badge ${c.online ? "badge-on" : "badge-off"}`}>
                        <span className="dot" style={{ background: c.online ? "var(--accent)" : "var(--text-dim)" }} />
                        {c.online ? "онлайн" : "офлайн"}
                      </span>
                      {" "}
                      <span className={`badge ${c.is_active ? "badge-on" : "badge-warn"}`}>
                        {c.is_active ? "активен" : "отключён"}
                      </span>
                    </td>
                    <td style={{ color: expiry.warn ? "var(--warn)" : undefined }}>{expiry.text}</td>
                    <td>{formatBytes(c.traffic_used_bytes)} / {c.traffic_limit_bytes == null ? "∞" : formatBytes(c.traffic_limit_bytes)}</td>
                    <td>{c.mode === "full_tunnel" ? "весь трафик" : "race"}</td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr><td colSpan={5} style={{ color: "var(--text-dim)" }}>Клиентов пока нет</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {selected && (
        <ClientDetailModal
          client={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [limitGB, setLimitGB] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const traffic_limit_bytes = limitGB ? Math.round(parseFloat(limitGB) * 1024 * 1024 * 1024) : null;
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, traffic_limit_bytes }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка"); return; }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Новый клиент</div>
        <input className="input" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="input" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input className="input" placeholder="Лимит трафика, ГБ (пусто = безлимит)" value={limitGB} onChange={(e) => setLimitGB(e.target.value)} inputMode="decimal" />
        {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Создаю..." : "Создать"}</button>
        </div>
      </form>
    </div>
  );
}

function ClientDetailModal({ client, onClose, onChanged }: { client: ClientRow; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<"subscription" | "logs">("subscription");
  const [amount, setAmount] = useState("30");
  const [unit, setUnit] = useState<"hours" | "days" | "months">("days");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [logs, setLogs] = useState<{ id: number; domain: string; occurred_at: string }[]>([]);
  const [search, setSearch] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);

  const loadLogs = useCallback(async (q: string) => {
    setLogsLoading(true);
    const res = await fetch(`/api/admin/clients/${client.id}/logs?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setLogs(data.events || []);
    setLogsLoading(false);
  }, [client.id]);

  useEffect(() => {
    if (tab === "logs") loadLogs(search);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function extend() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), unit }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "Ошибка"); return; }
      setMsg("Подписка продлена");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function setUnlimited() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlimited: true }),
      });
      if (!res.ok) { const d = await res.json(); setMsg(d.error || "Ошибка"); return; }
      setMsg("Подписка сделана бессрочной");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !client.is_active }),
      });
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function deleteClient() {
    if (!confirm(`Удалить клиента ${client.username || client.email}? Это необратимо.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/clients/${client.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{client.username || client.email}</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>{client.xray_uuid}</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className={`btn ${tab === "subscription" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("subscription")}>Подписка</button>
          <button className={`btn ${tab === "logs" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("logs")}>Логи (2 дня)</button>
        </div>

        {tab === "subscription" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" style={{ width: 80 }} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select className="select" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
                <option value="hours">часов</option>
                <option value="days">дней</option>
                <option value="months">месяцев</option>
              </select>
              <button className="btn btn-primary" onClick={extend} disabled={busy}>Продлить</button>
            </div>
            <button className="btn btn-secondary" onClick={setUnlimited} disabled={busy}>Сделать бессрочным</button>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
            <button className="btn btn-secondary" onClick={toggleActive} disabled={busy}>
              {client.is_active ? "Отключить клиента" : "Включить клиента"}
            </button>
            <button className="btn btn-danger" onClick={deleteClient} disabled={busy}>Удалить клиента</button>
            {msg && <div style={{ fontSize: 13, color: "var(--accent)" }}>{msg}</div>}
          </div>
        )}

        {tab === "logs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="input"
              placeholder="Поиск по домену..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); loadLogs(e.target.value); }}
            />
            <div style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {logsLoading && <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Загрузка...</div>}
              {!logsLoading && logs.length === 0 && <div style={{ color: "var(--text-dim)", fontSize: 13 }}>Ничего не найдено</div>}
              {logs.map((ev) => (
                <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 10px", background: "var(--panel-2)", borderRadius: 6 }}>
                  <span>{ev.domain}</span>
                  <span style={{ color: "var(--text-dim)" }}>{new Date(ev.occurred_at).toLocaleTimeString("ru-RU")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
