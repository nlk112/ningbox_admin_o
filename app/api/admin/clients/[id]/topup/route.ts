import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GB, UNLIMITED } from "@/lib/clients";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gb = Number((await req.json().catch(() => ({}))).gb) || 10;
  const sb = supabaseAdmin();
  const { data: c, error } = await sb
    .from("clients")
    .select("traffic_limit_bytes, total_uplink_bytes, total_downlink_bytes")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const used = Number(c.total_uplink_bytes || 0) + Number(c.total_downlink_bytes || 0);
  const limit = c.traffic_limit_bytes == null ? UNLIMITED : Number(c.traffic_limit_bytes);
  const next = limit >= UNLIMITED ? UNLIMITED : Math.max(limit, used) + gb * GB;
  const { error: e2 } = await sb.from("clients").update({ traffic_limit_bytes: next, is_active: true }).eq("id", id);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true, traffic_limit_bytes: next });
}
