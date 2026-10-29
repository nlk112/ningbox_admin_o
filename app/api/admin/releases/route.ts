import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("app_releases")
    .select("id, version, download_url, sha256, changelog, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ releases: data });
}

// Файл к этому моменту уже лежит в Storage (браузер грузит его туда напрямую), тут только запись.
export async function POST(req: NextRequest) {
  const { version, path, sha256, changelog } = await req.json();
  if (!version || !path || !sha256) {
    return NextResponse.json({ error: "version, path и sha256 обязательны" }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { data: pub } = sb.storage.from("releases").getPublicUrl(path);
  const { error } = await sb.from("app_releases").insert({
    version,
    storage_path: path,
    download_url: pub.publicUrl,
    sha256,
    changelog: changelog || "",
  });
  if (error) {
    const msg = error.message.includes("duplicate") ? "Такая версия уже есть" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, download_url: pub.publicUrl });
}
