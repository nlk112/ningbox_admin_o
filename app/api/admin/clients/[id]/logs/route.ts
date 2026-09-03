import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const sb = supabaseAdmin();
  let query = sb
    .from("domain_events")
    .select("id, domain, occurred_at")
    .eq("client_id", params.id)
    .gte("occurred_at", twoDaysAgo)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (q) query = query.ilike("domain", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data });
}
