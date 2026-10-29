import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseAdmin();
  const { data: row } = await sb.from("app_releases").select("storage_path").eq("id", id).maybeSingle();
  const { error } = await sb.from("app_releases").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (row?.storage_path && !/^https?:/.test(row.storage_path)) await sb.storage.from("releases").remove([row.storage_path]);
  return NextResponse.json({ ok: true });
}
