import { db } from '../../db/index.js';
import { randomUUID as uuidv4 } from 'crypto';
import axios from 'axios';
import { spawn } from 'child_process';
import { ChatMessagePayload, eventBus } from '../../core/event-bus.js';
import type { CalanSarki } from '../muzik/spotify-saf.js';

/** Bot tarafında bekleyen, Studio'daki Spotify'a sırası gelince iletilecek istek (url öneki) */
const BEKLEYEN = 'spotify-istek:';

/**
 * Sıradaki istek şimdi başlatılmalı mı: hiçbir şey çalmıyorsa, çalan şarkının bitmesine
 * 3 sn kaldıysa ya da şarkı sonuna gelip durduysa. Ortasında duraklatılmışsa beklenir.
 */
export function sirasiGeldi(c: CalanSarki | null, simdi: number): boolean {
  if (!c) return true;
  // Çalar duraklatılmışsa istek beklemez, hemen çalar (Studio duraklatılmış Spotify'ı sürdürür)
  if (!c.isPlaying) return true;
  if (!(c.duration > 0)) return false;
  const kalan = c.duration - (c.progress + Math.max(0, simdi - (Number(c.updatedAt) || simdi)));
  return kalan <= 3000;
}
import { settingsCache } from '../../core/settings-cache.js';
import { muzikHost } from '../muzik/index.js';
import { parcaKimligi } from '../muzik/spotify-saf.js';
import { aramaAdaylari, engelliMi, siraDegerleri, youtubeSuresi } from './istek-filtresi.js';
import { istekSiniri, kullaniciEngelli, ucretDurumu } from './istek-kurallari.js';
import { KLIP_EN_COK_BEKLEME_MS, KLIP_TAKILDI_MS, KLIP_WIDGET_MS, klipKarari, parcaAnahtari } from './klip-kapisi.js';

export interface SongItem {
  id: string;
  title: string;
  url: string;
  duration: number;
  requestedBy: string;
  platform: string;
  thumbnail?: string;
  createdAt: number;
  isPlayed: boolean;
}

/**
 * Adresi / protokol URI'sini (spotify:, https:) kabuk KULLANMADAN açar.
 *
 * Eskiden `exec('start "" "..."')` cmd.exe üzerinden çalışıyordu; cmd
 * `%DEĞİŞKEN%` kalıplarını tırnak içinde bile genişletir ve şarkı adı izleyiciden
 * geliyor. explorer.exe bağımsız değişkeni olduğu gibi kabuğa iletir.
 */
/** `!klip` satırları Spotify sırasından bağımsız: widget çalana dek kuyrukta kalır */
const KLIP_DEGIL = "url NOT LIKE '%www.youtube.com/watch%'";
const KLIP_EN_COK_DENEME = 8;

