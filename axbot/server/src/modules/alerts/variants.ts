/**
 * AxBoT — uyarı varyantları
 * Developed by AxthrowA
 *
 * Örnek alınan botta her olay türü için birden çok "varyant" tanımlanabiliyor
 * (ücretsiz 5, premium 25 — rakip incelemesi). Aynı olay her
 * geldiğinde farklı bir görsel/ses/metin gösterilebiliyor; ayrıca tutara
 * göre farklı varyant seçilebiliyor (büyük bağışa daha görkemli uyarı).
 *
 * Bizde tek bir sabit preset vardı: her abone aynı GIF'i görüyordu.
 *
 * Seçim kuralı:
 *   1. Eşiği tutan varyantlar süzülür (`minDeger` <= olay değeri)
 *   2. En yüksek eşiği tutanlar önceliklidir — büyük bağış küçük varyantı
 *      almasın
 *   3. Aynı öncelikte birden çok varsa AĞIRLIKLI rastgele seçilir
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';

export * from './variant-select.js';
import { varyantSec, VARSAYILAN_VARYANT, type UyariVaryanti } from './variant-select.js';

class VaryantDeposu {
  constructor() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS alert_variants (
        id              TEXT PRIMARY KEY,
        event_type      TEXT NOT NULL,
        ad              TEXT NOT NULL,
        aktif           INTEGER NOT NULL DEFAULT 1,
        min_deger       REAL NOT NULL DEFAULT 0,
        agirlik         REAL NOT NULL DEFAULT 1,
        baslik_sablonu  TEXT NOT NULL DEFAULT '',
        mesaj_sablonu   TEXT NOT NULL DEFAULT '',
        gorsel_url      TEXT NOT NULL DEFAULT '',
        ses_url         TEXT NOT NULL DEFAULT '',
        ses_seviyesi    REAL NOT NULL DEFAULT 0.7,
        sure_ms         INTEGER NOT NULL DEFAULT 5000,
        animasyon       TEXT NOT NULL DEFAULT 'bounce',
        vurgu_rengi     TEXT NOT NULL DEFAULT '#3EEDFE',
        metin_rengi     TEXT NOT NULL DEFAULT '#ffffff'
      );
      CREATE INDEX IF NOT EXISTS idx_alert_variants_event ON alert_variants(event_type);
    `);
  }

  private satirdan(r: any): UyariVaryanti {
    return {
      id: r.id,
      eventType: r.event_type,
      ad: r.ad,
      aktif: !!r.aktif,
      minDeger: Number(r.min_deger) || 0,
      agirlik: Number(r.agirlik) || 1,
      baslikSablonu: r.baslik_sablonu || '',
      mesajSablonu: r.mesaj_sablonu || '',
      gorselUrl: r.gorsel_url || '',
      sesUrl: r.ses_url || '',
      sesSeviyesi: Number(r.ses_seviyesi) ?? 0.7,
      sureMs: Number(r.sure_ms) || 5000,
      animasyon: r.animasyon || 'bounce',
      vurguRengi: r.vurgu_rengi || '#3EEDFE',
      metinRengi: r.metin_rengi || '#ffffff'
    };
  }

  listele(eventType?: string): UyariVaryanti[] {
    const r = eventType
      ? db.prepare('SELECT * FROM alert_variants WHERE event_type = ? ORDER BY min_deger DESC, ad').all(eventType)
      : db.prepare('SELECT * FROM alert_variants ORDER BY event_type, min_deger DESC, ad').all();
    return (r as any[]).map((x) => this.satirdan(x));
  }

  /** Olaya uygun varyant; hiç varyant yoksa `null` (preset kullanılır). */
  sec(eventType: string, deger: number): UyariVaryanti | null {
    return varyantSec(this.listele(eventType), deger);
  }

  kaydet(eventType: string, veri: Partial<UyariVaryanti> & { id?: string }): UyariVaryanti {
    const v = { ...VARSAYILAN_VARYANT, ...veri };
    const id = veri.id || crypto.randomUUID();

    db.prepare(
      `INSERT INTO alert_variants
         (id, event_type, ad, aktif, min_deger, agirlik, baslik_sablonu, mesaj_sablonu,
          gorsel_url, ses_url, ses_seviyesi, sure_ms, animasyon, vurgu_rengi, metin_rengi)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         ad = excluded.ad, aktif = excluded.aktif, min_deger = excluded.min_deger,
         agirlik = excluded.agirlik, baslik_sablonu = excluded.baslik_sablonu,
         mesaj_sablonu = excluded.mesaj_sablonu, gorsel_url = excluded.gorsel_url,
         ses_url = excluded.ses_url, ses_seviyesi = excluded.ses_seviyesi,
         sure_ms = excluded.sure_ms, animasyon = excluded.animasyon,
         vurgu_rengi = excluded.vurgu_rengi, metin_rengi = excluded.metin_rengi`
    ).run(
      id,
      eventType,
      v.ad,
      v.aktif ? 1 : 0,
      v.minDeger,
      v.agirlik,
      v.baslikSablonu,
      v.mesajSablonu,
      v.gorselUrl,
      v.sesUrl,
      v.sesSeviyesi,
      v.sureMs,
      v.animasyon,
      v.vurguRengi,
      v.metinRengi
    );

    return { ...v, id, eventType } as UyariVaryanti;
  }

  sil(id: string): boolean {
    return db.prepare('DELETE FROM alert_variants WHERE id = ?').run(String(id)).changes > 0;
  }
}

export const varyantlar = new VaryantDeposu();
export default varyantlar;
