import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const pass = typeof body.password === "string" && body.password.length >= 4 ? body.password : randomBytes(6).toString("base64url");
  const { error } = await supabaseAdmin().from("clients").update({ password_hash: await bcrypt.hash(pass, 10) }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ password: pass });
}
