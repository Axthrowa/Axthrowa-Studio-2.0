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
 * farklı olanlar burada eşlenir. StreamElements ve Fossabot dosyaları önce
 * `disa-aktarim-bicimleri.ts` ile Nightbot biçimine çevrilir; kendi dışa
 * aktarımımız (`kaynak: 'axbot'`) tüm sütunlarıyla geri yüklenir.
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';

export * from './nightbot-map.js';
import { seviyeCevir, sablonCevir, type IceAktarmaSonucu, type NightbotKomut, type NightbotTimer } from './nightbot-map.js';
import { disAktarimiCoz } from './disa-aktarim-bicimleri.js';

const KENDI_TABLOLAR = ['commands', 'timers'] as const;

function sutunlar(tablo: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${tablo})`).all() as Array<{ name: string }>).map((c) => c.name));
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

    const cozulen = disAktarimiCoz(veri);
    if (cozulen.kaynak === 'axbot') return this.kendiDosyamiz(veri, uzerineYaz);
    sonuc.kaynak = cozulen.kaynak;
    sonuc.uyarilar.push(...cozulen.uyarilar);
    const komutlar: NightbotKomut[] = cozulen.komutlar;

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

    const timerlar: NightbotTimer[] = cozulen.zamanlayicilar;
    for (const t of timerlar) {
      const ad = String(t?.name || '').trim();
      const mesaj = String(t?.message || '').trim();
      // Aynı dosya iki kez yüklenince zamanlayıcılar çoğalmasın
      if (!ad || !mesaj || db.prepare('SELECT 1 FROM timers WHERE name = ?').get(ad)) {
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

  /** Kendi komut ve zamanlayıcılarımız: tablonun bütün sütunlarıyla, dosyaya yazılmak üzere. */
  disaAktar() {
    return {
      kaynak: 'axbot' as const,
      surum: 1,
      tarih: new Date().toISOString(),
      commands: db.prepare('SELECT * FROM commands ORDER BY name').all(),
      timers: db.prepare('SELECT * FROM timers ORDER BY name').all()
    };
  }

  /** `disaAktar` dosyasını geri yükler. Yalnız tabloda gerçekten olan sütunlar yazılır; aynı ad `uzerineYaz` yoksa atlanır. */
  private kendiDosyamiz(veri: any, uzerineYaz: boolean): IceAktarmaSonucu {
    const sonuc: IceAktarmaSonucu = { kaynak: 'axbot', komut: { eklenen: 0, atlanan: 0, atlananlar: [] }, zamanlayici: { eklenen: 0, atlanan: 0 }, uyarilar: [] };
    db.exec('BEGIN');
    try {
      for (const tablo of KENDI_TABLOLAR) {
        const izinli = sutunlar(tablo);
        const sayac = tablo === 'commands' ? sonuc.komut : sonuc.zamanlayici;
        for (const satir of Array.isArray(veri?.[tablo]) ? veri[tablo] : []) {
          const ad = String(satir?.name || '').trim();
          if (!ad) {
            sayac.atlanan++;
            continue;
          }
          const mevcut = db.prepare(`SELECT id FROM ${tablo} WHERE LOWER(name) = LOWER(?)`).get(ad) as { id?: string } | undefined;
          if (mevcut && !uzerineYaz) {
            sayac.atlanan++;
            if (tablo === 'commands') sonuc.komut.atlananlar.push(`!${ad}`);
            continue;
          }
          if (mevcut) db.prepare(`DELETE FROM ${tablo} WHERE id = ?`).run(mevcut.id ?? null);
          const kayit: Record<string, any> = {};
          for (const [k, v] of Object.entries(satir)) if (izinli.has(k) && (v === null || ['string', 'number'].includes(typeof v))) kayit[k] = v;
          // Başka adla kayıtlı aynı kimlik varsa yeni kimlik
          if (!kayit.id || db.prepare(`SELECT 1 FROM ${tablo} WHERE id = ?`).get(kayit.id)) kayit.id = crypto.randomUUID();
          const ad_ = Object.keys(kayit);
          db.prepare(`INSERT INTO ${tablo} (${ad_.join(', ')}) VALUES (${ad_.map(() => '?').join(', ')})`).run(...ad_.map((k) => kayit[k]));
          sayac.eklenen++;
        }
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return sonuc;
  }
}

export const nightbot = new NightbotIceAktarma();
export default nightbot;
