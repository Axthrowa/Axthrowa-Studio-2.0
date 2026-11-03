/**
 * AxBoT — Sesli komutlar hizmeti
 * Developed by AxthrowA
 *
 * Konuşma tanıma tarayıcıda yerel olarak (Vosk, WASM) yapılır; ses bilgisayardan çıkmaz. Tanınan cümle bu hizmete
 * gelir (`/api/sesli/calistir`), uyandırma sözcüğü / bas-konuş kuralına göre süzülür, komutlarla eşlenir ve eylem
 * çalıştırılır: bot komutu (yayıncı adına, yanıt sohbete), sohbet mesajı, TTS, ses panosu, Overlay Studio widget'ları,
 * widget/uyarı testleri, şarkı atlama, sohbet temizleme, kalkan modu.
 *
 * Model: Vosk Türkçe küçük model (Apache-2.0), yayıncı panelden "Modeli indir" deyince alphacephei.com'dan bir kez
 * indirilir, tarayıcının beklediği `model/` klasörlü tar.gz'ye çevrilip `data/sesli/` altında saklanır.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { db } from '../../db/index.js';
import { eventBus, type ChatMessagePayload } from '../../core/event-bus.js';
import {
  ayarlariDuzelt,
  dilbilgisi,
  eslestir,
  eylemDuzelt,
  ORNEK_KOMUTLAR,
  uyandirmayiAyikla,
  WIDGET_ADLARI,
  type Eslesme,
  type SesliAyarlar,
  type SesliEylem,
  type SesliKomut
} from './eslestir.js';

const AYAR_ANAHTARI = 'sesli_ayarlari';
export const MODEL_URL = 'https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip';
const MODEL_AD = 'vosk-model-small-tr-0.3';
const KLASOR = path.resolve(process.cwd(), 'data', 'sesli');
export const MODEL_DOSYASI = path.join(KLASOR, 'model.tar.gz');
/** Aynı komut art arda tanınırsa (yankı, tekrar) bu süre içinde yinelenmez */
const YINELEME_MS = 1500;
const GECMIS_SINIRI = 200;

type Yayinci = (p: any) => void;

export interface SesliSonuc {
  ok: boolean;
  /** Tanınan ham metin */
  metin: string;
  /** Neden çalışmadı / ne yapıldı */
  mesaj: string;
  eslesme?: { kaynak: Eslesme['kaynak']; ad: string; skor: number };
}

export type ModelDurumu =
  | { durum: 'yok' }
  | { durum: 'indiriliyor'; yuzde: number; mesaj: string }
  | { durum: 'hazir'; boyut: number }
  | { durum: 'hata'; mesaj: string };

/** Eylemlerin bağımlılıkları — test ve döngüsel içe aktarma için geç yüklenir */
async function servisler() {
  const [{ sesPanosu }, { commandManager }, { ttsEngine }, { songRequest }, { shieldModeService }, ws, widgetlar] = await Promise.all([
    import('../pano/pano.js'),
    import('../commands/command-manager.js'),
    import('../tts/tts.js'),
    import('../songrequest/songrequest.js'),
    import('../moderation/shield-mode.js'),
    import('../../ws/server.js'),
    import('../../api/rotalar/widgetlar.js')
  ]);
  return { sesPanosu, commandManager, ttsEngine, songRequest, shieldModeService, wsHub: ws.wsHub, widgetlar };
}

export function eylemAciklamasi(e: SesliEylem): string {
  switch (e.tur) {
    case 'komut':
      return `Bot komutu: ${e.metin}`;
    case 'sohbet':
      return `Sohbete yaz: ${e.metin}`;
    case 'tts':
      return `Seslendir: ${e.metin}`;
    case 'pano_oynat':
      return 'Panodan çal';
    case 'pano_kontrol':
      return `Ses panosu: ${{ atla: 'atla', duraklat: 'duraklat', devam: 'devam', temizle: 'sırayı temizle' }[e.eylem]}`;
    case 'overlay':
      return `Overlay: ${WIDGET_ADLARI[e.widget]?.[0] ?? e.widget} ${{ ac: 'aç', kapat: 'kapat', degistir: 'aç/kapat' }[e.durum]}`;
    case 'widget_test':
      return `Widget testi: ${e.widget}`;
    case 'uyari_test':
      return `Uyarı testi: ${e.olay}`;
    case 'sarki_atla':
      return 'Şarkıyı atla';
    case 'sohbet_temizle':
      return 'Sohbeti temizle';
    case 'kalkan':
      return `Kalkan modunu ${e.durum === 'ac' ? 'aç' : 'kapat'}`;
  }
}

