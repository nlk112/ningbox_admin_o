import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Vercel не пропустит .exe на 45 МБ через функцию, поэтому отдаём браузеру подписанную ссылку
// и он грузит файл прямо в Supabase Storage.
export async function POST(req: NextRequest) {
  const { filename } = await req.json();
  if (!filename) return NextResponse.json({ error: "filename обязателен" }, { status: 400 });
  const path = `${Date.now()}-${String(filename).replace(/[^\w.-]+/g, "_")}`;
  const { data, error } = await supabaseAdmin().storage.from("releases").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path, url: data.signedUrl });
}
