"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mark, api, copy, toast } from "./ui";

type R = { id: number; version: string; download_url: string; sha256: string; changelog: string; created_at: string };

const VER = /^\d+\.\d+\.\d+$/;
const newer = (a: string, b: string) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
const mb = (n: number) => (n / 1048576).toFixed(1) + " МБ";

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// PUT через XHR, а не fetch: так видно прогресс загрузки
function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((ok, fail) => {
    const x = new XMLHttpRequest();
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    x.open("PUT", url);
    x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => (x.status < 300 ? ok() : fail(new Error(`Storage: ${x.status} ${x.responseText.slice(0, 120)}`)));
    x.onerror = () => fail(new Error("Сеть оборвалась при загрузке"));
    x.send(form);
  });
}

export default function Releases() {
  const [items, setItems] = useState<R[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const pick = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { setItems((await api("/api/admin/releases")).releases || []); }
    catch (e: any) { toast(e.message); setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const latest = items?.[0];
  const bad = version && !VER.test(version) ? "Формат: 0.12.0" : latest && version && !newer(version, latest.version) ? `Должна быть выше ${latest.version}, иначе клиенты не обновятся` : "";

  function choose(f?: File | null) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".exe")) return toast("Нужен .exe");
    setFile(f);
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !version || bad) return;
    try {
      setStage("Считаю SHA-256…");
      const hash = await sha256(file);
      setStage("Загружаю…"); setProgress(0);
      const { path, url } = await api("/api/admin/releases/upload-url", "POST", { filename: file.name });
      await put(url, file, setProgress);
      setStage("Публикую…");
      await api("/api/admin/releases", "POST", { version, path, sha256: hash, changelog: notes.trim() });
      toast(`Версия ${version} опубликована`);
      setFile(null); setVersion(""); setNotes(""); load();
    } catch (e: any) { toast(e.message); }
    finally { setStage(""); }
  }

  async function remove(r: R) {
    if (!confirm(`Удалить релиз ${r.version}? Клиенты перестанут его видеть.`)) return;
    try { await api(`/api/admin/releases/${r.id}`, "DELETE"); toast("Удалено"); load(); }
    catch (e: any) { toast(e.message); }
  }

  const busy = !!stage;
  return (
    <div className="cols">
      <form className="card" onSubmit={publish} style={{ gap: 14 }}>
        <h2 style={{ fontSize: 18 }}>Новая версия Ningbox</h2>
        <div className="hint" style={{ marginTop: -6 }}>Клиенты увидят её в течение получаса и обновятся по кнопке.</div>
        <div
          className={`drop${file ? " has" : ""}`}
          onClick={() => !busy && pick.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (!busy) choose(e.dataTransfer.files[0]); }}
        >
          {file ? <><b>{file.name}</b><span className="muted">{mb(file.size)}</span></> : <><b>Перетащи Ningbox.exe</b><span className="muted">или нажми, чтобы выбрать</span></>}
          <input ref={pick} type="file" accept=".exe" hidden onChange={(e) => choose(e.target.files?.[0])} />
        </div>
        <input className="input" placeholder={latest ? `Версия, сейчас ${latest.version}` : "Версия, например 0.12.0"} value={version} onChange={(e) => setVersion(e.target.value.trim())} disabled={busy} />
        {bad && <div className="hint" style={{ color: "var(--err-t)", marginTop: -6 }}>{bad}</div>}
        <textarea className="input" style={{ minHeight: 110, resize: "vertical" }} placeholder={"Что нового (каждый пункт с новой строки)"} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        {busy && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="between"><span className="hint">{stage}</span>{stage.startsWith("Загружаю") && <span className="hint">{Math.round(progress * 100)}%</span>}</div>
            <div className="bar"><div style={{ width: `${stage.startsWith("Загружаю") ? progress * 100 : 100}%` }} /></div>
          </div>
        )}
        <button className="btn primary" disabled={busy || !file || !version || !!bad} style={{ alignSelf: "flex-start" }}>Опубликовать</button>
      </form>

      <section className="card">
        <div className="between"><h2 style={{ fontSize: 18 }}>Выпущенные версии</h2><span className="muted">{items?.length ?? ""}</span></div>
        {items === null && <div className="empty"><Mark h={14} eq on /></div>}
        {items?.length === 0 && <div className="empty">Релизов пока нет</div>}
        {items?.map((r, i) => (
          <div key={r.id} className="notif">
            <div className="t">
              <b>{r.version}</b>{i === 0 && <span className="rel-now">у клиентов</span>}
              {r.changelog && <p>{r.changelog}</p>}
              <small>
                {new Date(r.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {" · "}<a href={r.download_url} target="_blank" rel="noreferrer">скачать</a>
                {" · "}<button type="button" className="linkish" onClick={() => copy(r.sha256, "SHA-256 скопирован")}>{r.sha256.slice(0, 10)}…</button>
              </small>
            </div>
            <button className="btn danger sm" onClick={() => remove(r)}>Удалить</button>
          </div>
        ))}
      </section>
    </div>
  );
}
