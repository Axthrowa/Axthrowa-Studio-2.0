/**
 * StreamAxT — uyarı yedekleme (dışa/içe aktarma)
 * Developed by AxthrowA
 *
 * BotRix'te uyarı ayarları bir hesaba bağlı; makine değiştirince panelden
 * geri geliyor. Bizde her şey YEREL SQLite'ta: Windows'u yeniden kuran ya da
 * ikinci bilgisayara geçen kullanıcı bütün uyarı emeğini kaybediyordu
 * (BOTRIX_GAP_ANALYSIS — "alert dışa/içe aktarma yok").
 *
 * Bu modül tek bir JSON dosyasında toplar:
 *   • alert_presets        (olay başına temel uyarı)
 *   • alert_variants       (aynı olayın farklı görünümleri)
 *   • alert-box gelişmiş   (kuyruk, TTS, konfeti, genel ses…)
 *
 * GÜVENLİK: Bu dosya paylaşılabilir olmalı, bu yüzden içine ŞİFRE, TOKEN
 * veya webhook adresi KONULMAZ. Aşağıdaki üç kaynak da yalnız görsel/metin
 * ayarı tutar; yine de içe aktarırken beyaz liste uygulanır — ileride bir
 * alana sır eklenirse yedeğe sızmasın diye.
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';

export const YEDEK_SURUMU = 1;

/** alert_presets içinde dışa aktarılan sütunlar (beyaz liste). */
const PRESET_ALANLARI = [
  'event_type',
  'title_template',
  'message_template',
  'sound_url',
  'image_url',
  'duration_ms',
  'font_family',
  'text_color',
  'accent_color',
  'animation',
  'sound_volume',
  'is_enabled',
  'layout_mode',
  'text_effect'
] as const;

/** alert_variants içinde dışa aktarılan sütunlar (beyaz liste). */
const VARYANT_ALANLARI = [
  'event_type',
  'ad',
  'aktif',
  'min_deger',
  'agirlik',
  'baslik_sablonu',
  'mesaj_sablonu',
  'gorsel_url',
  'ses_url',
  'ses_seviyesi',
  'sure_ms',
  'animasyon',
  'vurgu_rengi',
  'metin_rengi'
] as const;

const GELISMIS_ANAHTARI = 'widget_settings_alert-box';

export interface UyariYedegi {
  surum: number;
  olusturma: number;
  uygulama: 'StreamAxT';
  presets: Array<Record<string, unknown>>;
  varyantlar: Array<Record<string, unknown>>;
  gelismis: Record<string, unknown>;
}

export interface IceAktarmaSonucu {
  ok: boolean;
  hata?: string;
  preset: { eklenen: number; guncellenen: number; atlanan: number };
  varyant: { eklenen: number; atlanan: number };
  gelismis: boolean;
  uyarilar: string[];
}

/** Nesneden yalnız izin verilen anahtarları alır. */
function suz(kaynak: any, alanlar: readonly string[]): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const a of alanlar) if (kaynak?.[a] !== undefined && kaynak?.[a] !== null) c[a] = kaynak[a];
  return c;
}

/**
 * Yerel medya bağlantısı mı?
 * `/api/media/<id>/dosya` başka makinede o kimlik yoksa kırık gelir —
 * sessizce kırık uyarı bırakmaktansa kullanıcıya söylenir.
 */
export function yerelMedyaMi(url: unknown): boolean {
  return typeof url === 'string' && /^\/api\/media\/[0-9a-f-]+\/dosya$/i.test(url);
}

/** Gelen JSON gerçekten bizim yedeğimiz mi? */
export function yedekGecerliMi(veri: any): { ok: true } | { ok: false; hata: string } {
  if (!veri || typeof veri !== 'object') return { ok: false, hata: 'Dosya okunamadı (JSON değil).' };
  if (veri.uygulama !== 'StreamAxT') return { ok: false, hata: 'Bu dosya bir StreamAxT uyarı yedeği değil.' };
  if (Number(veri.surum) > YEDEK_SURUMU) {
    return { ok: false, hata: `Yedek sürümü ${veri.surum}, bu sürüm en fazla ${YEDEK_SURUMU} okuyabiliyor.` };
  }
  if (!Array.isArray(veri.presets) && !Array.isArray(veri.varyantlar)) {
    return { ok: false, hata: 'Yedekte uyarı bulunamadı.' };
  }
  return { ok: true };
}

