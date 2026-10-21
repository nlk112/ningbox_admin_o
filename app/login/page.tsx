"use client";

import { useState } from "react";
import { Mark } from "@/components/ui";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, code: code.replace(/\s/g, "") }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || "Ошибка входа");
        return;
      }
      location.href = "/admin";
    } catch {
      setError("Нет связи с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit} aria-label="Вход">
        <div className="brand" style={{ padding: "0 0 10px", fontSize: 20 }}>
          <span className="logo" style={{ width: 34, height: 34, borderRadius: 10 }}>N</span>
          <h1 style={{ fontSize: 20 }}>Ningbox <small style={{ color: "var(--muted)", fontWeight: 600 }}>admin</small></h1>
        </div>
        <label className="lbl" htmlFor="u">Логин</label>
        <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
        <label className="lbl" htmlFor="p">Пароль</label>
        <input id="p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <label className="lbl" htmlFor="c">Код из приложения 2FA</label>
        <input id="c" className="input" inputMode="numeric" autoComplete="one-time-code" placeholder="000 000" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} style={{ fontSize: 18, letterSpacing: ".3em" }} />
        <button className="btn primary" type="submit" disabled={loading} style={{ marginTop: 14, padding: 13, fontSize: 15 }}>{loading ? "Вход…" : "Войти"}</button>
        {error && <div className="note err" style={{ marginTop: 8, textAlign: "center" }}>{error}</div>}
      </form>
      <Mark h={14} style={{ opacity: 0.3 }} />
    </div>
  );
}
