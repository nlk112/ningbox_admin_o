import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Unit = "hours" | "days" | "months";

function addDuration(base: Date, amount: number, unit: Unit): Date {
  const d = new Date(base);
  if (unit === "hours") d.setHours(d.getHours() + amount);
  else if (unit === "days") d.setDate(d.getDate() + amount);
  else if (unit === "months") d.setMonth(d.getMonth() + amount);
  return d;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const sb = supabaseAdmin();

  if (body.unlimited === true) {
    const { error } = await sb.from("clients").update({ expires_at: null, is_active: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, expires_at: null });
  }

  const amount = Number(body.amount);
  const unit = body.unit as Unit;
  if (!amount || amount <= 0 || !["hours", "days", "months"].includes(unit)) {
    return NextResponse.json({ error: "amount и unit (hours/days/months) обязательны" }, { status: 400 });
  }

  // Продлеваем от текущего expires_at, если он ещё в будущем, иначе от now() —
  // так активная подписка не "сгорает" при продлении заранее, а истёкшая
  // просто стартует заново с текущего момента.
  const { data: current, error: fetchErr } = await sb
    .from("clients")
    .select("expires_at")
    .eq("id", id)
    .single();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const now = new Date();
  const currentExpiry = current?.expires_at ? new Date(current.expires_at) : null;
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  const newExpiry = addDuration(base, amount, unit);

  const { error } = await sb
    .from("clients")
    .update({ expires_at: newExpiry.toISOString(), is_active: true })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, expires_at: newExpiry.toISOString() });
}