export class SesliKomutlar {
  private yayinci: Yayinci = () => {};
  private sonCalisan = new Map<string, number>();
  private model: ModelDurumu = { durum: 'yok' };

  constructor() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sesli_komutlar (
        id         TEXT PRIMARY KEY,
        ad         TEXT NOT NULL,
        ifadeler   TEXT NOT NULL,
        eylem      TEXT NOT NULL,
        etkin      INTEGER NOT NULL DEFAULT 1,
        sira       INTEGER NOT NULL DEFAULT 0,
        olusturma  INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sesli_gecmis (
        id      TEXT PRIMARY KEY,
        zaman   INTEGER NOT NULL,
        metin   TEXT NOT NULL,
        ok      INTEGER NOT NULL,
        mesaj   TEXT NOT NULL,
        eslesme TEXT
      );
    `);
    // İlk kurulum: örnek komutlar (bir kez; yayıncı silerse geri gelmez)
    const tohum = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get('sesli_tohum') as any;
    if (!tohum) {
      const ekle = db.prepare('INSERT INTO sesli_komutlar (id, ad, ifadeler, eylem, etkin, sira, olusturma) VALUES (?, ?, ?, ?, ?, ?, ?)');
      ORNEK_KOMUTLAR.forEach((k, i) => ekle.run(crypto.randomUUID(), k.ad, JSON.stringify(k.ifadeler), JSON.stringify(k.eylem), 1, i, Date.now()));
      db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('sesli_tohum', '1');
    }
    if (fs.existsSync(MODEL_DOSYASI)) this.model = { durum: 'hazir', boyut: fs.statSync(MODEL_DOSYASI).size };
  }

  yayinciBagla(f: Yayinci) {
    this.yayinci = f;
  }

  // ---- Ayarlar ---------------------------------------------------------------

  ayarlar(): SesliAyarlar {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as any;
      return ayarlariDuzelt(r?.value ? JSON.parse(r.value) : null);
    } catch {
      return ayarlariDuzelt(null);
    }
  }

  ayarlariYaz(g: any): SesliAyarlar {
    const a = ayarlariDuzelt({ ...this.ayarlar(), ...(g || {}) });
    db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(AYAR_ANAHTARI, JSON.stringify(a));
    // Dinleyici sayfaları (panel, gizli dinleyici) ayarı anında alsın
    this.yayinci({ type: 'sesli_ayarlar', ayarlar: a });
    return a;
  }

  // ---- Komutlar --------------------------------------------------------------

  komutlar(): SesliKomut[] {
    return (db.prepare('SELECT * FROM sesli_komutlar ORDER BY sira, olusturma').all() as any[]).flatMap((r) => {
      const eylem = eylemDuzelt(JSON.parse(r.eylem || 'null'));
      if (!eylem) return [];
      return [{ id: r.id, ad: r.ad, ifadeler: JSON.parse(r.ifadeler || '[]'), eylem, etkin: !!r.etkin }];
    });
  }

  komutYaz(g: any): { ok: true; komut: SesliKomut } | { ok: false; hata: string } {
    const ad = String(g?.ad ?? '').trim().slice(0, 60);
    const ifadeler = (Array.isArray(g?.ifadeler) ? g.ifadeler : String(g?.ifadeler ?? '').split(/[\n,]/))
      .map((x: any) => String(x).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 10);
    const eylem = eylemDuzelt(g?.eylem);
    if (!ad) return { ok: false, hata: 'Ad gerekli' };
    if (!ifadeler.length) return { ok: false, hata: 'En az bir ifade gerekli' };
    if (!eylem) return { ok: false, hata: 'Geçersiz eylem' };
    const id = g?.id && this.komutlar().some((k) => k.id === g.id) ? String(g.id) : crypto.randomUUID();
    const etkin = g?.etkin !== false;
    db.prepare(
      `INSERT INTO sesli_komutlar (id, ad, ifadeler, eylem, etkin, sira, olusturma) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ad = excluded.ad, ifadeler = excluded.ifadeler, eylem = excluded.eylem, etkin = excluded.etkin`
    ).run(id, ad, JSON.stringify(ifadeler), JSON.stringify(eylem), etkin ? 1 : 0, Date.now() % 1e9, Date.now());
    // Dinleyici dilbilgisini yenilesin
    this.yayinci({ type: 'sesli_komutlar' });
    return { ok: true, komut: { id, ad, ifadeler, eylem, etkin } };
  }

  komutSil(id: string): boolean {
    const ok = db.prepare('DELETE FROM sesli_komutlar WHERE id = ?').run(id).changes > 0;
    if (ok) this.yayinci({ type: 'sesli_komutlar' });
    return ok;
  }

  /** Tanıyıcının sınırlı sözcük/ifade listesi (ayarlarda serbest tanıma seçiliyse null) */
  async dilbilgisi(): Promise<string[] | null> {
    const a = this.ayarlar();
    if (!a.kisitli) return null;
    const { sesPanosu } = await servisler();
    const pano = sesPanosu.ogeler().filter((o) => o.etkin).map((o) => ({ id: o.id, ad: o.ad, komut: o.komut }));
    return dilbilgisi(a, this.komutlar(), pano);
  }

  gecmis(adet = 50) {
    return (db.prepare('SELECT * FROM sesli_gecmis ORDER BY zaman DESC LIMIT ?').all(Math.min(GECMIS_SINIRI, Math.max(1, adet))) as any[]).map(
      (r) => ({ ...r, ok: !!r.ok, eslesme: r.eslesme ? JSON.parse(r.eslesme) : null })
    );
  }

  private gecmiseYaz(s: SesliSonuc) {
    db.prepare('INSERT INTO sesli_gecmis (id, zaman, metin, ok, mesaj, eslesme) VALUES (?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      Date.now(),
      s.metin.slice(0, 300),
      s.ok ? 1 : 0,
      s.mesaj.slice(0, 300),
      s.eslesme ? JSON.stringify(s.eslesme) : null
    );
    db.prepare('DELETE FROM sesli_gecmis WHERE id NOT IN (SELECT id FROM sesli_gecmis ORDER BY zaman DESC LIMIT ?)').run(GECMIS_SINIRI);
  }

  // ---- Tanınan metni işle ------------------------------------------------------

  /**
   * Dinleyiciden gelen cümle. `basKonus`: cümle bas-konuş tuşu basılıyken söylendi (uyandırma sözcüğü gerekmez).
   * `dene`: panelin "dene" kutusu — kip/etkinlik denetimi atlanır ama eylem gerçekten çalışır.
   */
  async isle(metin: string, secenek: { basKonus?: boolean; dene?: boolean } = {}, simdi = Date.now()): Promise<SesliSonuc> {
    const ham = String(metin ?? '').trim().slice(0, 300);
    const a = this.ayarlar();
    const sonuc = (ok: boolean, mesaj: string, e?: SesliSonuc['eslesme']): SesliSonuc => ({ ok, metin: ham, mesaj, eslesme: e });
    if (!ham) return sonuc(false, 'Boş metin');
    if (!secenek.dene && !a.etkin) return sonuc(false, 'Sesli komutlar kapalı');

    let govde: string | null = ham;
    if (!secenek.dene && !secenek.basKonus) {
      if (a.kip === 'bas_konus') return sonuc(false, 'Bas-konuş kipinde tuş basılı değildi');
      govde = uyandirmayiAyikla(ham, a.uyandirma);
      if (govde === null) return sonuc(false, 'Uyandırma sözcüğü yok'); // sıradan konuşma: geçmişe yazılmaz
    } else {
      // Bas-konuşta da "bot …" denebilir; varsa ayıkla
      govde = uyandirmayiAyikla(ham, a.uyandirma) ?? ham;
    }
    // Yalnız uyandırma sözcüğü (kısıtlı tanımada sıradan konuşma da "bot" diye gelebilir): geçmişe yazılmaz
    if (!govde.trim()) return sonuc(false, 'Uyandırma sözcüğünden sonra komut gelmedi');

    const { sesPanosu } = await servisler();
    const pano = sesPanosu.ogeler().filter((o) => o.etkin).map((o) => ({ id: o.id, ad: o.ad, komut: o.komut }));
    const e = eslestir(govde, this.komutlar(), a, pano);
    if (!e) return this.kaydet(sonuc(false, `Eşleşen komut yok: "${govde}"`));

    const anahtar = e.kaynak === 'komut' ? e.komut.id : e.kaynak === 'pano' ? `pano:${e.oge.id}` : `overlay:${e.widget}:${e.durum}`;
    if (simdi - (this.sonCalisan.get(anahtar) ?? 0) < YINELEME_MS) return sonuc(false, 'Az önce çalıştı (yineleme yok sayıldı)');
    this.sonCalisan.set(anahtar, simdi);

    const eylem: SesliEylem =
      e.kaynak === 'komut' ? e.komut.eylem : e.kaynak === 'pano' ? { tur: 'pano_oynat', ogeId: e.oge.id } : { tur: 'overlay', widget: e.widget, durum: e.durum };
    const ad = e.kaynak === 'komut' ? e.komut.ad : e.kaynak === 'pano' ? `Panodan çal: ${e.oge.ad}` : eylemAciklamasi(eylem);
    const bilgi = { kaynak: e.kaynak, ad, skor: Math.round(e.skor * 100) / 100 };
    try {
      const mesaj = await this.calistir(eylem, a);
      return this.kaydet(sonuc(true, mesaj, bilgi));
    } catch (hata: any) {
      return this.kaydet(sonuc(false, `Eylem başarısız: ${hata?.message || hata}`, bilgi));
    }
  }

  private kaydet(s: SesliSonuc): SesliSonuc {
    this.gecmiseYaz(s);
    this.yayinci({ type: 'sesli_sonuc', sonuc: s });
    return s;
  }

  /** Eylemi çalıştırır; kullanıcıya gösterilecek kısa sonuç metnini döner (hata fırlatabilir) */
  async calistir(e: SesliEylem, a: SesliAyarlar = this.ayarlar()): Promise<string> {
    const s = await servisler();
    switch (e.tur) {
      case 'komut': {
        const kanal = (db.prepare('SELECT channel_name FROM channels WHERE platform = ? AND is_active = 1 LIMIT 1').get(a.platform) as any)?.channel_name || 'yayinci';
        const mesaj: ChatMessagePayload = {
          id: `sesli-${crypto.randomUUID()}`,
          platform: a.platform,
          channel: kanal,
          user: { id: 'sesli-komut', username: kanal, displayName: 'Yayıncı (sesli)', badges: ['broadcaster'], isMod: true, isSub: true, isVip: false, isBroadcaster: true },
          message: e.metin,
          timestamp: Date.now()
        };
        const yanit = await s.commandManager.processMessage(mesaj);
        if (yanit) eventBus.emitBotMessage({ platform: a.platform, channel: kanal, message: yanit });
        return yanit ? `${e.metin} → ${yanit.slice(0, 120)}` : `${e.metin} çalıştı (yanıt yok)`;
      }
      case 'sohbet':
        eventBus.emitBotMessage({ platform: 'all', message: e.metin });
        return 'Sohbete yazıldı';
      case 'tts': {
        const r = s.ttsEngine.enqueue(e.metin, 'Yayıncı', undefined, undefined, { isBroadcaster: true });
        if (!r) throw new Error('TTS kapalı ya da metin süzgece takıldı');
        return 'Seslendirme sıraya alındı';
      }
      case 'pano_oynat': {
        const r = s.sesPanosu.panelOynat(e.ogeId);
        if (!r.ok) throw new Error(r.hata || 'Ses çalınamadı');
        return 'Panodan çalınıyor';
      }
      case 'pano_kontrol': {
        const r = s.sesPanosu.kontrol(e.eylem);
        if (!r.ok) throw new Error(r.hata || 'Ses panosu denetimi başarısız');
        return eylemAciklamasi(e);
      }
      case 'overlay': {
        const cfg = s.widgetlar.overlayAyariOku();
        const w = cfg[e.widget];
        if (!w) throw new Error(`Bilinmeyen widget: ${e.widget}`);
        const yeni = e.durum === 'degistir' ? !w.enabled : e.durum === 'ac';
        s.widgetlar.overlayAyariYaz({ ...cfg, [e.widget]: { ...w, enabled: yeni } });
        return `${WIDGET_ADLARI[e.widget]?.[0] ?? e.widget} ${yeni ? 'açıldı' : 'kapatıldı'}`;
      }
      case 'widget_test':
        s.widgetlar.widgetTesti(e.widget, {});
        return `${e.widget} testi tetiklendi`;
      case 'uyari_test':
        s.wsHub.triggerTestAlert(e.olay);
        return `${e.olay} uyarı testi`;
      case 'sarki_atla':
        return s.songRequest.skipSong(true).message || 'Şarkı atlandı';
      case 'sohbet_temizle':
        s.wsHub.broadcastTo(['dashboard', 'chatbox', 'all'], { type: 'clear_chat' });
        return 'Sohbet temizlendi';
      case 'kalkan':
        if (e.durum === 'ac') {
          const ayar = s.shieldModeService.activate('Yayıncı (sesli)');
          if (ayar.autoClearRaidMessages) s.wsHub.broadcastTo(['all'], { type: 'clear_chat' });
          return 'Kalkan modu açıldı';
        }
        s.shieldModeService.deactivate('Yayıncı (sesli)');
        return 'Kalkan modu kapatıldı';
    }
  }

  // ---- Model -----------------------------------------------------------------------

  modelDurumu(): ModelDurumu {
    if (this.model.durum !== 'indiriliyor') {
      this.model = fs.existsSync(MODEL_DOSYASI) ? { durum: 'hazir', boyut: fs.statSync(MODEL_DOSYASI).size } : this.model.durum === 'hata' ? this.model : { durum: 'yok' };
    }
    return this.model;
  }

  private modelYayinla(d: ModelDurumu) {
    this.model = d;
    this.yayinci({ type: 'sesli_model', model: d });
  }

  /** Modeli indirir ve tarayıcının beklediği biçime çevirir. Zaten iniyorsa/hazırsa bir şey yapmaz. */
  modelIndir(): ModelDurumu {
    const d = this.modelDurumu();
    if (d.durum === 'indiriliyor' || d.durum === 'hazir') return d;
    this.modelYayinla({ durum: 'indiriliyor', yuzde: 0, mesaj: 'Başlıyor…' });
    void this.modelIndirIc().catch((e) => this.modelYayinla({ durum: 'hata', mesaj: String(e?.message || e) }));
    return this.model;
  }

  private async modelIndirIc() {
    fs.mkdirSync(KLASOR, { recursive: true });
    const gecici = fs.mkdtempSync(path.join(KLASOR, 'kur-'));
    try {
      const zip = path.join(gecici, 'model.zip');
      const yanit = await fetch(MODEL_URL);
      if (!yanit.ok || !yanit.body) throw new Error(`Model indirilemedi (HTTP ${yanit.status})`);
      const toplam = Number(yanit.headers.get('content-length')) || 0;
      const yaz = fs.createWriteStream(zip);
      let alinan = 0;
      let sonYayin = 0;
      for await (const parca of yanit.body as any as AsyncIterable<Uint8Array>) {
        alinan += parca.length;
        if (!yaz.write(parca)) await new Promise<void>((r) => yaz.once('drain', () => r()));
        const yuzde = toplam ? Math.floor((alinan / toplam) * 100) : 0;
        if (yuzde !== sonYayin) {
          sonYayin = yuzde;
          this.modelYayinla({ durum: 'indiriliyor', yuzde, mesaj: `${(alinan / 1048576).toFixed(1)} / ${(toplam / 1048576).toFixed(1)} MB` });
        }
      }
      await new Promise<void>((coz, red) => yaz.end((h?: Error | null) => (h ? red(h) : coz())));
      if (toplam && alinan !== toplam) throw new Error('İndirme yarım kaldı');

      this.modelYayinla({ durum: 'indiriliyor', yuzde: 100, mesaj: 'Model açılıyor…' });
      // Windows 10+ bsdtar (tar.exe) zip açar; ayrı bir arşiv bağımlılığına gerek yok. Göreli yol: GNU tar
      // (Git kabuğundan) "C:" önekini uzak sunucu sanıyor.
      await calistirSurec(tarYolu(), ['-xf', 'model.zip'], gecici);
      const kaynak = path.join(gecici, MODEL_AD);
      // Yeni yapı am/final.mdl, eski (bu Türkçe model, 2020) kökte final.mdl — Vosk ikisini de tanır
      if (!fs.existsSync(path.join(kaynak, 'am', 'final.mdl')) && !fs.existsSync(path.join(kaynak, 'final.mdl'))) {
        throw new Error('Model arşivi beklenen yapıda değil');
      }
      fs.renameSync(kaynak, path.join(gecici, 'model'));
      const hedefGecici = path.join(gecici, 'model.tar.gz');
      await calistirSurec(tarYolu(), ['-czf', 'model.tar.gz', 'model'], gecici);
      fs.renameSync(hedefGecici, MODEL_DOSYASI);
      this.modelYayinla({ durum: 'hazir', boyut: fs.statSync(MODEL_DOSYASI).size });
    } finally {
      fs.rmSync(gecici, { recursive: true, force: true });
    }
  }
}

/** Windows'ta sistemin bsdtar'ı (PATH'te önce Git'in GNU tar'ı olabilir; o zip açamaz) */
export function tarYolu(platform = process.platform, sistemKoku = process.env.SystemRoot): string {
  if (platform === 'win32') return path.join(sistemKoku || 'C:\Windows', 'System32', 'tar.exe');
  return 'bsdtar';
}

function calistirSurec(komut: string, args: string[], cwd: string): Promise<void> {
  return new Promise((coz, red) => {
    const p = spawn(komut, args, { cwd, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let hata = '';
    p.stderr?.on('data', (d) => (hata = (hata + String(d)).slice(-500)));
    p.on('error', red);
    p.on('close', (kod) => (kod === 0 ? coz() : red(new Error(`${komut} çıkış kodu ${kod}: ${hata.trim().slice(-200)}`))));
  });
}

export const sesliKomutlar = new SesliKomutlar();
