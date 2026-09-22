/**
 * StreamAxT — Nightbot içe aktarma
 * Developed by AxthrowA
 *
 * BotRix'te `Sohbet Botu > Ekstralar > Nightbot'tan içe aktar` var:
 * komutlar, zamanlayıcılar ve moderasyon ayarları taşınıyor
 * (BOTRIX_UI_INVENTORY §6.4). Yeni gelen kullanıcı için en büyük engel
 * mevcut komutlarını kaybetmek; bu yüzden değerli.
 *
 * Nightbot'un dışa aktarma biçimi JSON'dur. Değişken sözdizimi bizimkiyle
 * büyük ölçüde AYNI (`$(user)`, `$(touser)`, `$(count)`, `$(urlfetch)`),
 * farklı olanlar burada eşlenir.
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';

export interface NightbotKomut {
  name?: string;
  message?: string;
  coolDown?: number;
  userLevel?: string;
  alias?: string;
  count?: number;
}

export interface NightbotTimer {
  name?: string;
  message?: string;
  interval?: number;
  lines?: number;
  enabled?: boolean;
}

export interface IceAktarmaSonucu {
  komut: { eklenen: number; atlanan: number; atlananlar: string[] };
  zamanlayici: { eklenen: number; atlanan: number };
  uyarilar: string[];
}

/** Nightbot yetki seviyesini bizimkine çevirir. */
export function seviyeCevir(nb: string | undefined): string {
  const s = String(nb || 'everyone').toLowerCase();
  if (s === 'owner') return 'broadcaster';
  if (s === 'moderator') return 'mod';
  if (s === 'vip') return 'vip';
  if (s === 'subscriber' || s === 'regular') return 'sub';
  return 'everyone';
}

/**
 * Nightbot şablonunu bizim değişken sözdizimimize çevirir.
 *
 * Çoğu değişken zaten aynı; farklı olanlar ve DESTEKLENMEYENLER eşlenir.
 * Desteklenmeyen bir değişken varsa uyarı döner — sessizce bozuk komut
 * oluşturmaktansa kullanıcı bilsin.
 */
export function sablonCevir(ham: string): { metin: string; uyarilar: string[] } {
  let t = String(ham || '');
  const uyarilar: string[] = [];

  // Bizde farklı adla var
  const esleme: Array<[RegExp, string]> = [
    [/\$\(user\)/gi, '$(sender)'],
    [/\$\(channel\)/gi, '$(channel)'],
    [/\$\(querystring\)/gi, '$(urlencode $(variable))'],
    [/\$\(query\)/gi, '$(variable)'],
    [/\$\(touser\)/gi, '$(toname)'],
    [/\$\(eval\s/gi, '$(math ']
  ];
  for (const [re, yeni] of esleme) t = t.replace(re, yeni);

  // Karşılığı olmayanlar
  const desteklenmeyen: Array<[RegExp, string]> = [
    [/\$\(twitch\s/i, '$(twitch ...) — Twitch kanal bilgisi değişkeni desteklenmiyor'],
    [/\$\(weather\s/i, '$(weather ...) — hava durumu değişkeni desteklenmiyor'],
    [/\$\(customapi\s/i, '$(customapi ...) → $(urlfetch ...) olarak değiştirin']
  ];
  for (const [re, mesaj] of desteklenmeyen) {
    if (re.test(t)) uyarilar.push(mesaj);
  }

  return { metin: t, uyarilar };
}

class NightbotIceAktarma {
  /**
   * Gelen JSON'u içe aktarır.
   *
   * `uzerineYaz` false ise AYNI ADLI komut atlanır — kullanıcının mevcut
   * komutları sessizce ezilmesin.
   */
  aktar(veri: any, uzerineYaz = false): IceAktarmaSonucu {
    const sonuc: IceAktarmaSonucu = {
      komut: { eklenen: 0, atlanan: 0, atlananlar: [] },
      zamanlayici: { eklenen: 0, atlanan: 0 },
      uyarilar: []
    };

    const komutlar: NightbotKomut[] = Array.isArray(veri?.commands)
      ? veri.commands
      : Array.isArray(veri)
        ? veri
        : [];

    for (const k of komutlar) {
      const ad = String(k?.name || '').replace(/^!/, '').trim().toLowerCase();
      const yanitHam = String(k?.message || '').trim();
      if (!ad || !yanitHam) {
        sonuc.komut.atlanan++;
        continue;
      }

      const mevcut = db.prepare('SELECT id FROM commands WHERE LOWER(name) = ?').get(ad) as { id?: string } | undefined;
      if (mevcut && !uzerineYaz) {
        sonuc.komut.atlanan++;
        sonuc.komut.atlananlar.push(`!${ad}`);
        continue;
      }

      const { metin, uyarilar } = sablonCevir(yanitHam);
      for (const u of uyarilar) {
        const tam = `!${ad}: ${u}`;
        if (!sonuc.uyarilar.includes(tam)) sonuc.uyarilar.push(tam);
      }

      if (mevcut?.id) {
        db.prepare('UPDATE commands SET response = ?, user_level = ?, cooldown = ? WHERE id = ?').run(
          metin,
          seviyeCevir(k?.userLevel),
          Math.max(0, Number(k?.coolDown) || 5),
          mevcut.id
        );
      } else {
        db.prepare(
          'INSERT INTO commands (id, name, response, user_level, cooldown, aliases, is_enabled) VALUES (?,?,?,?,?,?,1)'
        ).run(
          crypto.randomUUID(),
          ad,
          metin,
          seviyeCevir(k?.userLevel),
          Math.max(0, Number(k?.coolDown) || 5),
          k?.alias ? String(k.alias).replace(/^!/, '') : null
        );
      }
      sonuc.komut.eklenen++;
    }

    const timerlar: NightbotTimer[] = Array.isArray(veri?.timers) ? veri.timers : [];
    for (const t of timerlar) {
      const ad = String(t?.name || '').trim();
      const mesaj = String(t?.message || '').trim();
      if (!ad || !mesaj) {
        sonuc.zamanlayici.atlanan++;
        continue;
      }
      const { metin } = sablonCevir(mesaj);
      db.prepare(
        'INSERT INTO timers (id, name, messages, interval_minutes, min_chat_lines, is_enabled) VALUES (?,?,?,?,?,?)'
      ).run(
        crypto.randomUUID(),
        ad,
        JSON.stringify([metin]),
        // Nightbot saniye tutar, biz dakika
        Math.max(1, Math.round((Number(t?.interval) || 300) / 60)),
        Math.max(0, Number(t?.lines) || 5),
        t?.enabled === false ? 0 : 1
      );
      sonuc.zamanlayici.eklenen++;
    }

    return sonuc;
  }
}

export const nightbot = new NightbotIceAktarma();
export default nightbot;
