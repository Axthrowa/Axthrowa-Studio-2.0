/**
 * AxBoT — açılışta sır kasası hazırlığı (S6)
 * Developed by AxthrowA
 *
 * 1) Şifreli tüm değerleri TEK PowerShell çağrısıyla çözüp önbelleğe alır;
 *    platformlar bağlanırken her token için ayrı ~1 sn beklenmez.
 * 2) Hâlâ DÜZ METİN duran sırları (eski sürümden kalan) şifreler.
 *    Yalnız gidiş-dönüş doğrulaması tutan değerler değiştirilir; tutmayan
 *    değer olduğu gibi kalır — geçiş hiçbir token'ı bozamaz.
 *
 * Günlüğe DEĞER yazılmaz, yalnız sayılar.
 */
import { db, hamSorgu } from '../../db/index.js';
import { onbellegeAl, onekliMi, sifrelemeAcikMi, topluSifrele } from './vault.js';
import { gizliMi } from './redact.js';

export function sirlariHazirla(): { onbellek: number; gecirilen: number } {
  let kanallar: Array<{ id: string; token: unknown; refresh_token: unknown }> = [];
  let ayarlar: Array<{ key: string; value: unknown }> = [];
  try {
    kanallar = hamSorgu('SELECT id, token, refresh_token FROM channels').all() as any[];
    ayarlar = hamSorgu('SELECT key, value FROM bot_settings').all() as any[];
  } catch (e) {
    console.warn('[Kasa] Sır tabloları okunamadı:', e);
    return { onbellek: 0, gecirilen: 0 };
  }

  // Discord webhook'ları JSON'un içinde
  const discordSatiri = ayarlar.find((a) => a.key === 'discord_announce');
  let discord: Record<string, any> | null = null;
  try {
    discord = discordSatiri?.value ? JSON.parse(String(discordSatiri.value)) : null;
  } catch {
    discord = null;
  }
  const webhooklar = discord ? Object.values(discord).map((k: any) => k?.webhook) : [];

  // 1) Önbellek
  const tumu = [...kanallar.flatMap((k) => [k.token, k.refresh_token]), ...ayarlar.map((a) => a.value), ...webhooklar];
  const sifreliSayisi = tumu.filter(onekliMi).length;
  onbellegeAl(tumu);

  // 2) Düz kalanları şifrele
  if (!sifrelemeAcikMi()) return { onbellek: sifreliSayisi, gecirilen: 0 };
  const duz = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && !onekliMi(v);

  const adaylar: string[] = [];
  for (const k of kanallar) {
    if (duz(k.token)) adaylar.push(k.token);
    if (duz(k.refresh_token)) adaylar.push(k.refresh_token);
  }
  for (const a of ayarlar) if (gizliMi(a.key) && duz(a.value)) adaylar.push(a.value);
  for (const w of webhooklar) if (duz(w)) adaylar.push(w);
  if (!adaylar.length) return { onbellek: sifreliSayisi, gecirilen: 0 };

  const harita = topluSifrele(adaylar);
  if (!harita.size) return { onbellek: sifreliSayisi, gecirilen: 0 };

  let gecirilen = 0;
  const sec = (v: unknown) => (duz(v) && harita.has(v) ? harita.get(v)! : v);
  db.exec('BEGIN');
  try {
    const kanalGuncelle = db.prepare('UPDATE channels SET token = ?, refresh_token = ? WHERE id = ?');
    for (const k of kanallar) {
      const t = sec(k.token);
      const r = sec(k.refresh_token);
      if (t !== k.token || r !== k.refresh_token) {
        kanalGuncelle.run(t as any, r as any, k.id);
        gecirilen += Number(t !== k.token) + Number(r !== k.refresh_token);
      }
    }
    const ayarGuncelle = db.prepare('UPDATE bot_settings SET value = ? WHERE key = ?');
    for (const a of ayarlar) {
      if (!gizliMi(a.key)) continue;
      const v = sec(a.value);
      if (v !== a.value) {
        ayarGuncelle.run(v as any, a.key);
        gecirilen++;
      }
    }
    if (discord) {
      let degisti = false;
      for (const k of Object.keys(discord)) {
        const v = sec(discord[k]?.webhook);
        if (v !== discord[k]?.webhook) {
          discord[k] = { ...discord[k], webhook: v };
          degisti = true;
          gecirilen++;
        }
      }
      if (degisti) ayarGuncelle.run(JSON.stringify(discord), 'discord_announce');
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    console.warn('[Kasa] Geçiş geri alındı, sırlar olduğu gibi kaldı:', e);
    return { onbellek: sifreliSayisi, gecirilen: 0 };
  }

  console.log(`[Kasa] ${gecirilen} sır diskte şifrelendi (Windows DPAPI).`);
  return { onbellek: sifreliSayisi, gecirilen };
}
