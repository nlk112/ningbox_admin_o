import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Vercel-функции режут тело запроса на десятки МБ — .exe туда целиком не
// затолкать. Вместо проксирования файла через себя выдаём браузеру
// временную подписанную ссылку на прямую загрузку в Supabase Storage —
// файл летит браузер -> Supabase напрямую, минуя наш сервер полностью.
export async function POST(req: NextRequest) {
  const { filename } = await req.json();
  if (!filename) return NextResponse.json({ error: "filename обязателен" }, { status: 400 });

  const path = `${Date.now()}-${filename}`;
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from("releases").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path, token: data.token });
}
