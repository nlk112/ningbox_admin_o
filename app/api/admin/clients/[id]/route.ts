import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Белый список полей, которые вообще можно менять отсюда — специально не
// даём патчить произвольный JSON целиком (например password_hash или
// xray_uuid руками отсюда лучше не трогать, для смены пароля будет
// отдельный явный эндпоинт, если понадобится).
const ALLOWED_FIELDS = new Set(["mode", "is_active", "traffic_limit_bytes"]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(body || {})) {
    if (ALLOWED_FIELDS.has(key)) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "нет допустимых полей для обновления" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("clients").update(patch).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = supabaseAdmin();
  const { error } = await sb.from("clients").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
