import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SUB_BASE } from "@/lib/clients";

const API = process.env.HAPP_CRYPT_API || "https://crypto.happ.su/api-v2.php";

export async function cryptLink(url: string): Promise<string> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(15000),
  });
  const text = (await res.text()).replace(/\\\//g, "/");
  const link = text.match(/happ:\/\/crypt\d+\/[^\s"'<>\\]+/)?.[0];
  if (!res.ok || !link) throw new Error(`crypto.happ.su: ${res.status} ${text.slice(0, 120)}`);
  return link;
}

export async function cryptClient(id: string, token: string) {
  const link = await cryptLink(SUB_BASE + token);
  const { error } = await supabaseAdmin().from("clients").update({ sub_crypt: link }).eq("id", id);
  if (error) throw new Error(error.message);
  return link;
}