function sistemdeAc(hedef: string): void {
  if (!/^(https:\/\/|spotify:)[^\s"]+$/i.test(hedef)) {
    console.warn('[SongRequest] Açılmayan hedef reddedildi');
    return;
  }
  const komut = process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  const cocuk = spawn(komut, [hedef], { detached: true, stdio: 'ignore', windowsHide: true });
  cocuk.on('error', (e) => console.error('[SongRequest] Masaüstü oynatıcı açılamadı:', e.message));
  cocuk.unref();
}

/**
 * İstek çalınabilir mi? Spotify/YouTube Music hedefinde çalar (bot ya da AxthrowA Studio üzerinden) bağlı
 * değilse çalınamaz. Video kipinde klip OBS'te çalar, çalar gerekmez.
 */
export function calarKapali(d: { videoKipi: boolean; otomatik: boolean; spotifyApiKapali?: boolean }): boolean {
  // "İstekleri Spotify'da çal" bilerek kapatıldıysa istek eski yoldan (sıra / masaüstünde açma) alınır
  return !d.videoKipi && !d.otomatik && !d.spotifyApiKapali;
}

/** Spotify hatası sohbette izleyiciye anlaşılır yazılır (teknik ayrıntı panel günlüğünde kalır) */
export function spotifyHataYaniti(kim: string, e: unknown): string {
  const m = String((e as { message?: string })?.message || e);
  console.warn(`[SongRequest] Spotify isteği başarısız: ${m.slice(0, 200)}`);
  if (/cihaz|device|404/i.test(m)) return `@${kim}, Spotify şu an açık değil (çalan cihaz yok). Yayıncı Spotify'ı açınca tekrar dene.`;
  if (/premium/i.test(m)) return `@${kim}, Spotify isteği için yayıncının Premium hesabı gerekiyor.`;
  return `@${kim}, şarkı Spotify'a eklenemedi: ${m.slice(0, 120)}`;
}

export class SongRequestEngine {
  private currentSong: SongItem | null = null;

  constructor() {
    // Spotify'da istek şarkısı çalmaya başlayınca kuyruk ilerler: ondan önce
    // istenip çalınmış şarkılar "çalındı" sayılır, "şu an çalan" o olur.
    muzikHost.parcaDegisince((c) => {
      if (!c?.title) return;
      try {
        // AxthrowA Studio'nun çalan bilgisinde parça kimliği yok: o zaman başlıkla eşlenir
        // (kayıt "Şarkı — Sanatçı" biçiminde); eskiden bu istekler kuyrukta hep açık kalıyordu
        const satir = (
          c.trackId
            ? db.prepare('SELECT created_at FROM song_queue WHERE is_played = 0 AND url LIKE ? ORDER BY created_at ASC LIMIT 1').get(`%/track/${c.trackId}`)
            : // Tam başlık ya da "başlık — sanatçı"; önek/LIKE eşlemesi "Hey" çalınca "Hey Jude"u da yakalıyordu
              (db
                .prepare("SELECT created_at, title FROM song_queue WHERE is_played = 0 AND url LIKE '%open.spotify.com%' ORDER BY created_at ASC")
                .all() as Array<{ created_at: number; title: string }>)
                .find((r) => {
                  const t = String(r.title).toLocaleLowerCase('tr');
                  const a = c.title.toLocaleLowerCase('tr');
                  return t === a || t.startsWith(`${a} — `);
                })
        ) as { created_at: number } | undefined;
        // Studio kipinde istekler ancak çalmaya başlayınca çözülür: çalandan başka çözülmüş istek bitmiştir
        // (Spotify kendi rastgele şarkısına geçtiğinde de kuyrukta açık kalmasın)
        if (!muzikHost.spotifyBagliMi()) {
          const a = c.title.toLocaleLowerCase('tr');
          const acik = db
            .prepare("SELECT id, title FROM song_queue WHERE is_played = 0 AND url LIKE '%open.spotify.com/track/%'")
            .all() as Array<{ id: string; title: string }>;
          let istekCaliyor = false;
          for (const r of acik) {
            const t = String(r.title).toLocaleLowerCase('tr');
            if (t === a || t.startsWith(`${a} — `)) istekCaliyor = true;
            else db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(r.id);
          }
          this.currentSong = null;
          // Bitiş anı kaçtıysa Spotify kendi şarkısına geçmiştir: bekleyen istek hemen başlar
          if (!istekCaliyor && Date.now() - this.sonBaslatma > 15_000 && Date.now() > this.hariciSiraBekle) void this.hariciSiraDenetle(Date.now(), true);
        }
        if (!satir) return;
        // Sırasını bekleyen istek henüz çalmadı: "çalındı" sayılırsa izleyicinin isteği sessizce kaybolur
        db.prepare(`UPDATE song_queue SET is_played = 1 WHERE is_played = 0 AND created_at < ? AND url NOT LIKE ? AND ${KLIP_DEGIL}`).run(satir.created_at, `${BEKLEYEN}%`);
        this.currentSong = null;
        this.skipVotes.clear();
      } catch {
        /* kuyruk eşlemesi kritik değil */
      }
    });
    setInterval(() => {
      void this.hariciSiraDenetle();
      if (!this.klipZamanlayici && this.ilkKlip()) this.klipKapisiniUyandir();
    }, 2000).unref?.();
  }

  // Klip sırası: klip başlayana dek `klipSirasi` boş döner (bkz. klip-kapisi.ts)
  private klipZamanlayici: ReturnType<typeof setInterval> | null = null;
  private klipOturumu = false;
  private klipBekleyis: { id: string; baslangic: number; anahtar: string } | null = null;
  /** Klip bitince müzik nasıl sürecek; biz duraklatmadıysak hiç dokunulmaz */
  private klipDevam: 'play' | 'next' | null = null;
  private sonKlipYoklama = 0;
  /** Çalan klip ne zamandır çalıyor: oynatıcı bitişi bildirmezse sıra sonsuza dek kilitlenmesin */
  private klipCalan: { id: string; baslangic: number; sinir: number } | null = null;
  /** Süre sınırıyla önündeki şarkıları geçmiş klip: oturum "önceki istek var" diye geri kapanmasın */
  private klipSinirla: string | null = null;

  private klipKapisiniUyandir() {
    if (this.klipZamanlayici) return;
    this.klipZamanlayici = setInterval(() => this.klipKapisi(), 500);
    this.klipZamanlayici.unref?.();
  }

  /** Klip çalıyor ya da bu zamandan önce istendi: sıra onun (OBS'te widget açık değilse klip kimseyi tutmaz) */
  private klipSiraTutuyor(zaman: number, simdi = Date.now()): boolean {
    if (this.klipOturumu) return true;
    const klip = this.ilkKlip();
    return Boolean(klip && klip.createdAt < zaman && simdi - this.sonKlipYoklama < KLIP_WIDGET_MS);
  }

  private oncekiIstekVar(zaman: number): boolean {
    if (!this.spotifyOtomatikMi()) return false;
    const sql = muzikHost.spotifyBagliMi()
      ? 'SELECT title, url FROM song_queue WHERE is_played = 0 AND created_at < ? AND (url LIKE ? OR url LIKE \'%open.spotify.com%\')'
      : 'SELECT title, url FROM song_queue WHERE is_played = 0 AND created_at < ? AND url LIKE ?';
    const satirlar = db.prepare(sql).all(zaman, `${BEKLEYEN}%`) as Array<{ title: string; url: string }>;
    return satirlar.some((r) => !this.calanSatirMi(r));
  }

  private calanSatirMi(r: { title: string; url: string }): boolean {
    const c = muzikHost.simdiCalan();
    if (!c?.title || String(r.url).startsWith(BEKLEYEN)) return false;
    if (c.trackId && String(r.url).endsWith(`/track/${c.trackId}`)) return true;
    const a = c.title.toLocaleLowerCase('tr');
    const t = String(r.title).toLocaleLowerCase('tr');
    return t === a || t.startsWith(`${a} — `);
  }

  private klipKapisi(simdi = Date.now()): void {
    try {
      const ilk = this.ilkKlip();
      if (this.klipOturumu) {
        // Widget sormayı kestiyse (OBS kapandı) müzik sonsuza dek duraklatılmış kalmasın; klip kuyrukta kalır
        const koptu = simdi - this.sonKlipYoklama > KLIP_WIDGET_MS + 5000;
        if (koptu || !ilk || (this.klipSinirla !== ilk.id && this.oncekiIstekVar(ilk.createdAt))) {
          this.klipOturumuKapat();
          return;
        }
        if (this.klipCalan?.id !== ilk.id) this.klipCalan = { id: ilk.id, baslangic: simdi, sinir: simdi + KLIP_TAKILDI_MS };
        else if (simdi > this.klipCalan.sinir) void this.klipTakildiMi(ilk.url);
        return;
      }
      if (!ilk) {
        this.klipBekleyis = null;
        if (this.klipZamanlayici) clearInterval(this.klipZamanlayici);
        this.klipZamanlayici = null;
        return;
      }
      this.klipKapisiniUyandir();
      // Az önce başlatılan istek çalan bilgisine yansımadan eski parçanın sonu sanılmasın
      if (this.baslatmaBekleniyor(simdi)) return;
      const calan = muzikHost.simdiCalan();
      const anahtar = parcaAnahtari(calan);
      const widgetCanli = simdi - this.sonKlipYoklama < KLIP_WIDGET_MS;
      if (this.klipBekleyis?.id !== ilk.id) this.klipBekleyis = { id: ilk.id, baslangic: simdi, anahtar };
      const b = this.klipBekleyis;
      if (!widgetCanli) b.baslangic = simdi;
      const acikIstekler = db
        .prepare(`SELECT title, url FROM song_queue WHERE is_played = 0 AND url NOT LIKE ? AND ${KLIP_DEGIL}`)
        .all(`${BEKLEYEN}%`) as Array<{ title: string; url: string }>;
      const istekCaliyor = acikIstekler.some((r) => this.calanSatirMi(r));
      if (!b.anahtar || istekCaliyor) b.anahtar = anahtar;
      const karar = klipKarari({
        calan,
        ilkAnahtar: b.anahtar,
        oncekiIstek: this.oncekiIstekVar(ilk.createdAt),
        istekCaliyor,
        widgetCanli,
        bekleyisMs: simdi - b.baslangic,
        simdi
      });
      if (karar === 'bekle') return;
      this.klipBekleyis = null;
      this.klipOturumu = true;
      this.klipSinirla = simdi - b.baslangic >= KLIP_EN_COK_BEKLEME_MS ? ilk.id : null;
      this.currentSong = null;
      if (karar !== 'baslat') {
        this.klipDevam = karar === 'duraklat-son' ? 'next' : 'play';
        // Parça bitti sayılır: oynatıcı duraklatılınca "parça değişti" olayı gelmez
        if (karar === 'duraklat-son')
          db.prepare(`UPDATE song_queue SET is_played = 1 WHERE is_played = 0 AND created_at < ? AND url NOT LIKE ? AND ${KLIP_DEGIL}`).run(ilk.createdAt, `${BEKLEYEN}%`);
        void muzikHost.komut('pause').catch((e) => console.warn('[SongRequest] Müzik duraklatılamadı:', e?.message || e));
      }
      eventBus.emit('anket_katmani', { type: 'klip_hazir' });
    } catch (e) {
      console.warn('[SongRequest] Klip sırası denetlenemedi:', (e as Error)?.message || e);
    }
  }

  /** Klip uzun süredir bitmedi: gerçek süresi (kuyruktaki değer sabit) daha uzunsa beklenir, değilse geçilir */
  private async klipTakildiMi(url: string) {
    const k = this.klipCalan;
    if (!k) return;
    k.sinir = Infinity; // yanıt gelene dek ikinci kez sorulmasın
    const videoId = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1];
    const bitis = k.baslangic + ((videoId ? await this.youtubeSure(videoId, true) : 0) + 60) * 1000;
    if (this.klipCalan !== k) return;
    if (bitis > Date.now()) k.sinir = bitis;
    else this.klipBitti(k.id);
  }

  private klipOturumuKapat() {
    this.klipOturumu = false;
    const devam = this.klipDevam;
    this.klipDevam = null;
    eventBus.emit('anket_katmani', { type: 'klip_hazir' });
    const bekleyen = this.spotifyOtomatikMi() && !muzikHost.spotifyBagliMi() && db.prepare('SELECT 1 FROM song_queue WHERE is_played = 0 AND url LIKE ?').get(`${BEKLEYEN}%`);
    void (async () => {
      const once = this.sonBaslatma;
      if (bekleyen) await this.hariciSiraDenetle(Date.now(), true);
      // İstek başladıysa müzik zaten çalıyor; başlamadıysa duraklatılmış kalmasın
      if (!devam || this.sonBaslatma !== once) return;
      // Duraklattığımız parçanın son saniyesi klipten sonra çalmasın
      if (devam === 'next') await muzikHost.komut('next').catch(() => {});
      await muzikHost.komut('play');
    })().catch((e) => console.warn('[SongRequest] Müzik sürdürülemedi:', e?.message || e));
  }

  /** Spotify'da atla: Studio kipinde sırada istek varsa doğrudan o başlar, yoksa Spotify'ın sonraki şarkısı */
  private async spotifyAtla() {
    // Klip çalarken !skip klibi geçer; müzik zaten duraklatılmış
    if (this.klipOturumu) return;
    const bekleyen = !muzikHost.spotifyBagliMi() && (db.prepare('SELECT MIN(created_at) AS ilk FROM song_queue WHERE is_played = 0 AND url LIKE ?').get(`${BEKLEYEN}%`) as { ilk: number | null }).ilk;
    // Sıra daha eski klipteyse şarkı başlatılamaz: !skip yine de çalan parçayı geçer
    if (bekleyen && !this.klipSiraTutuyor(bekleyen)) return this.hariciSiraDenetle(Date.now(), true);
    await muzikHost.komut('next', 'spotify').catch(() => {});
  }

  /** Bekleyen isteği sıraya aldıktan sonraki cevap; "hemen" kipinde çalanın yerine hemen başlar */
  private siraYaniti(kim: string, ad: string, hemen: boolean): string {
    const { n: sira, ilk } = db.prepare('SELECT COUNT(*) AS n, MIN(created_at) AS ilk FROM song_queue WHERE is_played = 0 AND url LIKE ?').get(`${BEKLEYEN}%`) as { n: number; ilk: number };
    const bos = !this.klipSiraTutuyor(ilk) && (hemen || (sira === 1 && !this.baslatmaBekleniyor(Date.now()) && sirasiGeldi(muzikHost.simdiCalan(), Date.now())));
    void this.hariciSiraDenetle(Date.now(), hemen);
    return bos
      ? `🎵 @${kim}, "${ad}" şimdi çalıyor.`
      : `🎵 @${kim}, "${ad}" sıraya alındı (${sira}. sırada) — çalan şarkı bitince kendiliğinden çalacak.`;
  }

  private engelli(metin: string): boolean {
    return engelliMi(metin, settingsCache.get('sr_engelli', ''));
  }

  /** Süre sınırına takılıyorsa izleyiciye cevap; süre bilinmiyorsa (0) istek geçer. Yayıncı ve modlar muaf. */
  private sureEngeli(message: ChatMessagePayload, sureSn: number): string | null {
    const dk = Math.max(0, Number(settingsCache.get('sr_max_dk', '0')) || 0);
    if (!dk || !sureSn || sureSn <= dk * 60 || message.user.isBroadcaster || message.user.isMod) return null;
    return `@${message.user.displayName}, bu şarkı çok uzun (${Math.ceil(sureSn / 60)} dk); en fazla ${dk} dk olabilir.`;
  }

  /** Süre sınırı açıksa YouTube süresini öğrenir: kapalıyken fazladan istek atılmaz (önbellekli) */
  private async youtubeSure(videoId: string, sinirsizDa = false): Promise<number> {
    if (!sinirsizDa && !(Number(settingsCache.get('sr_max_dk', '0')) > 0)) return 0;
    const bilinen = this.sureOnbellek.get(videoId);
    if (bilinen !== undefined) return bilinen;
    try {
      const res = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, { timeout: 2500, headers: { 'Accept-Language': 'tr-TR,tr;q=0.9' } });
      const sn = youtubeSuresi(res.data);
      if (sn) this.sureOnbellek.set(videoId, sn);
      return sn;
    } catch {
      return 0;
    }
  }
  private sureOnbellek = new Map<string, number>();

  private engelYaniti(kim: string, ad: string): string {
    return `⛔ @${kim}, "${ad.slice(0, 80)}" engel listesinde, istenemez.`;
  }

  /** Bu kurulumda sıra gerçekten değişebilir mi: bot Spotify'a doğrudan bağlıyken parçalar Spotify'ın kendi sırasındadır */
  siralanabilir(): boolean {
    return !(this.spotifyOtomatikMi() && muzikHost.spotifyBagliMi());
  }

  /** Bekleyen isteklerin sırasını değiştirir; çalan şarkıya dokunulmaz (OBS klibi yarıda kesilmesin) */
  siraDegistir(yeniSira: string[]): boolean {
    if (!this.siralanabilir()) return false;
    const calan = this.getCurrentSong()?.id ?? '';
    const bekleyen = db.prepare('SELECT id, created_at FROM song_queue WHERE is_played = 0 AND id <> ?').all(calan) as Array<{ id: string; created_at: number }>;
    const yaz = db.prepare('UPDATE song_queue SET created_at = ? WHERE id = ?');
    for (const k of siraDegerleri(bekleyen, yeniSira)) yaz.run(k.created_at, k.id);
    return true;
  }

  /** İsteği kuyruktan siler */
  kaldir(id: string): void {
    db.prepare('DELETE FROM song_queue WHERE id = ?').run(id);
    if (this.currentSong?.id === id) this.currentSong = null;
  }

  /** İsteği siler, adını engel listesine ekler: aynı şarkı bir daha istenemez */
  engelle(id: string): boolean {
    const satir = db.prepare('SELECT title FROM song_queue WHERE id = ?').get(id) as { title: string } | undefined;
    if (!satir) return false;
    this.engelEkle(satir.title);
    this.kaldir(id);
    return true;
  }

  /** Engel listesine satır ekler (Studio "Sanatçıyı engelle"); zaten engelliyse dokunmaz. Eklendiyse true. */
  engelEkle(metin: string): boolean {
    const m = metin.replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
    if (m.length < 2 || this.engelli(m)) return false;
    settingsCache.set('sr_engelli', [settingsCache.get('sr_engelli', '').trim(), m].filter(Boolean).join('\n'));
    return true;
  }

  /** YouTube'da ilk video (önbellekli) */
  private async youtubeAdaylari(sorgu: string): Promise<Array<{ videoId: string; title: string }>> {
    try {
      const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(sorgu)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8'
        },
        timeout: 6000
      });
      return aramaAdaylari(res.data);
    } catch (err: any) {
      console.warn('[SongRequest] YouTube araması başarısız:', err?.message || err);
      return [];
    }
  }

  private async youtubeAra(sorgu: string): Promise<{ videoId: string; title: string; thumbnail?: string } | null> {
    const anahtar = sorgu.toLowerCase();
    const onbellekte = this.searchCache.get(anahtar);
    if (onbellekte) return onbellekte;
    try {
      const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(sorgu)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8'
        },
        // Arama sayfası yavaş gelince istek "bulunamadı" sayılıyordu
        timeout: 6000
      });
      const vid = res.data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/)?.[1];
      if (!vid) return null;
      const b = { videoId: vid, title: res.data.match(/"title":\{"runs":\[\{"text":"([^"]+)"/)?.[1] || sorgu, thumbnail: `https://img.youtube.com/vi/${vid}/hqdefault.jpg` };
      this.searchCache.set(anahtar, b);
      return b;
    } catch (err: any) {
      console.warn('[SongRequest] YouTube araması başarısız:', err?.message || err);
      return null;
    }
  }

  /** Son istek başlatma anı: o andan sonraki parça değişimi bizim isteğimizdir */
  private sonBaslatma = 0;

  /** Aynı isteği iki kez göndermemek için (Studio'nun çalan bilgisi birkaç sn sonra güncellenir) */
  private hariciSiraBekle = 0;

  /** Son başlatılan istekten önce çalan parça: çalan bilgisi bundan farklı olana dek yeni istek başlamaz */
  private baslatmaOncesi: { anahtar: string; zaman: number } | null = null;

  /** Üst üste başarısız deneme: tek bir bozuk istek sırayı sonsuza dek tıkamasın */
  private hataSayaci = { id: '', adet: 0 };

  private calanAnahtari(): string {
    const c = muzikHost.simdiCalan();
    return c ? `${c.source}:${c.title}:${c.artist}` : '';
  }

  /**
   * Başlatılan istek çalan bilgisine henüz yansımadı mı? Eski parça "bitmek üzere" görünürken
   * sıradaki istek başlatılırsa az önce başlayan şarkı kesiliyordu ("sıraya alındı ama çalmadı").
   * Oynatıcı hiç tepki vermezse sıra 45 sn sonra yine ilerler.
   */
  private baslatmaBekleniyor(simdi: number): boolean {
    if (!this.baslatmaOncesi) return false;
    if (simdi - this.baslatmaOncesi.zaman < 45_000 && this.calanAnahtari() === this.baslatmaOncesi.anahtar) return true;
    this.baslatmaOncesi = null;
    return false;
  }

  /**
   * Studio'daki Spotify'da sıra: istekler hemen gönderilmez (eski Studio exe'si "sıraya ekle"yi tanımıyor,
   * çalan şarkıyı kesiyordu). Çalan şarkı bitmek üzereyken sıradaki istek başlatılır; istek yoksa
   * Spotify kendi akışıyla (rastgele/otomatik) çalmaya devam eder.
   */
  async hariciSiraDenetle(simdi = Date.now(), zorla = false): Promise<void> {
    if (muzikHost.spotifyBagliMi() || !this.spotifyOtomatikMi()) return;
    if (!zorla && simdi < this.hariciSiraBekle) return;
    const bekleyen = db
      .prepare('SELECT id, url, requested_by, platform, created_at FROM song_queue WHERE is_played = 0 AND url LIKE ? ORDER BY created_at ASC, rowid ASC LIMIT 1')
      .get(`${BEKLEYEN}%`) as { id: string; url: string; requested_by: string; platform: string; created_at: number } | undefined;
    if (!bekleyen) return;
    if (this.klipSiraTutuyor(bekleyen.created_at, simdi)) return;
    if (!zorla && (this.baslatmaBekleniyor(simdi) || !sirasiGeldi(muzikHost.simdiCalan(), simdi))) return;
    this.hariciSiraBekle = simdi + 8000;
    const baslamadanOnce = this.calanAnahtari();
    try {
      const icerik = bekleyen.url.slice(BEKLEYEN.length);
      // YouTube Music isteği: "yt=<videoId> <başlık>"
      const yt = icerik.match(/^yt=([a-zA-Z0-9_-]{11}) (.*)$/s);
      const p = yt ? await muzikHost.hariciIstek(yt[2], false, yt[1]) : await muzikHost.hariciIstek(icerik, false);
      const baslik = yt ? yt[2] : p.artist ? `${p.title} — ${p.artist}` : p.title;
      // Studio adla arayıp hemen çalıyor, gerçek ad ancak şimdi belli: engelliyse hemen geçilir
      if (!yt && this.engelli(baslik)) {
        await muzikHost.komut('next', 'spotify').catch(() => {});
        this.sonBaslatma = Date.now();
        db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(bekleyen.id);
        eventBus.emitBotMessage({ platform: (bekleyen.platform || 'all') as any, message: `⛔ @${bekleyen.requested_by}, "${baslik.slice(0, 100)}" engel listesinde, atlandı.${await this.iadeEt(bekleyen.id)}` });
        return;
      }
      const parca = p.uri.match(/^spotify:track:([A-Za-z0-9]{22})$/)?.[1];
      // Bundan önceki her şey bitti sayılır (çalınmış istekler, takılı eski kayıtlar)
      db.prepare(`UPDATE song_queue SET is_played = 1 WHERE is_played = 0 AND id <> ? AND url NOT LIKE ? AND ${KLIP_DEGIL}`).run(bekleyen.id, `${BEKLEYEN}%`);
      db.prepare('UPDATE song_queue SET title = ?, url = ? WHERE id = ?').run(
        baslik.slice(0, 200),
        yt ? `https://music.youtube.com/watch?v=${yt[1]}` : parca ? `https://open.spotify.com/track/${parca}` : 'https://open.spotify.com/',
        bekleyen.id
      );
      this.sonBaslatma = Date.now();
      this.baslatmaOncesi = { anahtar: baslamadanOnce, zaman: simdi };
      this.hataSayaci = { id: '', adet: 0 };
      this.currentSong = null;
      eventBus.emitBotMessage({ platform: (bekleyen.platform || 'all') as any, message: `🎶 Şimdi çalıyor: "${baslik}" — isteyen @${bekleyen.requested_by}` });
    } catch (e: any) {
      const hata = String(e?.message || e);
      // Spotify kapalı / cihaz yok / bağlantı: istek kaybolmaz, 30 sn sonra yeniden denenir
      if (!/sonuç yok|track URI yok|boş arama/i.test(hata)) {
        this.hariciSiraBekle = Date.now() + 30_000;
        this.hataSayaci = { id: bekleyen.id, adet: this.hataSayaci.id === bekleyen.id ? this.hataSayaci.adet + 1 : 1 };
        if (/cihaz|device|bağlı değil|ECONN|timeout|network/i.test(hata) || this.hataSayaci.adet < 3) return;
        // Oynatıcı ayakta ama bu istek başlamıyor: sonrakiler beklemesin, izleyici de haberdar olsun
        db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(bekleyen.id);
        this.hariciSiraBekle = 0;
        eventBus.emitBotMessage({ platform: (bekleyen.platform || 'all') as any, message: `⚠️ @${bekleyen.requested_by}, isteğin çalınamadı: ${hata.slice(0, 100)}${await this.iadeEt(bekleyen.id)}` });
        return;
      }
      // Spotify'da bulunamayan istek kuyruğu tıkamasın
      db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(bekleyen.id);
      eventBus.emitBotMessage({ platform: (bekleyen.platform || 'all') as any, message: `⚠️ @${bekleyen.requested_by}, istek Spotify'da bulunamadı: ${hata.slice(0, 100)}${await this.iadeEt(bekleyen.id)}` });
    }
  }

  /** Şarkı Klipleri widget'ı kipi: istekler YouTube'da aranır, OBS'te video olarak çalar. */
  videoKipi(): boolean {
    return settingsCache.get('sr_hedef', 'spotify') === 'video';
  }

  /** Klip widget'ı parçayı bitirdi: yalnız hâlâ çalan oysa geçilir (iki OBS kaynağı aynı şarkıyı iki kez atlatmasın). */
  klipBitti(id: string): boolean {
    if (this.djParca && this.djParca.id === id) {
      this.sonDjUrller = [this.djParca.url, ...this.sonDjUrller].slice(0, 5);
      this.djParca = null;
      return true;
    }
    const simdiki = this.ilkKlip();
    if (!simdiki || simdiki.id !== id) return false;
    db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(simdiki.id);
    if (this.currentSong?.id === id) this.currentSong = null;
    this.skipVotes.clear();
    this.klipKapisi();
    eventBus.emit('anket_katmani', { type: 'klip_hazir' });
    return true;
  }

  /** Aynı isteğin denenmiş yüklemeleri ve aramada olanlar */
  private klipDenenen = new Map<string, Set<string>>();
  private klipAraniyor = new Set<string>();

  /**
   * Widget klibi oynatamadı. Şirketlerin resmî klipleri çoğu zaman gömmeye kapalıdır (YouTube hata 150) ve
   * arama ilk sonuç olarak tam da onları verir: istek "çalındı" sayılıp ekranda hiç görünmeden kayboluyordu.
   * Aynı şarkının sıradaki sonucuna geçilir; hiçbiri olmazsa istek düşer ve sohbete söylenir.
   */
  async klipGomulemedi(id: string, videoId: string): Promise<boolean> {
    if (this.djParca?.id === id) return this.klipBitti(id);
    const r = this.ilkKlip();
    // İki OBS kaynağı aynı hatayı bildirir: yalnız hâlâ o videodaysa işlenir
    if (r?.id !== id || !r.url.includes(videoId) || this.klipAraniyor.has(id)) return false;
    this.klipAraniyor.add(id);
    try {
      const denenen = this.klipDenenen.get(id) ?? new Set<string>();
      denenen.add(videoId);
      this.klipDenenen.set(id, denenen);
      const sonraki = denenen.size < KLIP_EN_COK_DENEME
        ? (await this.youtubeAdaylari(r.title)).find((a) => !denenen.has(a.videoId) && !this.engelli(a.title))
        : undefined;
      if (sonraki) {
        db.prepare('UPDATE song_queue SET url = ?, thumbnail = ? WHERE id = ?').run(
          `https://www.youtube.com/watch?v=${sonraki.videoId}`,
          `https://img.youtube.com/vi/${sonraki.videoId}/hqdefault.jpg`,
          id
        );
        return true;
      }
      this.klipDenenen.delete(id);
      const satir = db.prepare('SELECT platform FROM song_queue WHERE id = ?').get(id) as { platform: string } | undefined;
      this.klipBitti(id);
      eventBus.emitBotMessage({
        platform: (satir?.platform || 'all') as any,
        message: `⚠️ @${r.requestedBy}, "${r.title.slice(0, 80)}" YouTube'da yayınlarda oynatmaya kapalı, başka sürümü de bulunamadı.${await this.iadeEt(id)}`
      });
      return true;
    } finally {
      this.klipAraniyor.delete(id);
    }
  }

  /**
   * Kuyruktaki ilk YouTube isteği. Video kipine geçmeden önce eklenmiş bir Spotify isteği
   * kuyruğun başında kalınca widget onu çalamıyor ve hiç ilerlemiyordu.
   */
  /** Kuyruk boşken çalan "Otomatik DJ" parçası ve son çalınanlar (art arda aynısı gelmesin) */
  private djParca: { id: string; title: string; url: string; requestedBy: string } | null = null;
  private sonDjUrller: string[] = [];

  /**
   * Şarkı Klipleri widget'ının çalacağı sıradaki parça: önce bekleyen istek; kuyruk boşsa
   * (ayar açıksa) daha önce istenmiş kliplerden rastgele biri. Yeni istek gelince DJ'in yerine geçer.
   */
  klipSirasi(): { id: string; title: string; url: string; requestedBy: string } | null {
    this.sonKlipYoklama = Date.now();
    // Kip Spotify'dan videoya geçtiyse bekleyen Spotify istekleri artık çalınamaz: kuyrukta takılı kalmasın
    // (yalnız video kipinde: katman OBS'te açık kalsa da Spotify kipindeki istekler silinmez)
    if (this.videoKipi()) db.prepare('UPDATE song_queue SET is_played = 1 WHERE is_played = 0 AND url LIKE ?').run(`${BEKLEYEN}%`);
    const istek = this.ilkKlip();
    if (istek) {
      if (!this.klipOturumu) this.klipKapisi();
      // İstek sırasını beklerken DJ parçası yarıda kesilmez
      if (!this.klipOturumu) return this.videoKipi() ? this.djParca : null;
      this.djParca = null;
      const { id, title, url, requestedBy } = istek;
      return { id, title, url, requestedBy };
    }
    // Otomatik DJ yalnız video kipinde: Spotify kipinde !klip ile açılan katman kendiliğinden eski klip çalmasın
    if (!this.videoKipi() || settingsCache.get('sr_bos_rastgele', 'true') === 'false') return null;
    if (this.djParca) return this.djParca;
    const gecmis = db
      .prepare("SELECT title, url FROM song_queue WHERE is_played = 1 AND (url LIKE '%youtube.com/%' OR url LIKE '%youtu.be/%') ORDER BY created_at DESC LIMIT 200")
      .all() as Array<{ title: string; url: string }>;
    const tekil = [...new Map(gecmis.map((g) => [g.url, g])).values()];
    const adaylar = tekil.length > this.sonDjUrller.length ? tekil.filter((g) => !this.sonDjUrller.includes(g.url)) : tekil;
    if (!adaylar.length) return null;
    const s = adaylar[Math.floor(Math.random() * adaylar.length)];
    this.djParca = { id: `dj-${uuidv4()}`, title: s.title, url: s.url, requestedBy: 'Otomatik DJ' };
    return this.djParca;
  }

  /** Video kipinde istek gelince tek OBS URL'sindeki Şarkı Klipleri katmanı kapalıysa açılır (yoksa istekler hiç çalmıyordu) */
  private async klipKatmaniniAc() {
    try {
      const { overlayAyariOku, overlayAyariYaz } = await import('../../api/rotalar/widgetlar.js');
      const y = overlayAyariOku();
      if (!y?.muzikVideo?.enabled) {
        overlayAyariYaz({ ...y, muzikVideo: { x: 1280, y: 700, width: 600, height: 340, scale: 1, ...y?.muzikVideo, enabled: true } });
      }
    } catch (e) {
      console.warn('[SongRequest] Şarkı Klipleri katmanı açılamadı:', (e as Error)?.message || e);
    }
  }

  ilkKlip(): { id: string; title: string; url: string; requestedBy: string; createdAt: number } | null {
    // music.youtube.com: Spotify gibi çalar, klip değil
    const r = db
      .prepare("SELECT id, title, url, requested_by, created_at FROM song_queue WHERE is_played = 0 AND (url LIKE '%youtube.com/%' OR url LIKE '%youtu.be/%') AND url NOT LIKE '%music.youtube.com%' ORDER BY created_at ASC, rowid ASC LIMIT 1")
      .get() as { id: string; title: string; url: string; requested_by: string; created_at: number } | undefined;
    return r ? { id: r.id, title: r.title, url: r.url, requestedBy: r.requested_by, createdAt: r.created_at } : null;
  }

  /** Spotify Web API ile otomatik çalma açık ve hesap bağlı mı? */
  spotifyOtomatikMi(): boolean {
    if (this.videoKipi()) return false;
    return (muzikHost.spotifyBagliMi() || muzikHost.hariciHedef() !== null) && settingsCache.get('sr_spotify_api', 'true') !== 'false';
  }

  /**
   * Şarkıyı Spotify'da bulup otomatik çalar: varsayılan olarak Spotify'ın
   * kendi sırasına eklenir (mevcut şarkı bitince çalar); `sr_spotify_mod =
   * hemen` ise hemen başlar. Yayıncının müdahalesi gerekmez.
   * Not: Spotify oynatma kontrolü Premium hesap ve açık bir cihaz ister.
   */
  private async spotifyIstegi(message: ChatMessagePayload, rawQuery: string): Promise<string> {
    const kim = message.user.displayName;
    let sorgu = rawQuery;
    // YouTube linki verildiyse başlığıyla Spotify'da aranır
    const yt = rawQuery.match(/(?:youtube\.com\/\S*?[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (yt) {
      try {
        const o = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${yt[1]}&format=json`, { timeout: 4000 });
        sorgu = String(o.data?.title || '').replace(/\((official|resmi)[^)]*\)|\[[^\]]*\]/gi, '').trim() || rawQuery;
      } catch {
        // YouTube Music'e video kimliği yeter; başlık yalnız Spotify araması için gerekli
        if (muzikHost.spotifyBagliMi() || muzikHost.hariciHedef() !== 'ytmd') {
          return `@${kim}, YouTube başlığı alınamadı; şarkı adını yazarak dene: !sr Teoman Paramparça`;
        }
      }
    }
    const hemen = settingsCache.get('sr_spotify_mod', 'sira') === 'hemen';
    // Spotify / YouTube Music AxthrowA Studio'da bağlı: istek bot tarafında sıralanır
    if (!muzikHost.spotifyBagliMi() && muzikHost.hariciHedef() === 'ytmd') {
      const id = rawQuery.match(/(?:[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      const b = id ? { videoId: id, title: sorgu } : await this.youtubeAra(sorgu);
      if (!b) return `@${kim}, YouTube'da "${sorgu.slice(0, 60)}" bulunamadı.`;
      const baslik = b.title.slice(0, 200);
      if (this.engelli(baslik)) return this.engelYaniti(kim, baslik);
      const uzun = this.sureEngeli(message, await this.youtubeSure(b.videoId));
      if (uzun) return uzun;
      db.prepare(`
        INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(uuidv4(), baslik, `${BEKLEYEN}yt=${b.videoId} ${baslik}`, 180, kim, message.platform, '', Date.now());
      return this.siraYaniti(kim, baslik, hemen);
    }
    if (!muzikHost.spotifyBagliMi()) {
      try {
        const id = parcaKimligi(rawQuery);
        if (id) {
          const o = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`, { timeout: 4000 });
          sorgu = String(o.data?.title || '') || sorgu;
        }
        if (this.engelli(sorgu)) return this.engelYaniti(kim, sorgu);
        if (!hemen) {
          db.prepare(`
            INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
          `).run(uuidv4(), sorgu.slice(0, 200), `${BEKLEYEN}${sorgu.slice(0, 200)}`, 180, kim, message.platform, '', Date.now());
          return this.siraYaniti(kim, sorgu, false);
        }
        const p = await muzikHost.hariciIstek(sorgu, false);
        const baslik = p.artist ? `${p.title} — ${p.artist}` : p.title;
        const parca = p.uri.match(/^spotify:track:([A-Za-z0-9]{22})$/)?.[1];
        db.prepare(`
          INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(uuidv4(), baslik.slice(0, 200), parca ? `https://open.spotify.com/track/${parca}` : '', 180, kim, message.platform, '', Date.now());
        return hemen
          ? `🎵 @${kim}, "${baslik}" şimdi Spotify'da çalıyor!`
          : `🎵 @${kim}, "${baslik}" Spotify sırasına eklendi — sıradaki şarkılardan sonra kendiliğinden çalacak.`;
      } catch (e: any) {
        return spotifyHataYaniti(kim, e);
      }
    }
    try {
      const id = parcaKimligi(rawQuery);
      const p = id ? await muzikHost.parcaBilgisi(id) : await muzikHost.parcaAra(sorgu);
      if (!p) return `@${kim}, Spotify'da "${sorgu.slice(0, 60)}" bulunamadı.`;
      const baslik = p.artist ? `${p.title} — ${p.artist}` : p.title;
      if (this.engelli(baslik)) return this.engelYaniti(kim, baslik);
      const uzun = this.sureEngeli(message, Math.round(p.sureMs / 1000));
      if (uzun) return uzun;
      await muzikHost.parcayiCal(p.uri, hemen);
      db.prepare(`
        INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(uuidv4(), baslik.slice(0, 200), `https://open.spotify.com/track/${p.id}`, 180, kim, message.platform, p.albumArt, Date.now());
      return hemen
        ? `🎵 @${kim}, "${baslik}" şimdi Spotify'da çalıyor!`
        : `🎵 @${kim}, "${baslik}" Spotify sırasına eklendi — sıradaki şarkılardan sonra kendiliğinden çalacak.`;
    } catch (e: any) {
      return spotifyHataYaniti(kim, e);
    }
  }
  private skipVotes: Set<string> = new Set();
  private requiredVotes: number = 3;
  // In-memory cache for fast search responses (0ms on repeated songs)
  private searchCache: Map<string, { videoId: string; title: string; thumbnail?: string }> = new Map();

  /** `klip`: !klip komutu; kip ne olursa olsun istek OBS'teki Şarkı Klipleri widget'ında video olarak çalar. */
  async handleSongRequest(message: ChatMessagePayload, args: string[], { klip = false } = {}): Promise<string> {
    const kim = message.user.displayName;
    if (kullaniciEngelli(message.user, settingsCache.get('sr_engelli_kullanici', ''))) return `⛔ @${kim}, şarkı isteğin kapatılmış.`;
    const ucretAyari = Number(settingsCache.get('sr_ucret', '0')) || 0;
    const { economy } = await import('../economy/economy.js');
    // Bakiye yalnız ücret açıksa okunur
    const bakiye = ucretAyari > 0 ? Number(economy.getUser(message.platform, message.user.username, kim)?.points) || 0 : 0;
    const ucret = ucretDurumu(message.user, ucretAyari, bakiye);
    if ('neden' in ucret) return `@${kim}, ${ucret.neden}.`;
    const once = (db.prepare('SELECT COALESCE(MAX(rowid), 0) AS n FROM song_queue').get() as { n: number }).n;
    const yanit = await this.istegiIsle(message, args, { klip });
    if (!ucret.ucret) return yanit;
    // Ücret yalnız istek sıraya girdiyse düşülür (her başarılı yol song_queue'ya satır yazar)
    const yeni = db
      .prepare('SELECT id FROM song_queue WHERE rowid > ? AND LOWER(requested_by) = LOWER(?) ORDER BY rowid DESC LIMIT 1')
      .get(once, kim) as { id: string } | undefined;
    if (!yeni) return yanit;
    const kalan = economy.removePoints(message.user.username, ucret.ucret);
    this.odenen.set(yeni.id, { kullanici: message.user.username, ucret: ucret.ucret });
    return `${yanit} (−${ucret.ucret} puan, kalan ${kalan})`;
  }

  /** shortcut: ödenen istekler bellekte; bot yeniden başlarsa o anki sıradaki isteklerin iadesi yapılamaz, kalıcı iade gerekirse song_queue'ya sütun eklenir */
  private odenen = new Map<string, { kullanici: string; ucret: number }>();

  /** Ücretli istek çalınamadıysa ya da sahibi geri aldıysa puanı geri verir; sohbet mesajına eklenecek notu döndürür */
  async iadeEt(id: string): Promise<string> {
    const o = this.odenen.get(id);
    if (!o) return '';
    this.odenen.delete(id);
    const { economy } = await import('../economy/economy.js');
    economy.addPoints(o.kullanici, o.ucret);
    return ` ${o.ucret} puanın iade edildi.`;
  }

  private async istegiIsle(message: ChatMessagePayload, args: string[], { klip = false } = {}): Promise<string> {
    const rawQuery = args.join(' ').trim();
    if (!rawQuery && klip) return `@${message.user.displayName}, bir şarkı adı ya da YouTube linki yaz. Örnek: !klip Teoman Paramparça`;
    if (!rawQuery) {
      return `@${message.user.displayName}, bir şarkı ismi, YouTube, Spotify veya YouTube Music linki girmelisin! Örnek: !sr Teoman Paramparça`;
    }
    if (rawQuery.length > 300) return `@${message.user.displayName}, istek çok uzun.`;
    // Kişi başına sırada bekleyen istek sınırı (0 = sınırsız; yayıncı/mod muaf) — tek kişi kuyruğu dolduramasın
    const sinir = istekSiniri(message.user, {
      izleyici: settingsCache.get('sr_kisi_basina', '2'),
      abone: settingsCache.get('sr_kisi_basina_abone', ''),
      vip: settingsCache.get('sr_kisi_basina_vip', '')
    });
    if (sinir > 0) {
      const bekleyenim = (db.prepare('SELECT COUNT(*) AS n FROM song_queue WHERE is_played = 0 AND LOWER(requested_by) = LOWER(?)').get(message.user.displayName) as { n: number }).n;
      if (bekleyenim >= sinir) return `@${message.user.displayName}, sırada en fazla ${sinir} isteğin olabilir; biri çalınca yenisini iste.`;
    }
    if (this.engelli(rawQuery)) return this.engelYaniti(message.user.displayName, rawQuery);
    // En az puan şartı: harcanmaz, yalnız bakılır
    const enAzPuan = Math.max(0, Number(settingsCache.get('sr_min_puan', '0')) || 0);
    if (enAzPuan > 0 && !message.user.isBroadcaster && !message.user.isMod) {
      const { economy } = await import('../economy/economy.js');
      const puan = Number(economy.getUser(message.platform, message.user.username, message.user.displayName)?.points) || 0;
      if (puan < enAzPuan) return `@${message.user.displayName}, şarkı istemek için en az ${enAzPuan} puan gerekiyor (sende ${puan}).`;
    }

    await muzikHost.hariciTazele();
    // Spotify / YouTube Music bağlıysa şarkı doğrudan o programda çalınır
    if (!klip && this.spotifyOtomatikMi()) return this.spotifyIstegi(message, rawQuery);

    const videoKipi = klip || this.videoKipi();
    // Müzik çalar açık değil: eskiden istek hiç çalmayacak bir sıraya "eklendi" diye alınıyordu
    if (calarKapali({ videoKipi, otomatik: false, spotifyApiKapali: settingsCache.get('sr_spotify_api', 'true') === 'false' })) {
      return `@${message.user.displayName}, şu an Spotify ya da YouTube Music açık değil, isteğin çalınamaz. Yayıncı müzik çaları açınca tekrar dene.`;
    }
    // Video kipinde Spotify linki başlığıyla YouTube'da aranır
    let aramaSorgusu = rawQuery;
    let videoId = '';
    let title = rawQuery;
    let thumbnailUrl = '';
    let videoUrl = '';

    // 1. Check if query is a Spotify Track URL or URI
    const spotifyMatch = rawQuery.match(/(?:https?:\/\/open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]+)/);
    if (spotifyMatch) {
      const trackId = spotifyMatch[1];
      videoUrl = `https://open.spotify.com/track/${trackId}`;
      
      // Fast oEmbed for Spotify title
      try {
        const oembedRes = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(videoUrl)}`, { timeout: 2500 });
        if (oembedRes.data?.title) {
          title = `${oembedRes.data.title} ${oembedRes.data.author_name ? '- ' + oembedRes.data.author_name : ''}`.trim();
          thumbnailUrl = oembedRes.data.thumbnail_url || '';
        }
      } catch {
        title = `Spotify Track (${trackId})`;
      }

      if (videoKipi) {
        aramaSorgusu = title;
        videoUrl = '';
        thumbnailUrl = '';
      } else {
        // Auto open in Spotify Desktop if configured
        this.checkAndAutoOpenDesktop('spotify', title, `spotify:track:${trackId}`);
      }
    } 
    // 2. Check if query is YouTube Music URL
    else if (rawQuery.includes('music.youtube.com/watch')) {
      const ytMusicMatch = rawQuery.match(/v=([a-zA-Z0-9_-]{11})/);
      if (ytMusicMatch) {
        videoId = ytMusicMatch[1];
        // Klip widget'ı www adresini oynatır; music.youtube.com satırları klip sayılmaz
        videoUrl = videoKipi ? `https://www.youtube.com/watch?v=${videoId}` : `https://music.youtube.com/watch?v=${videoId}`;
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    } 
    // 3. Check if query is a standard YouTube URL
    else {
      const urlMatch = rawQuery.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (urlMatch) {
        videoId = urlMatch[1];
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    // 4. If query is a text search (not a direct URL), check fast cache or search
    if (!videoUrl && !videoId) {
      const b = await this.youtubeAra(aramaSorgusu);
      if (b) {
        videoId = b.videoId;
        title = b.title;
        thumbnailUrl = b.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      }
    }

    if (!videoUrl && !videoId) {
      return `@${message.user.displayName}, şarkı bulunamadı. Lütfen doğrudan bir YouTube veya Spotify linki deneyin!`;
    }

    // If title is still raw query and we have videoId, fetch title via fast oembed
    if (title === rawQuery && videoId) {
      try {
        const oembed = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 1500 });
        if (oembed.data?.title) {
          title = oembed.data.title;
        }
      } catch {
        /* başlık isteğe bağlı: oEmbed yanıt vermezse sorgu metni başlık kalır */
      }
    }

    if (this.engelli(`${title} ${videoUrl}`)) return this.engelYaniti(message.user.displayName, title);
    if (videoId) {
      const uzun = this.sureEngeli(message, await this.youtubeSure(videoId));
      if (uzun) return uzun;
    }

    const songId = uuidv4();
    db.prepare(`
      INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(songId, title, videoUrl, 180, message.user.displayName, message.platform, thumbnailUrl, Date.now());
    if (videoKipi) void this.klipKatmaniniAc();
    if (videoKipi) this.klipKapisiniUyandir();

    // Auto open desktop player if enabled (video kipinde klip OBS'te çalar)
    const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
    if (!videoKipi && (desktopTarget === 'spotify' || desktopTarget === 'ytmusic')) {
      this.openDesktopPlayer(desktopTarget as any, title, videoUrl);
    }

    const queueCount = (db.prepare('SELECT COUNT(*) as count FROM song_queue WHERE is_played = 0').get() as { count: number }).count;

    if (klip) return `🎬 @${message.user.displayName}, "${title}" klibi sıraya eklendi! (Sıradaki #${queueCount})`;
    return `🎵 @${message.user.displayName}, "${title}" sıraya eklendi! (Sıradaki #${queueCount})`;
  }

  /**
   * Launch Desktop Player on Windows (Spotify Desktop or YouTube Music Desktop)
   */
  openDesktopPlayer(player: 'spotify' | 'ytmusic', title: string, url?: string): boolean {
    try {
      if (player === 'spotify') {
        let spotifyUri = '';
        if (url && (url.includes('spotify.com/track/') || url.startsWith('spotify:track:'))) {
          const match = url.match(/(?:track\/|track:)([a-zA-Z0-9]+)/);
          if (match) {
            spotifyUri = `spotify:track:${match[1]}`;
          }
        }
        if (!spotifyUri) {
          // Use Windows Spotify search protocol (opens Spotify desktop app and queries the song)
          spotifyUri = `spotify:search:${encodeURIComponent(title)}`;
        }

        console.log(`[SongRequest] Opening in Spotify Desktop: ${spotifyUri}`);
        sistemdeAc(spotifyUri);
        return true;
      } 
      else if (player === 'ytmusic') {
        let ytMusicUrl = '';
        if (url && (url.includes('youtube.com/watch') || url.includes('youtu.be/'))) {
          const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (match) {
            ytMusicUrl = `https://music.youtube.com/watch?v=${match[1]}`;
          }
        }
        if (!ytMusicUrl) {
          ytMusicUrl = `https://music.youtube.com/search?q=${encodeURIComponent(title)}`;
        }

        console.log(`[SongRequest] Opening in YouTube Music: ${ytMusicUrl}`);
        // Varsayılan tarayıcıda ya da YouTube Music masaüstü uygulamasında açılır
        sistemdeAc(ytMusicUrl);
        return true;
      }
    } catch (err: any) {
      console.error('[SongRequest] Error opening desktop player:', err?.message || err);
      return false;
    }
    return false;
  }

  private checkAndAutoOpenDesktop(player: 'spotify' | 'ytmusic', title: string, url: string) {
    const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
    if (desktopTarget === player) {
      this.openDesktopPlayer(player, title, url);
    }
  }

  /** Oynatıcıda gerçekten çalan parça bir istekse onun kaydı (eski, takılı kayıt "çalan" sayılmaz) */
  calanIstek(): SongItem | null {
    if (this.videoKipi() || !this.spotifyOtomatikMi()) return this.getCurrentSong();
    const c = muzikHost.simdiCalan();
    if (!c?.title) return null;
    const a = c.title.toLocaleLowerCase('tr');
    const satirlar = db.prepare(`SELECT * FROM song_queue WHERE is_played = 0 AND url NOT LIKE '${BEKLEYEN}%' ORDER BY created_at DESC`).all() as any[];
    const row = satirlar.find((r) => {
      const t = String(r.title).toLocaleLowerCase('tr');
      return t === a || t.startsWith(`${a} — `);
    });
    return row
      ? { id: row.id, title: row.title, url: row.url, duration: row.duration, requestedBy: row.requested_by, platform: row.platform, thumbnail: row.thumbnail, createdAt: row.created_at, isPlayed: false }
      : null;
  }

  /** !sarki cevabı: kuyruğun başı değil, oynatıcıda gerçekten çalan parça yazılır */
  /** Çalan şarkının adı (sohbet yanıtları ve !songlike için); yoksa boş */
  calanAdi(): string {
    if (this.videoKipi() || !this.spotifyOtomatikMi()) return this.getCurrentSong()?.title || '';
    const c = muzikHost.simdiCalan();
    return c?.title ? (c.artist ? `${c.title} — ${c.artist}` : c.title) : '';
  }

  /** shortcut: beğeniler bellekte ve yalnız son 50 şarkı için; oturum raporuna (R4) kalıcı yazım gerekirse tabloya alınır */
  private begeniler = new Map<string, Set<string>>();

  /** !songlike: izleyici çalan şarkıyı beğenir; aynı kişi bir şarkıyı bir kez sayılır */
  begen(kullanici: string, gorunen: string): string {
    const ad = this.calanAdi();
    if (!ad) return `@${gorunen}, şu anda çalan bir şarkı yok.`;
    const kume = this.begeniler.get(ad) ?? new Set<string>();
    const yeni = !kume.has(kullanici.toLowerCase());
    kume.add(kullanici.toLowerCase());
    this.begeniler.delete(ad);
    this.begeniler.set(ad, kume);
    if (this.begeniler.size > 50) this.begeniler.delete(this.begeniler.keys().next().value as string);
    return yeni ? `❤️ @${gorunen} "${ad.slice(0, 80)}" şarkısını beğendi (${kume.size} beğeni).` : `@${gorunen}, bu şarkıyı zaten beğendin (${kume.size} beğeni).`;
  }

  begeniSayisi(ad: string): number {
    return this.begeniler.get(ad)?.size ?? 0;
  }

  calanYaniti(): string {
    const yok = 'Şu anda çalan bir şarkı yok. Şarkı istemek için: !sr <şarkı adı>';
    if (this.videoKipi() || !this.spotifyOtomatikMi()) {
      const k = this.getCurrentSong();
      return k ? `🎶 Şu anda çalan: "${k.title}" (İsteyen: ${k.requestedBy})` : yok;
    }
    const c = muzikHost.simdiCalan();
    if (!c?.title) return yok;
    const istek = this.calanIstek();
    const ad = c.artist ? `${c.title} — ${c.artist}` : c.title;
    return `🎶 Şu anda çalan: "${ad}"${istek ? ` (İsteyen: ${istek.requestedBy})` : ''}`;
  }

  getCurrentSong(): SongItem | null {
    if (this.currentSong && !this.currentSong.isPlayed) {
      return this.currentSong;
    }
    const row = db.prepare(`SELECT * FROM song_queue WHERE is_played = 0 AND url NOT LIKE '${BEKLEYEN}%' ORDER BY created_at ASC LIMIT 1`).get() as any;
    if (!row) return null;

    this.currentSong = {
      id: row.id,
      title: row.title,
      url: row.url,
      duration: row.duration,
      requestedBy: row.requested_by,
      platform: row.platform,
      thumbnail: row.thumbnail,
      createdAt: row.created_at,
      isPlayed: false
    };
    return this.currentSong;
  }

  skipSong(force: boolean = false, userTag?: string): { skipped: boolean; message: string } {
    const current = this.getCurrentSong();
    if (!current) {
      return { skipped: false, message: 'Şu anda çalan bir şarkı yok.' };
    }

    if (force) {
      this.atlaKarti(current, true);
      if (this.spotifyOtomatikMi()) void this.spotifyAtla();
      db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(current.id);
      this.currentSong = null;
      this.skipVotes.clear();
      const next = this.getCurrentSong();
      if (next && !this.spotifyOtomatikMi()) {
        const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
        if (desktopTarget === 'spotify' || desktopTarget === 'ytmusic') {
          this.openDesktopPlayer(desktopTarget as any, next.title, next.url);
        }
      }
      return {
        skipped: true,
        message: `⏭️ Şarkı atlandı! ${next ? `Sıradaki: "${next.title}"` : 'Sırada başka şarkı yok.'}`
      };
    }

    if (userTag) {
      this.skipVotes.add(userTag.toLowerCase());
      const yeter = this.skipVotes.size >= this.requiredVotes;
      this.atlaKarti(current, yeter);
      if (yeter) {
        if (this.spotifyOtomatikMi()) void this.spotifyAtla();
        db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(current.id);
        this.currentSong = null;
        this.skipVotes.clear();
        const next = this.getCurrentSong();
        if (next && !this.spotifyOtomatikMi()) {
          const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
          if (desktopTarget === 'spotify' || desktopTarget === 'ytmusic') {
            this.openDesktopPlayer(desktopTarget as any, next.title, next.url);
          }
        }
        return {
          skipped: true,
          message: `⏭️ Yeterli oy toplandı (${this.requiredVotes} oy)! Şarkı atlandı.`
        };
      } else {
        return {
          skipped: false,
          message: `🗳️ Şarkı atlama oyu verildi (${this.skipVotes.size}/${this.requiredVotes}).`
        };
      }
    }

    return { skipped: false, message: 'Oylama kaydedilemedi.' };
  }

  /** OBS !atla kartı: oy birikir, eşik dolunca “atlandı” yazılır. */
  private atlaKarti(current: SongItem, skipped: boolean): void {
    eventBus.emit('widget_update', {
      type: 'atla',
      data: {
        title: current.title,
        by: current.requestedBy,
        votes: this.skipVotes.size,
        required: this.requiredVotes,
        skipped
      }
    });
  }

  getQueueList(): SongItem[] {
    const rows = db.prepare('SELECT * FROM song_queue WHERE is_played = 0 ORDER BY created_at ASC, rowid ASC LIMIT 15').all() as any[];
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      duration: r.duration,
      requestedBy: r.requested_by,
      platform: r.platform,
      thumbnail: r.thumbnail,
      createdAt: r.created_at,
      isPlayed: false
    }));
  }
}

export const songRequest = new SongRequestEngine();
export default songRequest;
