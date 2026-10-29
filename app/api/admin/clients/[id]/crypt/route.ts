import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cryptClient } from "@/lib/crypt";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin().from("clients").select("sub_token").eq("id", id).single();
  if (error || !data?.sub_token) return NextResponse.json({ error: error?.message || "нет sub_token" }, { status: 400 });
  try {
    return NextResponse.json({ sub_crypt: await cryptClient(id, data.sub_token) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