class UyariYedegiDeposu {
  disaAktar(): UyariYedegi {
    const presets = (db.prepare('SELECT * FROM alert_presets').all() as any[]).map((r) => suz(r, PRESET_ALANLARI));

    let varyantlar: Array<Record<string, unknown>> = [];
    try {
      varyantlar = (db.prepare('SELECT * FROM alert_variants').all() as any[]).map((r) => suz(r, VARYANT_ALANLARI));
    } catch {
      // Tablo henüz oluşmadıysa yedek boş varyantla çıkar
    }

    let gelismis: Record<string, unknown> = {};
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(GELISMIS_ANAHTARI) as
        | { value: string }
        | undefined;
      if (r?.value) gelismis = JSON.parse(r.value);
    } catch {
      /* bozuk JSON — boş bırak */
    }

    return {
      surum: YEDEK_SURUMU,
      olusturma: Date.now(),
      uygulama: 'StreamAxT',
      presets,
      varyantlar,
      gelismis
    };
  }

  /**
   * İçe aktarır.
   *
   * `uzerineYaz` false ise AYNI olay türünde var olan preset atlanır —
   * kullanıcının mevcut emeği sessizce silinmesin.
   *
   * Varyantlar SİLİNMEZ; aynı (olay + ad) ikilisi zaten varsa `uzerineYaz`
   * false iken atlanır, true iken güncellenir. Böylece aynı yedeği iki kez
   * yüklemek listeyi kopyalarla şişirmez (canlı denemede görüldü).
   */
  iceAktar(veri: any, uzerineYaz = false): IceAktarmaSonucu {
    const sonuc: IceAktarmaSonucu = {
      ok: false,
      preset: { eklenen: 0, guncellenen: 0, atlanan: 0 },
      varyant: { eklenen: 0, atlanan: 0 },
      gelismis: false,
      uyarilar: []
    };

    const gecerli = yedekGecerliMi(veri);
    if (!gecerli.ok) {
      sonuc.hata = gecerli.hata;
      return sonuc;
    }

    let yerelMedya = 0;

    for (const ham of Array.isArray(veri.presets) ? veri.presets : []) {
      const p = suz(ham, PRESET_ALANLARI);
      const olay = String(p.event_type || '').trim();
      if (!olay) {
        sonuc.preset.atlanan++;
        continue;
      }
      if (yerelMedyaMi(p.image_url) || yerelMedyaMi(p.sound_url)) yerelMedya++;

      const mevcut = db.prepare('SELECT id FROM alert_presets WHERE event_type = ?').get(olay) as
        | { id: string }
        | undefined;

      if (mevcut && !uzerineYaz) {
        sonuc.preset.atlanan++;
        continue;
      }

      const id = mevcut?.id || `alert-${olay}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      db.prepare(
        `INSERT INTO alert_presets
           (id, event_type, title_template, message_template, sound_url, image_url, duration_ms,
            font_family, text_color, accent_color, animation, sound_volume, is_enabled, layout_mode, text_effect)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           event_type = excluded.event_type,
           title_template = excluded.title_template,
           message_template = excluded.message_template,
           sound_url = excluded.sound_url,
           image_url = excluded.image_url,
           duration_ms = excluded.duration_ms,
           font_family = excluded.font_family,
           text_color = excluded.text_color,
           accent_color = excluded.accent_color,
           animation = excluded.animation,
           sound_volume = excluded.sound_volume,
           is_enabled = excluded.is_enabled,
           layout_mode = excluded.layout_mode,
           text_effect = excluded.text_effect`
      ).run(
        id,
        olay,
        String(p.title_template ?? ''),
        String(p.message_template ?? ''),
        String(p.sound_url ?? ''),
        String(p.image_url ?? ''),
        Number(p.duration_ms) || 5000,
        String(p.font_family ?? 'Plus Jakarta Sans'),
        String(p.text_color ?? '#ffffff'),
        String(p.accent_color ?? '#8b5cf6'),
        String(p.animation ?? 'bounce'),
        Number(p.sound_volume ?? 0.7),
        p.is_enabled ? 1 : 0,
        String(p.layout_mode ?? 'stacked'),
        String(p.text_effect ?? 'shine')
      );

      if (mevcut) sonuc.preset.guncellenen++;
      else sonuc.preset.eklenen++;
    }

    for (const ham of Array.isArray(veri.varyantlar) ? veri.varyantlar : []) {
      const v = suz(ham, VARYANT_ALANLARI);
      const olay = String(v.event_type || '').trim();
      const ad = String(v.ad || '').trim();
      if (!olay || !ad) {
        sonuc.varyant.atlanan++;
        continue;
      }
      if (yerelMedyaMi(v.gorsel_url) || yerelMedyaMi(v.ses_url)) yerelMedya++;

      // Aynı olay + aynı ad = aynı varyant sayılır
      const mevcutVaryant = db
        .prepare('SELECT id FROM alert_variants WHERE event_type = ? AND ad = ?')
        .get(olay, ad) as { id: string } | undefined;

      if (mevcutVaryant && !uzerineYaz) {
        sonuc.varyant.atlanan++;
        continue;
      }

      try {
        db.prepare(
          `INSERT INTO alert_variants
             (id, event_type, ad, aktif, min_deger, agirlik, baslik_sablonu, mesaj_sablonu,
              gorsel_url, ses_url, ses_seviyesi, sure_ms, animasyon, vurgu_rengi, metin_rengi)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             aktif = excluded.aktif,
             min_deger = excluded.min_deger,
             agirlik = excluded.agirlik,
             baslik_sablonu = excluded.baslik_sablonu,
             mesaj_sablonu = excluded.mesaj_sablonu,
             gorsel_url = excluded.gorsel_url,
             ses_url = excluded.ses_url,
             ses_seviyesi = excluded.ses_seviyesi,
             sure_ms = excluded.sure_ms,
             animasyon = excluded.animasyon,
             vurgu_rengi = excluded.vurgu_rengi,
             metin_rengi = excluded.metin_rengi`
        ).run(
          mevcutVaryant?.id || crypto.randomUUID(),
          olay,
          ad,
          v.aktif ? 1 : 0,
          Number(v.min_deger) || 0,
          Number(v.agirlik) || 1,
          String(v.baslik_sablonu ?? ''),
          String(v.mesaj_sablonu ?? ''),
          String(v.gorsel_url ?? ''),
          String(v.ses_url ?? ''),
          Number(v.ses_seviyesi ?? 0.7),
          Number(v.sure_ms) || 5000,
          String(v.animasyon ?? 'bounce'),
          String(v.vurgu_rengi ?? '#3EEDFE'),
          String(v.metin_rengi ?? '#ffffff')
        );
        sonuc.varyant.eklenen++;
      } catch {
        sonuc.varyant.atlanan++;
      }
    }

    if (veri.gelismis && typeof veri.gelismis === 'object') {
      const mevcutRaw = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(GELISMIS_ANAHTARI) as
        | { value: string }
        | undefined;
      let mevcut: Record<string, unknown> = {};
      try {
        mevcut = mevcutRaw?.value ? JSON.parse(mevcutRaw.value) : {};
      } catch {
        mevcut = {};
      }
      db.prepare(
        'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ).run(GELISMIS_ANAHTARI, JSON.stringify({ ...mevcut, ...veri.gelismis }));
      sonuc.gelismis = true;
    }

    if (yerelMedya > 0) {
      sonuc.uyarilar.push(
        `${yerelMedya} uyarı yerel medya kütüphanesine bağlı. Bu dosyalar yedeğin içinde DEĞİL — ` +
          'başka bir bilgisayarda görsel/ses boş görünecektir, medyayı yeniden yükleyin.'
      );
    }
    if (!uzerineYaz && sonuc.preset.atlanan + sonuc.varyant.atlanan > 0) {
      const parca: string[] = [];
      if (sonuc.preset.atlanan) parca.push(`${sonuc.preset.atlanan} uyarı`);
      if (sonuc.varyant.atlanan) parca.push(`${sonuc.varyant.atlanan} varyant`);
      sonuc.uyarilar.push(
        `${parca.join(' ve ')} zaten vardı ve korundu. Üzerine yazmak için "Mevcutların üzerine yaz" seçeneğini işaretleyin.`
      );
    }

    sonuc.ok = true;
    return sonuc;
  }
}

export const uyariYedegi = new UyariYedegiDeposu();
export default uyariYedegi;
