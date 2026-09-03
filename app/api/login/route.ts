import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import { createSessionToken, COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { username, password, code } = await req.json();

  if (username !== process.env.ADMIN_USERNAME) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const passwordOk = await bcrypt.compare(password || "", process.env.ADMIN_PASSWORD_HASH || "");
  if (!passwordOk) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const totp = new TOTP({
    issuer: "Ningbox Admin",
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(process.env.ADMIN_TOTP_SECRET || ""),
  });

  // window: 1 — допускаем код из соседнего 30-секундного интервала
  // (рассинхрон часов на телефоне — обычное дело, не должно ломать вход)
  const delta = totp.validate({ token: (code || "").trim(), window: 1 });
  if (delta === null) {
    return NextResponse.json({ error: "Неверный код 2FA" }, { status: 401 });
  }

  const token = await createSessionToken(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
