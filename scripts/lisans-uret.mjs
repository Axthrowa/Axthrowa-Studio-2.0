#!/usr/bin/env node
/**
 * Premium lisans anahtarı üretir (Ed25519). Uygulama yalnız AÇIK anahtarı taşır ve anahtarı çevrimdışı doğrular
 * (src-tauri/src/lisans.rs). ÖZEL anahtar depoya girmez; kaybolursa yeni anahtar üretilemez, sızarsa herkes üretir.
 *
 *   node scripts/lisans-uret.mjs anahtar-olustur            # bir kez: özel anahtarı oluşturur, açık anahtarı yazar
 *   node scripts/lisans-uret.mjs uret --kime "Ad Soyad"      # süresiz premium
 *   node scripts/lisans-uret.mjs uret --kime "Ad" --bitis 2027-12-31
 *   (--ozel <yol>: özel anahtar dosyası; varsayılan %USERPROFILE%\.axthrowa\lisans-ozel-anahtar.pem)
 *
 * Anahtar biçimi: AXT1-<base64url(JSON)>.<base64url(imza)>  — imza JSON baytlarının üzerinde.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (ad) => {
  const i = process.argv.indexOf(`--${ad}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const ozelYol = arg("ozel") || path.join(os.homedir(), ".axthrowa", "lisans-ozel-anahtar.pem");
const b64 = (b) => Buffer.from(b).toString("base64url");

function acikAnahtar(ozel) {
  // SPKI DER'in son 32 baytı ham Ed25519 açık anahtarıdır
  return crypto.createPublicKey(ozel).export({ format: "der", type: "spki" }).subarray(-32);
}

export function lisansUret(ozel, { kime, bitis = null, plan = "premium", verildi = new Date().toISOString().slice(0, 10) }) {
  const yuk = Buffer.from(JSON.stringify({ kime, plan, verildi, bitis }), "utf8");
  return `AXT1-${b64(yuk)}.${b64(crypto.sign(null, yuk, ozel))}`;
}

const komut = process.argv[2];
if (komut === "anahtar-olustur") {
  if (fs.existsSync(ozelYol)) {
    console.error(`Zaten var: ${ozelYol}\nÜzerine yazılmaz (eski lisanslar geçersiz kalırdı).`);
    process.exit(1);
  }
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  fs.mkdirSync(path.dirname(ozelYol), { recursive: true });
  fs.writeFileSync(ozelYol, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600, flag: "wx" });
  console.log(`Özel anahtar: ${ozelYol}  (yedekleyin, paylaşmayın)`);
  console.log(`lisans.rs ACIK_ANAHTAR (base64url): ${b64(acikAnahtar(privateKey))}`);
} else if (komut === "uret") {
  const kime = arg("kime");
  const bitis = arg("bitis") || null;
  if (!kime) throw new Error("--kime gerekli");
  if (bitis && !/^\d{4}-\d{2}-\d{2}$/.test(bitis)) throw new Error("--bitis YYYY-AA-GG olmalı");
  const ozel = crypto.createPrivateKey(fs.readFileSync(ozelYol));
  console.log(lisansUret(ozel, { kime, bitis }));
} else if (komut === "acik") {
  console.log(b64(acikAnahtar(crypto.createPrivateKey(fs.readFileSync(ozelYol)))));
} else {
  console.error("Kullanım: node scripts/lisans-uret.mjs anahtar-olustur | uret --kime <ad> [--bitis YYYY-AA-GG] | acik");
  process.exit(2);
}
