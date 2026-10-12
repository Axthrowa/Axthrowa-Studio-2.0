/**
 * StreamAxT — Ses/Video Panosu (Blerp tarzı) hizmeti
 * Developed by AxthrowA
 *
 * Yayıncı kendi ses ve videolarını medya kütüphanesine yükler, panoya öğe olarak ekler; izleyiciler sohbetten
 * `!ses <ad>` ile bot puanı harcayarak oynatır. İstekler sıraya girer, katman (/widgets/pano, tarayıcı kaynağı)
 * sırayla oynatır ve bitince bildirir; katman yoksa süre sınırı dolunca sıradaki başlar. Yayıncı/mod atlatır,
 * duraklatır, temizler (oynamamış isteklerin puanı iade edilir). Giriş sesi: izleyicinin o günkü ilk mesajında.
 *
 * Platform kanal puanı ödülleri bu sürümde bağlı değil: Kick ödül olayı yalnız webhook'la gelir (herkese açık adres
 * gerekir), Twitch için EventSub gerekir — ikisi de StreamAxT'te yok (KNOWN_LIMITATIONS).
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';
import { medya } from '../media/media.js';
import { economy } from '../economy/economy.js';
import type { ChatMessagePayload } from '../../core/event-bus.js';
import {
  ayarlariDuzelt,
  beklemeKalan,
  gunAnahtari,
  istekBul,
  komutNormalize,
  kovadanSec,
  sureSiniri,
  yetkiVar,
  type PanoAyarlari,
  type PanoKovasi,
  type PanoOgesi,
  type PanoYetki
} from './mantik.js';

export interface KuyrukOgesi {
  id: string;
  ogeId: string;
  ad: string;
  tur: 'audio' | 'video';
  medyaUrl: string;
  gorselUrl: string | null;
  ses: number;
  sureSn: number;
  kullanici: string;
  platform: string;
  /** Oynamadan silinirse iade edilecek puan */
  odenen: number;
  kaynak: 'komut' | 'panel' | 'giris';
}

type Yayinci = (payload: any) => void;

const AYAR_ANAHTARI = 'pano_ayarlari';

export class SesPanosu {
  private kuyruk: KuyrukOgesi[] = [];
  private calan: KuyrukOgesi | null = null;
  private duraklatildi = false;
  private zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private genelSon: number | undefined;
  private hedefSon = new Map<string, number>();
  private kullaniciSon = new Map<string, number>();
  private yayinci: Yayinci = () => {};

