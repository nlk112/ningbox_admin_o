#!/usr/bin/env node
// Загрузка релиза напрямую из терминала — обходит браузер целиком (он у нас
// капризничает на долгих больших загрузках даже через Vercel Blob).
// Node.js своим http-клиентом тянет большие файлы гораздо надёжнее.
//
// Запуск: node scripts/upload-release.mjs <version> <path-to-exe> "<changelog>"
//
// Перед первым запуском:
//   npm install @vercel/blob @supabase/supabase-js --no-save
//   $env:BLOB_READ_WRITE_TOKEN="..."      (Vercel -> Storage -> твой Blob store -> .env.local -> скопировать)
//   $env:SUPABASE_URL="https://xxxxx.supabase.co"
//   $env:SUPABASE_SERVICE_KEY="..."

import { put } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const [, , version, filePath, changelog] = process.argv;

if (!version || !filePath) {
  console.error('usage: node scripts/upload-release.mjs <version> <path-to-exe> "<changelog>"');
  process.exit(1);
}

for (const name of ["BLOB_READ_WRITE_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"]) {
  if (!process.env[name]) {
    console.error(`переменная окружения ${name} не задана`);
    process.exit(1);
  }
}

const fileBuffer = readFileSync(filePath);
const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
const filename = path.basename(filePath);

console.log(`Файл: ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(1)} МБ)`);
console.log(`SHA-256: ${sha256}`);
console.log("Загружаю в Vercel Blob...");

const blob = await put(filename, fileBuffer, {
  access: "public",
  addRandomSuffix: true,
  token: process.env.BLOB_READ_WRITE_TOKEN,
});

console.log(`Загружено: ${blob.url}`);
console.log("Записываю метаданные в Supabase...");

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { error } = await sb.from("app_releases").insert({
  version,
  storage_path: blob.url,
  download_url: blob.url,
  sha256,
  changelog: changelog || "",
});

if (error) {
  console.error("Ошибка записи в Supabase:", error.message);
  process.exit(1);
}

console.log(`Готово! Релиз ${version} опубликован.`);
