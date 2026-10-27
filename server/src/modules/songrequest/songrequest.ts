import { db } from '../../db/index.js';
import { randomUUID as uuidv4 } from 'crypto';
import axios from 'axios';
import { spawn } from 'child_process';
import { ChatMessagePayload, eventBus } from '../../core/event-bus.js';
import type { CalanSarki } from '../muzik/spotify-saf.js';

/** Bot tarafında bekleyen, YYA'daki Spotify'a sırası gelince iletilecek istek (url öneki) */
const BEKLEYEN = 'spotify-istek:';

/**
 * Sıradaki istek şimdi başlatılmalı mı: hiçbir şey çalmıyorsa, çalan şarkının bitmesine
 * 3 sn kaldıysa ya da şarkı sonuna gelip durduysa. Ortasında duraklatılmışsa beklenir.
 */
export function sirasiGeldi(c: CalanSarki | null, simdi: number): boolean {
  if (!c) return true;
  if (!(c.duration > 0)) return !c.isPlaying;
  const konum = c.progress + (c.isPlaying ? Math.max(0, simdi - (Number(c.updatedAt) || simdi)) : 0);
  const kalan = c.duration - konum;
  return c.isPlaying ? kalan <= 3000 : kalan <= 2000;
}
import { settingsCache } from '../../core/settings-cache.js';
import { muzikHost } from '../muzik/index.js';
import { parcaKimligi } from '../muzik/spotify-saf.js';

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

export class SongRequestEngine {
  private currentSong: SongItem | null = null;

