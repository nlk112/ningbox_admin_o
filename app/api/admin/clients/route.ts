import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ONLINE_THRESHOLD_MS = 90_000; // чуть больше poll_interval воркера (15с)

export async function GET() {
  const sb = supabaseAdmin();

  const { data: clients, error } = await sb
    .from("clients")
    .select("id, email, username, xray_uuid, is_active, mode, expires_at, traffic_limit_bytes")
    .order("username", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: totals } = await sb.from("client_traffic_totals").select("client_id, total_bytes");
  const { data: lastSeen } = await sb.from("client_last_seen").select("client_id, last_seen_at");

  const totalsMap = new Map((totals || []).map((t: any) => [t.client_id, t.total_bytes]));
  const seenMap = new Map((lastSeen || []).map((s: any) => [s.client_id, s.last_seen_at]));

  const now = Date.now();
  const result = (clients || []).map((c: any) => {
    const seenAt = seenMap.get(c.id) || null;
    const online = seenAt ? now - new Date(seenAt).getTime() < ONLINE_THRESHOLD_MS : false;
    return {
      ...c,
      traffic_used_bytes: totalsMap.get(c.id) || 0,
      last_seen_at: seenAt,
      online,
    };
  });

  return NextResponse.json({ clients: result });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, password, traffic_limit_bytes } = body || {};

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username обязателен" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 4) {
    return NextResponse.json({ error: "password обязателен (минимум 4 символа)" }, { status: 400 });
  }

  const xrayUuid = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const email = `${username}@ningbox.local`; // email тут — просто внутренний идентификатор для xray, не для связи

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("clients")
    .insert({
      email,
      username,
      password_hash: passwordHash,
      xray_uuid: xrayUuid,
      is_active: true,
      mode: "race",
      traffic_limit_bytes: traffic_limit_bytes ?? null,
    })
    .select("id, email, username, xray_uuid")
    .single();

  if (error) {
    const msg = error.message.includes("duplicate") ? "Такой username уже занят" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ client: data });
}
