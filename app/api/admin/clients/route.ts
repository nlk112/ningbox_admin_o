import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { UNLIMITED, phoneDigits } from "@/lib/clients";
import { COLS, shape } from "@/lib/shape";
import { cryptClient } from "@/lib/crypt";

export async function GET() {
  const { data, error } = await supabaseAdmin().from("clients").select(COLS).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: (data || []).map(shape) });
}

const password = () => randomBytes(6).toString("base64url");

export async function POST(req: NextRequest) {
  const { phone, label, limit_gb, months } = await req.json();
  const digits = phoneDigits(phone);
  if (digits.length < 10) return NextResponse.json({ error: "Проверь номер телефона" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: sample } = await sb.from("clients").select("phone").not("phone", "is", null).limit(1);
  const plus = sample?.[0]?.phone?.startsWith("+");

  const { data: dup } = await sb.from("clients").select("id").or(`phone.eq.${digits},phone.eq.+${digits},username.eq.${digits}`).limit(1);
  if (dup?.length) return NextResponse.json({ error: "Клиент с таким номером уже есть" }, { status: 400 });

  const expires = months ? new Date(new Date().setMonth(new Date().getMonth() + Number(months))).toISOString() : null;
  const pass = password();
  const { data, error } = await sb
    .from("clients")
    .insert({
      email: `${digits}@ningbox.local`,
      username: digits,
      phone: plus ? "+" + digits : digits,
      label: (label || "").trim() || null,
      password_hash: await bcrypt.hash(pass, 10),
      xray_uuid: randomUUID(),
      is_active: true,
      mode: "race",
      traffic_limit_bytes: limit_gb ? Math.round(Number(limit_gb) * 1024 ** 3) : UNLIMITED,
      expires_at: expires,
    })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!data.sub_token) {
    data.sub_token = randomBytes(16).toString("hex");
    await sb.from("clients").update({ sub_token: data.sub_token }).eq("id", data.id);
  }
  try {
    data.sub_crypt = await cryptClient(data.id, data.sub_token);
  } catch (e) {
    console.error("crypt", e);
  }
  return NextResponse.json({ client: shape(data), password: pass });
}
