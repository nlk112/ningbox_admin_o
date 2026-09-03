"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
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
        body: JSON.stringify({ username, password, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Ошибка входа");
        return;
      }
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={submit} className="card" style={{ width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Ningbox Admin</div>
        <input className="input" placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        <input className="input" type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <input className="input" placeholder="Код из Google Authenticator" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Вход..." : "Войти"}</button>
        {error && <div style={{ color: "var(--danger)", fontSize: 13, textAlign: "center" }}>{error}</div>}
      </form>
    </div>
  );
}
