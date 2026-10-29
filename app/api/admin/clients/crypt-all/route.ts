import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cryptClient } from "@/lib/crypt";

export const maxDuration = 60;

export async function POST() {
  const { data, error } = await supabaseAdmin().from("clients").select("id, sub_token").is("sub_crypt", null).not("sub_token", "is", null).limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let ok = 0;
  const failed: string[] = [];
  for (const c of data || []) {
    try {
      await cryptClient(c.id, c.sub_token);
      ok++;
    } catch (e: any) {
      failed.push(e.message);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return NextResponse.json({ ok, failed: failed.length, error: failed[0] });
}
