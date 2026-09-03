#!/usr/bin/env node
// Одноразовый скрипт: генерирует всё, что нужно вписать в переменные
// окружения Vercel — bcrypt-хэш пароля и TOTP-секрет с QR-кодом.
//
// Запуск: node scripts/setup-admin.mjs <username> <password>
//
// Зависимости ставятся отдельно, только для этого скрипта:
//   npm install bcryptjs otpauth qrcode-terminal --no-save

import bcrypt from "bcryptjs";
import { TOTP, Secret } from "otpauth";
import qrcodeTerminal from "qrcode-terminal";
import { randomBytes } from "node:crypto";

const [, , username, password] = process.argv;
if (!username || !password) {
  console.error("usage: node scripts/setup-admin.mjs <username> <password>");
  process.exit(1);
}

const passwordHash = bcrypt.hashSync(password, 10);

const secret = new Secret({ size: 20 });
const totp = new TOTP({
  issuer: "Ningbox Admin",
  label: username,
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  secret,
});

console.log("\n=== Впиши в Vercel Environment Variables ===\n");
console.log("ADMIN_USERNAME=" + username);
console.log("ADMIN_PASSWORD_HASH=" + passwordHash);
console.log("ADMIN_TOTP_SECRET=" + secret.base32);
console.log("SESSION_SECRET=" + randomBytes(32).toString("hex"));
console.log("\n=== Отсканируй этот QR в Google Authenticator ===\n");
qrcodeTerminal.generate(totp.toString(), { small: true });
console.log("\nЕсли QR не сканируется — вбей ключ вручную: " + secret.base32);