  constructor() {
    // Spotify'da istek şarkısı çalmaya başlayınca kuyruk ilerler: ondan önce
    // istenip çalınmış şarkılar "çalındı" sayılır, "şu an çalan" o olur.
    muzikHost.parcaDegisince((c) => {
      if (!c?.title) return;
      try {
        // Yayın Yönetim Aracı'nın çalan bilgisinde parça kimliği yok: o zaman başlıkla eşlenir
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
        // YYA kipinde istekler ancak çalmaya başlayınca çözülür: çalandan başka çözülmüş istek bitmiştir
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
          if (!istekCaliyor && Date.now() > this.hariciSiraBekle) void this.hariciSiraDenetle(Date.now(), true);
        }
        if (!satir) return;
        db.prepare('UPDATE song_queue SET is_played = 1 WHERE is_played = 0 AND created_at < ?').run(satir.created_at);
        this.currentSong = null;
        this.skipVotes.clear();
      } catch {
        /* kuyruk eşlemesi kritik değil */
      }
    });
    setInterval(() => void this.hariciSiraDenetle(), 2000).unref?.();
  }

  /** Spotify'da atla: YYA kipinde sırada istek varsa doğrudan o başlar, yoksa Spotify'ın sonraki şarkısı */
  private async spotifyAtla() {
    const bekleyen = !muzikHost.spotifyBagliMi() && db.prepare('SELECT 1 FROM song_queue WHERE is_played = 0 AND url LIKE ?').get(`${BEKLEYEN}%`);
    if (bekleyen) return this.hariciSiraDenetle(Date.now(), true);
    await muzikHost.komut('next', 'spotify').catch(() => {});
  }

  /** Aynı isteği iki kez göndermemek için (YYA'nın çalan bilgisi birkaç sn sonra güncellenir) */
  private hariciSiraBekle = 0;

  /**
   * YYA'daki Spotify'da sıra: istekler hemen gönderilmez (eski YYA exe'si "sıraya ekle"yi tanımıyor,
   * çalan şarkıyı kesiyordu). Çalan şarkı bitmek üzereyken sıradaki istek başlatılır; istek yoksa
   * Spotify kendi akışıyla (rastgele/otomatik) çalmaya devam eder.
   */
  async hariciSiraDenetle(simdi = Date.now(), zorla = false): Promise<void> {
    if (muzikHost.spotifyBagliMi() || !this.spotifyOtomatikMi()) return;
    if (!zorla && simdi < this.hariciSiraBekle) return;
    const bekleyen = db
      .prepare('SELECT id, url, requested_by, platform FROM song_queue WHERE is_played = 0 AND url LIKE ? ORDER BY created_at ASC LIMIT 1')
      .get(`${BEKLEYEN}%`) as { id: string; url: string; requested_by: string; platform: string } | undefined;
    if (!bekleyen) return;
    if (!zorla && !sirasiGeldi(muzikHost.simdiCalan(), simdi)) return;
    this.hariciSiraBekle = simdi + 8000;
    try {
      const p = await muzikHost.hariciIstek(bekleyen.url.slice(BEKLEYEN.length), false);
      const baslik = p.artist ? `${p.title} — ${p.artist}` : p.title;
      const parca = p.uri.match(/^spotify:track:([A-Za-z0-9]{22})$/)?.[1];
      db.prepare('UPDATE song_queue SET title = ?, url = ? WHERE id = ?').run(
        baslik.slice(0, 200),
        parca ? `https://open.spotify.com/track/${parca}` : 'https://open.spotify.com/',
        bekleyen.id
      );
      this.currentSong = null;
      eventBus.emitBotMessage({ platform: (bekleyen.platform || 'all') as any, message: `🎶 Şimdi çalıyor: "${baslik}" — isteyen @${bekleyen.requested_by}` });
    } catch (e: any) {
      const hata = String(e?.message || e);
      // Spotify kapalı / cihaz yok / bağlantı: istek kaybolmaz, 30 sn sonra yeniden denenir
      if (!/sonuç yok|track URI yok|boş arama/i.test(hata)) {
        this.hariciSiraBekle = Date.now() + 30_000;
        return;
      }
      // Spotify'da bulunamayan istek kuyruğu tıkamasın
      db.prepare('UPDATE song_queue SET is_played = 1 WHERE id = ?').run(bekleyen.id);
      eventBus.emitBotMessage({ platform: (bekleyen.platform || 'all') as any, message: `⚠️ İstek Spotify'da bulunamadı: ${hata.slice(0, 100)}` });
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
    return true;
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
    // Kip Spotify'dan videoya geçtiyse bekleyen Spotify istekleri artık çalınamaz: kuyrukta takılı kalmasın
    // (yalnız video kipinde: katman OBS'te açık kalsa da Spotify kipindeki istekler silinmez)
    if (this.videoKipi()) db.prepare('UPDATE song_queue SET is_played = 1 WHERE is_played = 0 AND url LIKE ?').run(`${BEKLEYEN}%`);
    const istek = this.ilkKlip();
    if (istek) {
      this.djParca = null;
      return istek;
    }
    if (settingsCache.get('sr_bos_rastgele', 'true') === 'false') return null;
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

  ilkKlip(): { id: string; title: string; url: string; requestedBy: string } | null {
    const r = db
      .prepare("SELECT id, title, url, requested_by FROM song_queue WHERE is_played = 0 AND (url LIKE '%youtube.com/%' OR url LIKE '%youtu.be/%') ORDER BY created_at ASC LIMIT 1")
      .get() as { id: string; title: string; url: string; requested_by: string } | undefined;
    return r ? { id: r.id, title: r.title, url: r.url, requestedBy: r.requested_by } : null;
  }

  /** Spotify Web API ile otomatik çalma açık ve hesap bağlı mı? */
  spotifyOtomatikMi(): boolean {
    if (this.videoKipi()) return false;
    return muzikHost.spotifyKullanilabilir() && settingsCache.get('sr_spotify_api', 'true') !== 'false';
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
        return `@${kim}, YouTube başlığı alınamadı; şarkı adını yazarak dene: !sr Teoman Paramparça`;
      }
    }
    const hemen = settingsCache.get('sr_spotify_mod', 'sira') === 'hemen';
    // Spotify Yayın Yönetim Aracı'nda bağlı: arama ve sıraya ekleme orada yapılır
    if (!muzikHost.spotifyBagliMi()) {
      try {
        const id = parcaKimligi(rawQuery);
        if (id) {
          const o = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`, { timeout: 4000 });
          sorgu = String(o.data?.title || '') || sorgu;
        }
        if (!hemen) {
          db.prepare(`
            INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
          `).run(uuidv4(), sorgu.slice(0, 200), `${BEKLEYEN}${sorgu.slice(0, 200)}`, 180, kim, message.platform, '', Date.now());
          const sira = (db.prepare('SELECT COUNT(*) AS n FROM song_queue WHERE is_played = 0 AND url LIKE ?').get(`${BEKLEYEN}%`) as { n: number }).n;
          const bos = sira === 1 && sirasiGeldi(muzikHost.simdiCalan(), Date.now());
          void this.hariciSiraDenetle();
          return bos
            ? `🎵 @${kim}, "${sorgu}" şimdi çalıyor.`
            : `🎵 @${kim}, "${sorgu}" sıraya alındı (${sira}. sırada) — çalan şarkı bitince kendiliğinden çalacak.`;
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
        return `@${kim}, şarkı Spotify'a eklenemedi: ${String(e?.message || e).slice(0, 120)}`;
      }
    }
    try {
      const id = parcaKimligi(rawQuery);
      const p = id ? await muzikHost.parcaBilgisi(id) : await muzikHost.parcaAra(sorgu);
      if (!p) return `@${kim}, Spotify'da "${sorgu.slice(0, 60)}" bulunamadı.`;
      await muzikHost.parcayiCal(p.uri, hemen);
      const baslik = p.artist ? `${p.title} — ${p.artist}` : p.title;
      db.prepare(`
        INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(uuidv4(), baslik.slice(0, 200), `https://open.spotify.com/track/${p.id}`, 180, kim, message.platform, p.albumArt, Date.now());
      return hemen
        ? `🎵 @${kim}, "${baslik}" şimdi Spotify'da çalıyor!`
        : `🎵 @${kim}, "${baslik}" Spotify sırasına eklendi — sıradaki şarkılardan sonra kendiliğinden çalacak.`;
    } catch (e: any) {
      return `@${kim}, şarkı Spotify'a eklenemedi: ${String(e?.message || e).slice(0, 120)}`;
    }
  }
  private skipVotes: Set<string> = new Set();
  private requiredVotes: number = 3;
  // In-memory cache for fast search responses (0ms on repeated songs)
  private searchCache: Map<string, { videoId: string; title: string; thumbnail?: string }> = new Map();

  async handleSongRequest(message: ChatMessagePayload, args: string[]): Promise<string> {
    const rawQuery = args.join(' ').trim();
    if (!rawQuery) {
      return `@${message.user.displayName}, bir şarkı ismi, YouTube, Spotify veya YouTube Music linki girmelisin! Örnek: !sr Teoman Paramparça`;
    }
    if (rawQuery.length > 300) return `@${message.user.displayName}, istek çok uzun.`;
    // Kişi başına sırada bekleyen istek sınırı (0 = sınırsız; yayıncı/mod muaf) — tek kişi kuyruğu dolduramasın
    const sinir = Math.max(0, Math.floor(Number(settingsCache.get('sr_kisi_basina', '2')) || 0));
    if (sinir > 0 && !message.user.isBroadcaster && !message.user.isMod) {
      const bekleyenim = (db.prepare('SELECT COUNT(*) AS n FROM song_queue WHERE is_played = 0 AND LOWER(requested_by) = LOWER(?)').get(message.user.displayName) as { n: number }).n;
      if (bekleyenim >= sinir) return `@${message.user.displayName}, sırada en fazla ${sinir} isteğin olabilir; biri çalınca yenisini iste.`;
    }

    // Spotify hesabı bağlıysa şarkı doğrudan Spotify'da çalınır
    if (this.spotifyOtomatikMi()) return this.spotifyIstegi(message, rawQuery);

    const videoKipi = this.videoKipi();
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
        videoUrl = `https://music.youtube.com/watch?v=${videoId}`;
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
      const cacheKey = aramaSorgusu.toLowerCase();
      if (this.searchCache.has(cacheKey)) {
        const cached = this.searchCache.get(cacheKey)!;
        videoId = cached.videoId;
        title = cached.title;
        thumbnailUrl = cached.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      } else {
        try {
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(aramaSorgusu)}`;
          const res = await axios.get(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8'
            },
            timeout: 2500
          });

          // Match first watch video
          const vidMatch = res.data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
          if (vidMatch) {
            videoId = vidMatch[1];
            videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

            // Try fast title extraction from HTML
            const titleMatch = res.data.match(/"title":\{"runs":\[\{"text":"([^"]+)"/);
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1];
            }

            // Cache result for 0ms future queries
            this.searchCache.set(cacheKey, { videoId, title, thumbnail: thumbnailUrl });
          }
        } catch (err: any) {
          console.warn('[SongRequest] Fast search fallback error:', err?.message || err);
        }
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

    const songId = uuidv4();
    db.prepare(`
      INSERT INTO song_queue (id, title, url, duration, requested_by, platform, thumbnail, created_at, is_played)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(songId, title, videoUrl, 180, message.user.displayName, message.platform, thumbnailUrl, Date.now());
    if (videoKipi) void this.klipKatmaniniAc();

    // Auto open desktop player if enabled (video kipinde klip OBS'te çalar)
    const desktopTarget = settingsCache.get('sr_desktop_target', 'none');
    if (!videoKipi && (desktopTarget === 'spotify' || desktopTarget === 'ytmusic')) {
      this.openDesktopPlayer(desktopTarget as any, title, videoUrl);
    }

    const queueCount = (db.prepare('SELECT COUNT(*) as count FROM song_queue WHERE is_played = 0').get() as { count: number }).count;

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
      if (this.skipVotes.size >= this.requiredVotes) {
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

  getQueueList(): SongItem[] {
    const rows = db.prepare('SELECT * FROM song_queue WHERE is_played = 0 ORDER BY created_at ASC LIMIT 15').all() as any[];
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
