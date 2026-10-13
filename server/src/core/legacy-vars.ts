/**
 * StreamAxT — eski `{user}` biçimi: izleyici değerlerinin yerleştirilmesi (saf)
 * Developed by AxthrowA
 *
 * GÜVENLİK (4. tur): `variable-parser.ts` izleyici metnini ({query}, {user},
 * $(1)…) şablona koyup SONRA aynı metin üzerinde `{count:ad}`, `$(urlfetch)`,
 * `$(ai …)` gibi adımları çalıştırıyordu; ardından yeni motor da metni
 * tarıyordu. İzleyici `!komut $(urlfetch http://127.0.0.1:3001/api/…)` yazarak
 * yerel API'nin yanıtını sohbete döktürebiliyor, `{count:x}` ile veritabanına
 * yazabiliyor, `$(ai …)` ile yapay zekâ kotası tüketebiliyordu. Ayrıca değer
 * `String.replace`'e yerine koyma DİZGESİ olarak veriliyordu: izleyicinin
 * yazdığı `$&` kalıp sayılıyordu.
 *
 * Değerler `veriKacisla` ile veri olarak işaretlenip FONKSİYONLA yerleştirilir;
 * işaretler zincirin sonunda (yeni motor `coz`) geri alınır.
 */
import { veriKacisla } from './variables/resolve.js';

export interface KullaniciDegerleri {
  user: string;
  targetUser: string;
  rawArgs: string;
  args: string[];
  platform: string;
  uptime: string;
}

export function kullaniciDegerleriniYerlestir(sablon: string, d: KullaniciDegerleri): string {
  const k = (s: string) => veriKacisla(String(s ?? ''));
  const yerlestir = (metin: string, re: RegExp, deger: string) => metin.replace(re, () => k(deger));

  let s = String(sablon ?? '');
  s = yerlestir(s, /\{user\}|\$\(user\)/gi, d.user);
  s = yerlestir(s, /\{touser\}|\$\(touser\)/gi, d.targetUser);
  s = yerlestir(s, /\{query\}|\$\(query\)/gi, d.rawArgs);
  s = yerlestir(s, /\{args\}|\$\(args\)/gi, d.rawArgs);
  s = yerlestir(s, /\{uptime\}|\$\(uptime\)/gi, d.uptime);
  s = yerlestir(s, /\{platform\}|\$\(platform\)/gi, String(d.platform || '').toUpperCase());
  // $(1)…$(9) ve {1}…{9}
  s = s.replace(/\$\(([1-9])\)|\{([1-9])\}/g, (_m, a, b) => k(d.args[Number(a || b) - 1] || ''));
  return s;
}
