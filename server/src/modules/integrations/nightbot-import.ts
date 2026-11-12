/**
 * AxBoT — Nightbot içe aktarma
 * Developed by AxthrowA
 *
 * Örnek alınan botta `Sohbet Botu > Ekstralar > Nightbot'tan içe aktar` var:
 * komutlar, zamanlayıcılar ve moderasyon ayarları taşınıyor
 * (rakip incelemesi). Yeni gelen kullanıcı için en büyük engel
 * mevcut komutlarını kaybetmek; bu yüzden değerli.
 *
 * Nightbot'un dışa aktarma biçimi JSON'dur. Değişken sözdizimi bizimkiyle
 * büyük ölçüde AYNI (`$(user)`, `$(touser)`, `$(count)`, `$(urlfetch)`),
 * farklı olanlar burada eşlenir.
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';

export * from './nightbot-map.js';
import { seviyeCevir, sablonCevir, type IceAktarmaSonucu, type NightbotKomut, type NightbotTimer } from './nightbot-map.js';

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