  constructor() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pano_ogeleri (
        id                  TEXT PRIMARY KEY,
        ad                  TEXT NOT NULL,
        komut               TEXT NOT NULL,
        medya_id            TEXT NOT NULL,
        tur                 TEXT NOT NULL,
        gorsel_id           TEXT,
        ses                 INTEGER NOT NULL DEFAULT 80,
        maks_sure_sn        INTEGER NOT NULL DEFAULT 0,
        maliyet             INTEGER NOT NULL DEFAULT 100,
        bekleme_sn          INTEGER NOT NULL DEFAULT 10,
        kullanici_bekleme_sn INTEGER NOT NULL DEFAULT 30,
        yetki               TEXT NOT NULL DEFAULT 'herkes',
        kova_id             TEXT,
        agirlik             INTEGER NOT NULL DEFAULT 1,
        etkin               INTEGER NOT NULL DEFAULT 1,
        sira                INTEGER NOT NULL DEFAULT 0,
        olusturma           INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pano_kovalari (
        id         TEXT PRIMARY KEY,
        ad         TEXT NOT NULL,
        komut      TEXT NOT NULL,
        maliyet    INTEGER NOT NULL DEFAULT 100,
        bekleme_sn INTEGER NOT NULL DEFAULT 10,
        etkin      INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS pano_giris_sesleri (
        kullanici  TEXT PRIMARY KEY,
        oge_id     TEXT NOT NULL,
        son_gun    TEXT
      );
      CREATE TABLE IF NOT EXISTS pano_gecmis (
        id        TEXT PRIMARY KEY,
        zaman     INTEGER NOT NULL,
        kullanici TEXT NOT NULL,
        platform  TEXT NOT NULL,
        oge_id    TEXT NOT NULL,
        ad        TEXT NOT NULL,
        maliyet   INTEGER NOT NULL,
        kaynak    TEXT NOT NULL
      );
    `);
  }

  /** WebSocket yayını (ws/server.ts bağlar; testte bağlanmaz) */
  yayinciBagla(f: Yayinci) {
    this.yayinci = f;
  }

  // ── Ayarlar ──
  ayarlar(): PanoAyarlari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as any;
      return ayarlariDuzelt(r?.value ? JSON.parse(r.value) : undefined);
    } catch {
      return ayarlariDuzelt(undefined);
    }
  }

  ayarlariYaz(g: any): PanoAyarlari {
    const a = ayarlariDuzelt({ ...this.ayarlar(), ...g, gorunum: { ...this.ayarlar().gorunum, ...(g?.gorunum ?? {}) } });
    db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(AYAR_ANAHTARI, JSON.stringify(a));
    this.durumYayinla();
    return a;
  }

  // ── Öğeler ──
  private satirdanOge(r: any): PanoOgesi {
    return {
      id: r.id,
      ad: r.ad,
      komut: r.komut,
      medyaId: r.medya_id,
      tur: r.tur === 'video' ? 'video' : 'audio',
      gorselId: r.gorsel_id ?? null,
      ses: r.ses,
      maksSureSn: r.maks_sure_sn,
      maliyet: r.maliyet,
      beklemeSn: r.bekleme_sn,
      kullaniciBeklemeSn: r.kullanici_bekleme_sn,
      yetki: (['herkes', 'abone', 'mod'].includes(r.yetki) ? r.yetki : 'herkes') as PanoYetki,
      kovaId: r.kova_id ?? null,
      agirlik: r.agirlik,
      etkin: !!r.etkin,
      sira: r.sira
    };
  }

  ogeler(): PanoOgesi[] {
    return (db.prepare('SELECT * FROM pano_ogeleri ORDER BY sira, olusturma').all() as any[]).map((r) => this.satirdanOge(r));
  }

  kovalar(): PanoKovasi[] {
    return (db.prepare('SELECT * FROM pano_kovalari ORDER BY ad').all() as any[]).map((r) => ({
      id: r.id,
      ad: r.ad,
      komut: r.komut,
      maliyet: r.maliyet,
      beklemeSn: r.bekleme_sn,
      etkin: !!r.etkin
    }));
  }

  /** Öğe ekler ya da günceller. Medya kütüphanede olmalı (ses ya da video); görsel isteğe bağlı (yalnız görsel) */
  ogeYaz(g: any): { ok: true; oge: PanoOgesi } | { ok: false; hata: string } {
    const ad = String(g?.ad ?? '').trim().slice(0, 60);
    const komut = komutNormalize(g?.komut || ad);
    if (!ad || !komut) return { ok: false, hata: 'Ad gerekli' };
    const m = medya.bul(String(g?.medyaId ?? ''));
    if (!m || (m.tur !== 'audio' && m.tur !== 'video')) return { ok: false, hata: 'Medya kütüphanesinden bir ses ya da video seçin' };
    let gorselId: string | null = null;
    if (g?.gorselId) {
      const gr = medya.bul(String(g.gorselId));
      if (!gr || gr.tur !== 'image') return { ok: false, hata: 'Görsel yalnız resim/GIF olabilir' };
      gorselId = gr.id;
    }
    const id = String(g?.id || `pano_${crypto.randomUUID()}`);
    const cakisan = db.prepare('SELECT id FROM pano_ogeleri WHERE komut = ? AND id != ?').get(komut, id) as any;
    if (cakisan) return { ok: false, hata: `"${komut}" adı başka bir öğede kullanılıyor` };
    const kova = g?.kovaId ? String(g.kovaId) : null;
    if (kova && !db.prepare('SELECT id FROM pano_kovalari WHERE id = ?').get(kova)) return { ok: false, hata: 'Kova bulunamadı' };
    const n = (x: unknown, alt: number, ust: number, v: number) => {
      const s = Number(x);
      return Number.isFinite(s) ? Math.min(ust, Math.max(alt, Math.round(s))) : v;
    };
    const yetki = ['herkes', 'abone', 'mod'].includes(g?.yetki) ? g.yetki : 'herkes';
    const varOlan = db.prepare('SELECT olusturma, sira FROM pano_ogeleri WHERE id = ?').get(id) as any;
    db.prepare(`
      INSERT INTO pano_ogeleri (id, ad, komut, medya_id, tur, gorsel_id, ses, maks_sure_sn, maliyet, bekleme_sn, kullanici_bekleme_sn, yetki, kova_id, agirlik, etkin, sira, olusturma)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET ad = excluded.ad, komut = excluded.komut, medya_id = excluded.medya_id, tur = excluded.tur,
        gorsel_id = excluded.gorsel_id, ses = excluded.ses, maks_sure_sn = excluded.maks_sure_sn, maliyet = excluded.maliyet,
        bekleme_sn = excluded.bekleme_sn, kullanici_bekleme_sn = excluded.kullanici_bekleme_sn, yetki = excluded.yetki,
        kova_id = excluded.kova_id, agirlik = excluded.agirlik, etkin = excluded.etkin
    `).run(
      id,
      ad,
      komut,
      m.id,
      m.tur,
      gorselId,
      n(g?.ses, 0, 100, 80),
      n(g?.maksSureSn, 0, 120, 0),
      n(g?.maliyet, 0, 1_000_000, 100),
      n(g?.beklemeSn, 0, 3600, 10),
      n(g?.kullaniciBeklemeSn, 0, 86400, 30),
      yetki,
      kova,
      n(g?.agirlik, 1, 100, 1),
      g?.etkin === undefined ? 1 : g.etkin ? 1 : 0,
      varOlan?.sira ?? this.ogeler().length,
      varOlan?.olusturma ?? Date.now()
    );
    return { ok: true, oge: this.ogeler().find((o) => o.id === id)! };
  }

  ogeSil(id: string): boolean {
    db.prepare('DELETE FROM pano_giris_sesleri WHERE oge_id = ?').run(id);
    return db.prepare('DELETE FROM pano_ogeleri WHERE id = ?').run(id).changes > 0;
  }

  kovaYaz(g: any): { ok: true; kova: PanoKovasi } | { ok: false; hata: string } {
    const ad = String(g?.ad ?? '').trim().slice(0, 60);
    const komut = komutNormalize(g?.komut || ad);
    if (!ad || !komut) return { ok: false, hata: 'Ad gerekli' };
    if (db.prepare('SELECT id FROM pano_ogeleri WHERE komut = ?').get(komut)) return { ok: false, hata: `"${komut}" adı bir öğede kullanılıyor` };
    const id = String(g?.id || `kova_${crypto.randomUUID()}`);
    const n = (x: unknown, ust: number, v: number) => {
      const s = Number(x);
      return Number.isFinite(s) ? Math.min(ust, Math.max(0, Math.round(s))) : v;
    };
    db.prepare(`
      INSERT INTO pano_kovalari (id, ad, komut, maliyet, bekleme_sn, etkin) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET ad = excluded.ad, komut = excluded.komut, maliyet = excluded.maliyet, bekleme_sn = excluded.bekleme_sn, etkin = excluded.etkin
    `).run(id, ad, komut, n(g?.maliyet, 1_000_000, 100), n(g?.beklemeSn, 3600, 10), g?.etkin === undefined ? 1 : g.etkin ? 1 : 0);
    return { ok: true, kova: this.kovalar().find((k) => k.id === id)! };
  }

  kovaSil(id: string): boolean {
    db.prepare('UPDATE pano_ogeleri SET kova_id = NULL WHERE kova_id = ?').run(id);
    return db.prepare('DELETE FROM pano_kovalari WHERE id = ?').run(id).changes > 0;
  }

  // ── Giriş sesleri ──
  girisSesleri(): { kullanici: string; ogeId: string }[] {
    return (db.prepare('SELECT kullanici, oge_id FROM pano_giris_sesleri ORDER BY kullanici').all() as any[]).map((r) => ({ kullanici: r.kullanici, ogeId: r.oge_id }));
  }

  girisSesiYaz(kullanici: string, ogeId: string | null): boolean {
    const k = String(kullanici ?? '').trim().replace(/^@/, '').toLowerCase();
    if (!k) return false;
    if (!ogeId) return db.prepare('DELETE FROM pano_giris_sesleri WHERE kullanici = ?').run(k).changes > 0;
    if (!db.prepare('SELECT id FROM pano_ogeleri WHERE id = ?').get(ogeId)) return false;
    db.prepare('INSERT INTO pano_giris_sesleri (kullanici, oge_id, son_gun) VALUES (?, ?, NULL) ON CONFLICT(kullanici) DO UPDATE SET oge_id = excluded.oge_id').run(k, ogeId);
    return true;
  }

  /** Sohbet iletisi: kullanıcının giriş sesi varsa ve bugün çalmadıysa sıraya girer (ücretsiz, beklemesiz) */
  girisKontrol(m: ChatMessagePayload, simdi = Date.now()) {
    const a = this.ayarlar();
    if (!a.etkin || !a.girisSesleri || m.user.isSelf) return;
    const k = String(m.user.username || '').toLowerCase();
    const r = db.prepare('SELECT oge_id, son_gun FROM pano_giris_sesleri WHERE kullanici = ?').get(k) as any;
    const gun = gunAnahtari(simdi);
    if (!r || r.son_gun === gun) return;
    const oge = this.ogeler().find((o) => o.id === r.oge_id && o.etkin);
    if (!oge) return;
    db.prepare('UPDATE pano_giris_sesleri SET son_gun = ? WHERE kullanici = ?').run(gun, k);
    this.siraya(oge, m.user.displayName || k, m.platform, 0, 'giris');
  }

  // ── İstekler ──
  /** Sohbet komutu `!ses <ad>`: yetki, bekleme, bedel denetlenir. Dönüş: sohbete yazılacak yanıt */
  sohbetIstegi(m: ChatMessagePayload, ad: string, simdi = Date.now(), rastgele: () => number = Math.random): string {
    const a = this.ayarlar();
    const kim = m.user.displayName || m.user.username;
    if (!a.etkin) return `@${kim}, ses panosu şu an kapalı.`;
    if (!ad.trim()) return `@${kim}, kullanım: !ses <ad> — liste için !sesler`;
    const bulunan = istekBul(this.ogeler(), this.kovalar(), ad);
    if (!bulunan) return `@${kim}, "${ad}" adlı ses yok. Liste: !sesler`;
    if (this.kuyruk.length >= a.kuyrukSiniri) return `@${kim}, sıra dolu, biraz sonra tekrar dene.`;
    const hedefId = bulunan.tur === 'oge' ? bulunan.oge.id : bulunan.kova.id;
    const oge = bulunan.tur === 'oge' ? bulunan.oge : kovadanSec(this.ogeler(), bulunan.kova.id, rastgele);
    if (!oge) return `@${kim}, bu kovada çalınabilir ses yok.`;
    if (bulunan.tur === 'oge' && !yetkiVar(oge.yetki, m.user)) return `@${kim}, bu ses ${oge.yetki === 'mod' ? 'yalnız moderatörlere' : 'yalnız abonelere'} açık.`;
    const kullaniciAnahtar = `${m.platform}:${String(m.user.username).toLowerCase()}`;
    const ayricalikli = m.user.isMod || m.user.isBroadcaster;
    if (!ayricalikli) {
      const b = beklemeKalan({
        simdi,
        genelSon: this.genelSon,
        hedefSon: this.hedefSon.get(hedefId),
        kullaniciSon: this.kullaniciSon.get(kullaniciAnahtar),
        genelBeklemeSn: a.genelBeklemeSn,
        hedefBeklemeSn: bulunan.tur === 'oge' ? oge.beklemeSn : bulunan.kova.beklemeSn,
        kullaniciBeklemeSn: oge.kullaniciBeklemeSn
      });
      if (b.kalanSn > 0) return `@${kim}, ${b.neden === 'kullanici' ? 'tekrar istemek için' : 'bu ses için'} ${b.kalanSn} sn bekle.`;
    }
    const bedel = ayricalikli && a.modlarUcretsiz ? 0 : bulunan.tur === 'oge' ? oge.maliyet : bulunan.kova.maliyet;
    if (bedel > 0) {
      const bakiye = economy.getUserPoints(m.user.username);
      if (bakiye < bedel) return `@${kim}, yeterli puanın yok: gereken ${bedel}, bakiyen ${bakiye}.`;
      economy.removePoints(m.user.username, bedel);
    }
    this.genelSon = simdi;
    this.hedefSon.set(hedefId, simdi);
    this.kullaniciSon.set(kullaniciAnahtar, simdi);
    const sira = this.siraya(oge, kim, m.platform, bedel, 'komut', m.user.username);
    const sonek = bedel > 0 ? ` (−${bedel} puan)` : '';
    return sira > 0 ? `🔊 ${kim} → "${oge.ad}" sıraya alındı (${sira}. sırada)${sonek}` : `🔊 ${kim} → "${oge.ad}"${sonek}`;
  }

  /** `!sesler`: oynatılabilir adlar (en çok 25) */
  listeMetni(): string {
    const ad = [...this.ogeler().filter((o) => o.etkin && !o.kovaId).map((o) => `${o.komut}${o.maliyet ? `(${o.maliyet})` : ''}`), ...this.kovalar().filter((k) => k.etkin).map((k) => `${k.komut}🎲(${k.maliyet})`)];
    if (!ad.length) return 'Ses panosunda henüz ses yok.';
    return `🔊 Sesler: ${ad.slice(0, 25).join(', ')}${ad.length > 25 ? ' …' : ''} — kullanım: !ses <ad>`;
  }

  /** Panelden oynatma (bedelsiz, beklemesiz) */
  panelOynat(ogeId: string): { ok: boolean; hata?: string } {
    const oge = this.ogeler().find((o) => o.id === ogeId);
    if (!oge) return { ok: false, hata: 'Öğe yok' };
    this.siraya(oge, 'Yayıncı', 'panel', 0, 'panel');
    return { ok: true };
  }

  /** Sıraya ekler; dönüş: kaçıncı sırada (0 = hemen çalıyor) */
  private siraya(oge: PanoOgesi, kullanici: string, platform: string, odenen: number, kaynak: KuyrukOgesi['kaynak'], hesap?: string): number {
    const m = medya.bul(oge.medyaId);
    if (!m) return -1;
    const gorsel = oge.gorselId ? medya.bul(oge.gorselId) : null;
    const k: KuyrukOgesi & { hesap?: string } = {
      id: `istek_${crypto.randomUUID()}`,
      ogeId: oge.id,
      ad: oge.ad,
      tur: oge.tur,
      medyaUrl: m.url,
      gorselUrl: gorsel?.url ?? null,
      ses: oge.ses,
      sureSn: sureSiniri(oge, this.ayarlar()),
      kullanici,
      platform,
      odenen,
      kaynak,
      hesap
    };
    this.kuyruk.push(k);
    try {
      db.prepare('INSERT INTO pano_gecmis (id, zaman, kullanici, platform, oge_id, ad, maliyet, kaynak) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        k.id,
        Date.now(),
        kullanici,
        platform,
        oge.id,
        oge.ad,
        odenen,
        kaynak
      );
    } catch {
      /* geçmiş yazılamazsa oynatma sürer */
    }
    const sira = this.calan ? this.kuyruk.length : this.kuyruk.length - 1;
    this.ilerle();
    return sira;
  }

  private ilerle() {
    if (this.calan || this.duraklatildi || !this.kuyruk.length) {
      this.durumYayinla();
      return;
    }
    this.calan = this.kuyruk.shift()!;
    const a = this.ayarlar();
    this.yayinci({ type: 'pano_oynat', oge: this.calan, gorunum: a.gorunum });
    // Katman bildirmezse (kapalı/yok) süre sınırı + pay dolunca sıradaki başlar
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    const id = this.calan.id;
    this.zamanlayici = setTimeout(() => this.bitti(id), (this.calan.sureSn + 3) * 1000);
    this.durumYayinla();
  }

  /** Katman "bitti" bildirdi (ya da zaman aşımı) */
  bitti(id: string) {
    if (this.calan?.id !== id) return;
    this.calan = null;
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    this.zamanlayici = null;
    this.ilerle();
  }

  /** Yayıncı/mod denetimi */
  kontrol(eylem: string): { ok: boolean; hata?: string } {
    if (eylem === 'atla') {
      if (this.calan) {
        this.yayinci({ type: 'pano_durdur', id: this.calan.id });
        this.bitti(this.calan.id);
      }
    } else if (eylem === 'duraklat') {
      this.duraklatildi = true;
    } else if (eylem === 'devam') {
      this.duraklatildi = false;
      this.ilerle();
    } else if (eylem === 'temizle') {
      // Oynamamış isteklerin bedeli iade edilir
      for (const k of this.kuyruk as (KuyrukOgesi & { hesap?: string })[]) {
        if (k.odenen > 0 && k.hesap) economy.addPoints(k.hesap, k.odenen);
      }
      this.kuyruk = [];
    } else {
      return { ok: false, hata: 'bilinmeyen eylem' };
    }
    this.durumYayinla();
    return { ok: true };
  }

  durum() {
    return { calan: this.calan, kuyruk: this.kuyruk, duraklatildi: this.duraklatildi, ayarlar: this.ayarlar() };
  }

  gecmis(adet = 50) {
    return db.prepare('SELECT * FROM pano_gecmis ORDER BY zaman DESC LIMIT ?').all(Math.min(500, Math.max(1, adet)));
  }

  private durumYayinla() {
    this.yayinci({ type: 'pano_durum', durum: { calan: this.calan, kuyruk: this.kuyruk, duraklatildi: this.duraklatildi } });
  }
}

export const sesPanosu = new SesPanosu();
export default sesPanosu;
