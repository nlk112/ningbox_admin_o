#!/usr/bin/env node
// Прямая загрузка в Supabase Storage через service_role — никаких signed
// URL / TUS не нужно, у service_role и так полный доступ. Цель — проверить,
// была ли проблема вообще в Supabase, или именно в браузерном протоколе
// загрузки (signed URL / TUS), которым мы до этого пользовались.
//
// Запуск: node scripts/upload-release-supabase.mjs <version> <path-to-exe> "<changelog>"
//
// Перед первым запуском:
//   npm install @supabase/supabase-js --no-save
//   $env:SUPABASE_URL="https://xxxxx.supabase.co"
//   $env:SUPABASE_SERVICE_KEY="..."

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const [, , version, filePath, changelog] = process.argv;

if (!version || !filePath) {
  console.error('usage: node scripts/upload-release-supabase.mjs <version> <path-to-exe> "<changelog>"');
  process.exit(1);
}

for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]) {
  if (!process.env[name]) {
    console.error(`переменная окружения ${name} не задана`);
    process.exit(1);
  }
}

const fileBuffer = readFileSync(filePath);
const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
const filename = path.basename(filePath);
const objectPath = `${Date.now()}-${filename}`;

console.log(`Файл: ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(1)} МБ)`);
console.log(`SHA-256: ${sha256}`);
console.log("Загружаю в Supabase Storage...");

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const startedAt = Date.now();

const uploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/releases/${objectPath}`;
let upErr = null;
try {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_KEY,
      "Content-Type": "application/octet-stream",
    },
    body: fileBuffer,
    duplex: "half",
  });
  if (!res.ok) {
    upErr = { message: `HTTP ${res.status}: ${await res.text()}` };
  }
} catch (err) {
  console.error("СЫРАЯ ошибка fetch (без обёртки supabase-js):");
  console.error("  message:", err.message);
  console.error("  name:", err.name);
  console.error("  cause:", err.cause);
  console.error("  stack:", err.stack);
  upErr = err;
}
if (upErr) {
  console.error("Ошибка загрузки:", upErr.message);
  if (upErr.cause) console.error("Причина (cause):", upErr.cause);
  console.error("Полный объект ошибки:", JSON.stringify(upErr, Object.getOwnPropertyNames(upErr), 2));
  process.exit(1);
}
console.log(`Загружено за ${((Date.now() - startedAt) / 1000).toFixed(1)} сек`);

const { data: pub } = sb.storage.from("releases").getPublicUrl(objectPath);
console.log(`URL: ${pub.publicUrl}`);
console.log("Записываю метаданные в app_releases...");

const { error } = await sb.from("app_releases").insert({
  version,
  storage_path: objectPath,
  download_url: pub.publicUrl,
  sha256,
  changelog: changelog || "",
});

if (error) {
  console.error("Ошибка записи в Supabase:", error.message);
  process.exit(1);
}

console.log(`Готово! Релиз ${version} опубликован.`);
