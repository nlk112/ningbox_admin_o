export const GB = 1024 ** 3;
export const UNLIMITED = 1125899906842624;
export const ONLINE_MS = 2 * 60_000;
export const SUB_BASE = process.env.SUB_BASE_URL || "https://sub-nik-4821.duckdns.org:8443/sub/";

export type Client = {
  id: string;
  email: string;
  label: string | null;
  username: string | null;
  phone: string | null;
  mode: string;
  is_active: boolean;
  expires_at: string | null;
  traffic_limit_bytes: number | null;
  down: number;
  up: number;
  used: number;
  last_seen_at: string | null;
  created_at: string;
  online: boolean;
  sub_url: string | null;
  log_domains: boolean;
  last_proto: string | null;
  ningbox_seen_at: string | null;
  sub_fetched_at: string | null;
  sub_user_agent: string | null;
  sub_crypt: string | null;
};

export const happLink = (c: Client) => c.sub_crypt || c.sub_url;

const PROTO: Record<string, string> = { reality: "Reality", cdn: "CDN", hysteria: "Hysteria" };

export function appOf(ua: string | null) {
  if (!ua) return "";
  const name = ua.split(/[\/\s(]/)[0] || "";
  const os = /iphone|ios|ipad/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "macOS" : "";
  return [name, os].filter(Boolean).join(" ");
}

export function via(c: Client) {
  const nb = !!c.ningbox_seen_at && Date.now() - new Date(c.ningbox_seen_at).getTime() < 3 * 60_000;
  const app = nb ? "Ningbox" : c.online ? appOf(c.sub_user_agent) : "";
  return [app, c.online && c.last_proto ? PROTO[c.last_proto] || c.last_proto : ""].filter(Boolean).join(" · ");
}

export const phoneDigits = (s: string) => {
  let d = (s || "").replace(/\D/g, "");
  if (d.length === 10 && d[0] === "9") d = "7" + d;
  if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
  return d;
};

export function fmtPhone(p: string | null) {
  const d = phoneDigits(p || "");
  if (d.length !== 11) return p || "";
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
}

export function fmtBytes(n: number) {
  if (n >= 1024 ** 4) return (n / 1024 ** 4).toFixed(1).replace(".", ",") + " ТБ";
  if (n >= GB) return (n / GB).toFixed(n >= 100 * GB ? 0 : 1).replace(".", ",") + " ГБ";
  if (n >= 1024 ** 2) return Math.round(n / 1024 ** 2) + " МБ";
  return Math.round(n / 1024) + " КБ";
}

export const isUnlimited = (c: Pick<Client, "traffic_limit_bytes">) =>
  c.traffic_limit_bytes == null || c.traffic_limit_bytes >= UNLIMITED;

export const usage = (c: Client) => (isUnlimited(c) ? 0 : c.used / (c.traffic_limit_bytes || 1));

export const daysLeft = (c: Client) =>
  c.expires_at ? (new Date(c.expires_at).getTime() - Date.now()) / 86_400_000 : Infinity;

export const nameOf = (c: Client) => c.label || c.email.replace(/@ningbox\.local$/, "");

export function ago(iso: string | null) {
  if (!iso) return "не подключался";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 2) return "онлайн";
  if (m < 60) return `был ${m} мин назад`;
  if (m < 1440) return `был ${Math.round(m / 60)} ч назад`;
  return `был ${Math.round(m / 1440)} дн назад`;
}

export const fmtDate = (iso: string | null, year = false) =>
  iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", ...(year ? { year: "numeric" } : {}) }) : "бессрочно";
