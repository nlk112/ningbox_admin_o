# Ningbox Admin

Админ-панель: список клиентов, онлайн-статус, управление подпиской,
поиск по логам доменов за последние 2 дня.

## 1. Локальная генерация креденшелов

```bash
npm install
npm install bcryptjs otpauth qrcode-terminal --no-save
node scripts/setup-admin.mjs <твой_логин> <твой_пароль>
```

Скрипт выведет 4 переменные окружения и QR-код в терминале — отсканируй
его в Google Authenticator (или впиши base32-ключ вручную, если QR не
сканируется в терминале).

## 2. Переменные окружения

Скопируй `.env.example` в `.env.local` для локальной разработки, впиши:
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — из Supabase (Project Settings → API,
  именно **service_role**, не `anon`)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_TOTP_SECRET` — из вывода
  `setup-admin.mjs`
- `SESSION_SECRET` — тоже из вывода скрипта

## 3. Локальный запуск

```bash
npm install
npm run dev
```
Открой http://localhost:3000 — редиректнёт на `/login`.

## 4. Деплой на Vercel

1. Залей проект в свой GitHub-репозиторий.
2. На vercel.com → New Project → импортируй репозиторий.
3. В Settings → Environment Variables впиши те же 6 переменных, что и в
   `.env.local` (это единственное, что нужно настроить — Vercel сам
   определит, что это Next.js проект, и соберёт его).
4. Deploy.

Пароль и TOTP-секрет никогда не попадают в git — только в переменные
окружения Vercel, которые видны исключительно тебе в дашборде.

## Важно про домен API vs админку

Эта админка ходит **напрямую в Supabase** (через service_role), минуя
`xray-api` — это отдельный, независимый слой поверх той же базы. Она не
знает про JWT-токены обычных клиентов и не может ими пользоваться —
у неё своя, отдельная сессия (логин+пароль+TOTP), не связанная с тем,
как логинятся сами VPN-клиенты.
