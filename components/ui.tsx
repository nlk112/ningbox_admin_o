"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Client, isUnlimited, usage } from "@/lib/clients";

const NIK = [1, 0, -1, 0, 0, -1, 1, 0, 1];

export function Mark({ h = 16, eq = false, on = false, style }: { h?: number; eq?: boolean; on?: boolean; style?: React.CSSProperties }) {
  const lo = Math.round(h * 0.44);
  return (
    <span className={`mark${eq ? " eq" : ""}${on ? " on" : ""}`} style={{ height: h, ...style }} aria-hidden={eq || undefined} title={eq ? undefined : "nik112"}>
      {NIK.map((v, i) => (v < 0 ? <b key={i} /> : <i key={i} style={{ height: v ? h : lo }} />))}
    </span>
  );
}

const paths: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  user: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21h4" /></>,
  box: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
};

export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function LimitBar({ c, thin }: { c: Client; thin?: boolean }) {
  const p = usage(c);
  const tone = p >= 1 ? " err" : p >= 0.8 ? " warn" : "";
  return (
    <div className={`bar${thin ? " thin" : ""}${tone}`}>
      <div style={{ width: `${isUnlimited(c) ? 0 : Math.max(2, Math.min(100, p * 100))}%` }} />
    </div>
  );
}

export function Qr({ text }: { text: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0d1020", light: "#ffffff" } }).then(setSvg);
  }, [text]);
  return <div className="qr" role="img" aria-label="QR-код ссылки Happ" dangerouslySetInnerHTML={{ __html: svg }} />;
}

let toastFn: (s: string) => void = () => {};
export const toast = (s: string) => toastFn(s);

export function Toaster() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    toastFn = (s) => { setMsg(s); clearTimeout(t); t = setTimeout(() => setMsg(""), 2200); };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

export async function copy(text: string, what = "Скопировано") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(what);
}

export async function api<T = any>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 || res.redirected) { location.href = "/login"; throw new Error("Сессия истекла"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

export function useEsc(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && fn();
    addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [fn]);
}
