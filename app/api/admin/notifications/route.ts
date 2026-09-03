import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("notifications")
    .select("id, title, body, duration_hours, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data });
}

export async function POST(req: NextRequest) {
  const { title, body, duration_hours } = await req.json();
  if (!title) return NextResponse.json({ error: "title обязателен" }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("notifications").insert({
    title,
    body: body || "",
    duration_hours: duration_hours ?? null, // null = висит, пока не удалят руками
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
