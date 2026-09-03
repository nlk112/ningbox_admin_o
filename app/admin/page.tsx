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
  const [topTab, setTopTab] = useState<"clients" | "releases" | "notifications">("clients");
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
    if (topTab !== "clients") return;
    load();
    const t = setInterval(load, 20000); // онлайн-статус обновляем сам собой
    return () => clearInterval(t);
  }, [load, topTab]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Ningbox Admin</div>
        <div style={{ display: "flex", gap: 10 }}>
          {topTab === "clients" && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Клиент</button>}
          <button className="btn btn-secondary" onClick={logout}>Выйти</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`btn ${topTab === "clients" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTopTab("clients")}>Клиенты</button>
        <button className={`btn ${topTab === "releases" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTopTab("releases")}>Релизы</button>
        <button className={`btn ${topTab === "notifications" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTopTab("notifications")}>Уведомления</button>
      </div>

      {topTab === "releases" && <ReleasesPanel />}
      {topTab === "notifications" && <NotificationsPanel />}

      {topTab === "clients" && (
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
      )}

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
  const [limitGB, setLimitGB] = useState(
    client.traffic_limit_bytes == null ? "" : String(client.traffic_limit_bytes / 1024 / 1024 / 1024)
  );
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

  async function saveTrafficLimit() {
    setBusy(true);
    setMsg("");
    try {
      const bytes = limitGB.trim() === "" ? null : Math.round(parseFloat(limitGB) * 1024 * 1024 * 1024);
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traffic_limit_bytes: bytes }),
      });
      if (!res.ok) { const d = await res.json(); setMsg(d.error || "Ошибка"); return; }
      setMsg("Лимит трафика обновлён");
      onChanged();
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
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                type="number"
                min={0}
                step="0.1"
                placeholder="Лимит трафика, ГБ (пусто = безлимит)"
                value={limitGB}
                onChange={(e) => setLimitGB(e.target.value)}
              />
              <button className="btn btn-primary" onClick={saveTrafficLimit} disabled={busy}>Сохранить</button>
            </div>
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

// ============================================================
// Релизы — загрузка .exe напрямую в Supabase Storage (минуя тело
// запроса Vercel-функции, у которого маленький лимит) через подписанную
// ссылку, плюс SHA-256 считаем в браузере перед отправкой.
// ============================================================

type ReleaseRow = {
  id: number;
  version: string;
  download_url: string;
  sha256: string;
  changelog: string;
  created_at: string;
};

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ReleasesPanel() {
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/releases");
    const data = await res.json();
    setReleases(data.releases || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upload() {
    if (!file || !version.trim()) { setStatus("Укажи версию и выбери файл"); return; }
    setBusy(true);
    setProgress(0);
    try {
      setStatus("Считаю SHA-256...");
      const sha256 = await sha256Hex(file);

      setStatus("Запрашиваю ссылку на загрузку...");
      const urlRes = await fetch("/api/admin/releases/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) { setStatus(urlData.error || "Ошибка"); return; }

      setStatus("Загружаю файл...");
      // Стандартный upload/uploadToSignedUrl у Supabase официально не
      // рекомендован для файлов больше 6 МБ — зависает без ошибки и без
      // прогресса. TUS (resumable upload) — их же официально
      // рекомендованный протокол именно под такие файлы, плюс даёт честный
      // прогресс по чанкам.
      const { default: tus } = await import("tus-js-client");
      const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace("https://", "").split(".")[0];

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${urlData.token}`,
            "x-upsert": "true",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: "releases",
            objectName: urlData.path,
            contentType: file.type || "application/octet-stream",
          },
          chunkSize: 6 * 1024 * 1024, // Supabase требует ровно 6 МБ на чанк
          onError: reject,
          onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
          onSuccess: () => resolve(),
        });
        upload.findPreviousUploads().then((prev) => {
          if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
          upload.start();
        });
      });

      setStatus("Сохраняю запись о релизе...");
      const metaRes = await fetch("/api/admin/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, path: urlData.path, sha256, changelog }),
      });
      const metaData = await metaRes.json();
      if (!metaRes.ok) { setStatus(metaData.error || "Ошибка"); return; }

      setStatus("Готово!");
      setVersion(""); setChangelog(""); setFile(null);
      load();
    } catch (err: any) {
      setStatus("Ошибка загрузки: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontWeight: 700 }}>Новый релиз</div>
      <input className="input" placeholder="Версия (например 1.2.0)" value={version} onChange={(e) => setVersion(e.target.value)} />
      <textarea
        className="input"
        style={{ minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
        placeholder="Что поправили в этой версии..."
        value={changelog}
        onChange={(e) => setChangelog(e.target.value)}
      />
      <input type="file" accept=".exe" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button className="btn btn-primary" onClick={upload} disabled={busy} style={{ alignSelf: "flex-start" }}>
        {busy ? "Загружаю..." : "Опубликовать релиз"}
      </button>
      {busy && progress > 0 && (
        <div style={{ background: "var(--panel-2)", borderRadius: 999, height: 6, overflow: "hidden" }}>
          <div style={{ background: "var(--accent)", height: "100%", width: `${progress}%`, transition: "width 0.2s" }} />
        </div>
      )}
      {status && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{status}{busy && progress > 0 ? ` (${progress}%)` : ""}</div>}

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />

      <div style={{ fontWeight: 700 }}>История релизов</div>
      {releases.map((r) => (
        <div key={r.id} style={{ background: "var(--panel-2)", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <b>{r.version}</b>
            <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{new Date(r.created_at).toLocaleString("ru-RU")}</span>
          </div>
          {r.changelog && <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>{r.changelog}</div>}
        </div>
      ))}
      {releases.length === 0 && <div style={{ color: "var(--text-dim)" }}>Релизов пока нет</div>}
    </div>
  );
}

// ============================================================
// Уведомления — тот же баннер, что и под "вышла новая версия", но для
// произвольных информационных объявлений с настраиваемым временем жизни.
// ============================================================

type NotificationRow = {
  id: number;
  title: string;
  body: string;
  duration_hours: number | null;
  created_at: string;
};

function NotificationsPanel() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [duration, setDuration] = useState("24"); // часы; "" = бессрочно
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/notifications");
    const data = await res.json();
    setItems(data.notifications || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          duration_hours: duration === "" ? null : Number(duration),
        }),
      });
      setTitle(""); setBody("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontWeight: 700 }}>Новое уведомление</div>
      <input className="input" placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        className="input"
        style={{ minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
        placeholder="Текст (необязательно)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <select className="select" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ alignSelf: "flex-start" }}>
        <option value="1">1 час</option>
        <option value="24">24 часа</option>
        <option value="168">7 дней</option>
        <option value="">Бессрочно (пока не удалю)</option>
      </select>
      <button className="btn btn-primary" onClick={create} disabled={busy} style={{ alignSelf: "flex-start" }}>Создать</button>

      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />

      <div style={{ fontWeight: 700 }}>Все уведомления</div>
      {items.map((n) => (
        <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "var(--panel-2)", borderRadius: 8, padding: 12 }}>
          <div>
            <b>{n.title}</b>
            {n.body && <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>{n.body}</div>}
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
              {new Date(n.created_at).toLocaleString("ru-RU")} · {n.duration_hours == null ? "бессрочно" : `${n.duration_hours} ч.`}
            </div>
          </div>
          <button className="notif-delete-btn" onClick={() => remove(n.id)}>✕</button>
        </div>
      ))}
      {items.length === 0 && <div style={{ color: "var(--text-dim)" }}>Уведомлений пока нет</div>}
    </div>
  );
}
