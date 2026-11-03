/**
 * Bu bilgisayarda kayıtlı Client ID'leri pakete ekler: cikti/streamaxt/varsayilan-kimlikler.json.
 * Yalnız Client ID (Kick, Spotify); Client Secret, token ve parola asla alınmaz. Değerler ekrana yazılmaz.
 * Kaynak: uygulamanın kendi ayar dosyaları (kick-oauth.json, music.json).
 */
import fs from "node:fs";
import path from "node:path";

const veri = path.join(process.env.APPDATA || "", "com.axthrowa.yayin-yonetim-araci");
const hedef = process.argv[2] || "cikti/streamaxt/varsayilan-kimlikler.json";

function oku(ad) {
  try {
    return JSON.parse(fs.readFileSync(path.join(veri, ad), "utf8"));
  } catch {
    return {};
  }
}

const kimlikler = {};
const kick = oku("kick-oauth.json").clientId;
const spotify = oku("music.json").spotify?.clientId;
if (typeof kick === "string" && kick) kimlikler.kick_client_id = kick;
if (typeof spotify === "string" && spotify) kimlikler.spotify_client_id = spotify;

fs.mkdirSync(path.dirname(hedef), { recursive: true });
fs.writeFileSync(hedef, JSON.stringify(kimlikler, null, 2));
console.log(`Client ID eklendi: ${Object.keys(kimlikler).join(", ") || "(kayıtlı yok)"}`);
