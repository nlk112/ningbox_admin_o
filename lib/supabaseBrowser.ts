import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* — единственные переменные, которые реально можно и нужно
// светить в браузере. anon-ключ сам по себе не даёт доступа ни к чему
// чувствительному (RLS на clients уже закрыт полностью), а сама загрузка
// файла в Storage идёт по ВРЕМЕННОЙ подписанной ссылке, которую выдаёт
// сервер через service_role — анонимный ключ тут вообще не участвует в
// авторизации записи, только в самом факте создания клиента SDK.
export function supabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
