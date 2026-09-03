import { createClient } from "@supabase/supabase-js";

// ВАЖНО: этот файл импортируется только из server-side кода (API routes,
// server actions). SUPABASE_SERVICE_KEY не имеет префикса NEXT_PUBLIC_,
// значит Next.js не подставит его в клиентский бандл ни при каких условиях.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY не заданы");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
