/**
 * AxBoT — müzik "host"u: Spotify + YouTube Music Desktop, ortak "şu an çalan"
 * Developed by AxthrowA
 *
 * Resonance arayüzünün beklediği host API'sini (AxthrowA Studio'daki Rust
 * sürümüyle aynı biçim) sağlar; `!sr`, şarkı sözleri ve "Şu An Çalan"
 * widget'ı da buradan beslenir. Depolama ve yayın dışarıdan verilir: aynı
 * modül hem AxBoT'ta hem bağımsız Resonance sunucusunda çalışır.
 *
 * Sırlar (Spotify refresh token, YTMD token) depoya `gizli` işaretiyle yazılır;
 * AxBoT'ta Windows DPAPI ile şifrelenir. Hiçbir uçta düz dönmez.
 */
import axios from 'axios';
import {
  calaniAyikla,
  clientIdGecerliMi,
  koduAyikla,
  oynaticiHatasi,
  pkceUret,
  yetkiAdresi,
  type CalanSarki
} from './spotify-saf.js';

export interface MuzikDeposu {
  oku(anahtar: string): string;
  yaz(anahtar: string, deger: string, gizli?: boolean): void;
}

interface Bekleyen {
  dogrulayici: string;
  clientId: string;
  donus: string;
  durum: string;
  zaman: number;
}

const A = {
  clientId: 'spotify_client_id',
  refresh: 'spotify_refresh_token',
  ad: 'spotify_display_name',
  ytmdHost: 'ytmd_host',
  ytmdPort: 'ytmd_port',
  ytmdToken: 'ytmd_token',
  kaynak: 'muzik_kaynak'
};

const API = 'https://api.spotify.com/v1';

export class MuzikHost {
  private bekleyenler: Bekleyen[] = [];
  private erisim = { token: '', bitis: 0 };
  private calan: CalanSarki | null = null;
  private ytmdCalan: CalanSarki | null = null;
  private not = '';
  private yoklayici: NodeJS.Timeout | null = null;
  private sonrakiYoklama = 0;
  private parcaDinleyicileri: Array<(c: CalanSarki | null, onceki: CalanSarki | null) => void> = [];

  /**
   * Bot AxthrowA Studio'ya gömülüyken Spotify çoğunlukla ORADA bağlı: bot kendi
   * bağlantısı yokken o host'un çalan şarkısını okur, !sr isteğini oraya iletir.
   * Eskiden ikinci bir Spotify bağlantısı gerekiyordu; yoksa sözler boş, !sr çalmıyordu.
   */
  private harici = { spotify: false, ytmd: false, kaynak: '', sonraki: 0 };

  constructor(
    private depo: MuzikDeposu,
    private yayinla: (mesaj: unknown) => void,
    /** Harici host kökü (yalnız 127.0.0.1/localhost kabul edilir); boş = kapalı */
    private hariciKok: () => string = () => ''
  ) {}

  hariciAdres(): string {
    const k = String(this.hariciKok() || '').trim().replace(/\/+$/, '');
    try {
      const u = new URL(k);
      return u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname) ? k : '';
    } catch {
      return '';
    }
  }

  /** Kendi bağlantısı ya da harici host üzerinden Spotify kullanılabilir mi */
  spotifyKullanilabilir(): boolean {
    return this.spotifyBagliMi() || this.harici.spotify;
  }

  private async hariciYokla(): Promise<void> {
    const adres = this.hariciAdres();
    if (!adres || Date.now() < this.harici.sonraki) return;
    try {
      const r = await axios.get(`${adres}/api/player/status`, { timeout: 2000 });
      this.harici.spotify = Boolean(r.data?.spotify?.connected);
      this.harici.ytmd = Boolean(r.data?.ytmd?.connected);
      this.harici.kaynak = String(r.data?.source || '');
      const np = r.data?.nowPlaying;
      this.calaniGuncelle(
        np?.title
          ? {
              title: String(np.title),
              artist: String(np.artist || ''),
              album: String(np.album || ''),
              albumArt: String(np.albumArt || ''),
              isPlaying: Boolean(np.isPlaying),
              progress: Number(np.progress) || 0,
              duration: Number(np.duration) || 0,
              source: String(np.source || 'spotify'),
              updatedAt: Number(np.updatedAt) || Date.now()
            }
          : null,
        'spotify'
      );
    } catch {
      // Host kapalı (bağımsız kurulum): sık deneme
      this.harici.spotify = false;
      this.harici.ytmd = false;
      this.harici.sonraki = Date.now() + 15_000;
    }
  }

  /** Şarkıyı harici host'ta arar; `sira` ise Spotify sırasına ekler, değilse hemen çalar. */
  /**
   * İstekler hangi programa gitsin: şu an çalan programa (Spotify / YouTube Music Desktop),
   * yoksa YYA'da seçili kaynağa, o da yoksa bağlı olana. Hiçbiri bağlı değilse null.
   */
  hariciHedef(): 'spotify' | 'ytmd' | null {
    const { spotify, ytmd } = this.harici;
    if (!spotify && !ytmd) return null;
    if (spotify && !ytmd) return 'spotify';
    if (ytmd && !spotify) return 'ytmd';
    const calan = this.simdiCalan();
    const k = calan?.isPlaying ? calan.source : this.harici.kaynak;
    return k === 'youtube-music' ? 'ytmd' : 'spotify';
  }

  /** İstek işlenmeden önce YYA durumunu tazele (açılışta ilk yoklama gelmeden gelen istek kaybolmasın) */
  async hariciTazele(): Promise<void> {
    if (!this.spotifyBagliMi() && !this.ytmdBagliMi()) await this.hariciYokla();
  }

  async hariciIstek(sorgu: string, sira: boolean, videoId?: string): Promise<{ title: string; artist: string; uri: string }> {
    const adres = this.hariciAdres();
    if (!adres || (!this.harici.spotify && !this.harici.ytmd)) throw new Error('Spotify / YouTube Music bağlı değil');
    try {
      const r = await axios.post(`${adres}/api/player/request`, { query: sorgu.slice(0, 200), video_id: videoId, queue: sira }, { timeout: 10_000 });
      setTimeout(() => void this.hariciYokla().catch(() => {}), 1500).unref?.();
      return { title: String(r.data?.title || sorgu), artist: String(r.data?.artist || ''), uri: String(r.data?.id || '') };
    } catch (e: any) {
      throw new Error(String(e?.response?.data || e?.message || e).slice(0, 160));
    }
  }

  // ─── Durum ────────────────────────────────────────────────────────────

  spotifyBagliMi(): boolean {
    return Boolean(this.depo.oku(A.clientId) && this.depo.oku(A.refresh));
  }

  ytmdBagliMi(): boolean {
    return Boolean(this.depo.oku(A.ytmdToken));
  }

  kaynak(): string {
    const k = this.depo.oku(A.kaynak);
    if (k === 'spotify' || k === 'youtube-music') return k;
    return this.spotifyBagliMi() ? 'spotify' : this.ytmdBagliMi() ? 'youtube-music' : 'spotify';
  }

  kaynakSec(k: string) {
    if (k === 'spotify' || k === 'youtube-music') this.depo.yaz(A.kaynak, k);
  }

  /** Ortak "şu an çalan": seçili kaynak öncelikli, çalan duraklatılmışa üstün. */
  simdiCalan(): CalanSarki | null {
    const adaylar = [this.calan, this.ytmdCalan].filter(Boolean) as CalanSarki[];
    if (!adaylar.length) return null;
    const tercih = adaylar.find((c) => c.source === this.kaynak() && c.isPlaying);
    return tercih || adaylar.find((c) => c.isPlaying) || adaylar.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }

  notYaz(n: string) {
    this.not = n;
  }

  durum() {
    return {
      source: this.kaynak(),
      sourceAuto: true,
      spotify: {
        connected: this.spotifyBagliMi(),
        clientId: this.depo.oku(A.clientId),
        displayName: this.depo.oku(A.ad)
      },
      ytmd: {
        connected: this.ytmdBagliMi(),
        host: this.depo.oku(A.ytmdHost) || '127.0.0.1',
        port: this.depo.oku(A.ytmdPort) || '9863'
      },
      note: this.not || null,
      // Spotify AxthrowA Studio'da bağlıysa bot onu kullanır
      harici: { spotify: this.harici.spotify },
      nowPlaying: this.simdiCalan()
    };
  }

  /** Parça değişince haber ver (istek kuyruğu, şarkı sözü) */
  parcaDegisince(f: (c: CalanSarki | null, onceki: CalanSarki | null) => void) {
    this.parcaDinleyicileri.push(f);
  }

  private calaniGuncelle(yeni: CalanSarki | null, kaynak: 'spotify' | 'youtube-music') {
    const onceki = this.simdiCalan();
    if (kaynak === 'spotify') this.calan = yeni;
    else this.ytmdCalan = yeni;
    const simdi = this.simdiCalan();
    this.yayinla({ type: 'now-playing', data: simdi });
    const anahtar = (c: CalanSarki | null) => (c ? `${c.source}:${c.title}:${c.artist}` : '');
    if (anahtar(onceki) !== anahtar(simdi)) {
      for (const f of this.parcaDinleyicileri) {
        try {
          f(simdi, onceki);
        } catch {
          /* dinleyici hatası yoklamayı durdurmasın */
        }
      }
    }
  }

  /** Resonance köprüsü (tarayıcıdaki YTMD soketi) buraya yazar. null = çalmıyor */
  ytmdCalanYaz(govde: any) {
    if (!govde || typeof govde !== 'object' || !govde.title) return this.calaniGuncelle(null, 'youtube-music');
    this.calaniGuncelle(
      {
        title: String(govde.title).slice(0, 300),
        artist: String(govde.artist || '').slice(0, 300),
        album: String(govde.album || '').slice(0, 300),
        albumArt: /^https:\/\//.test(String(govde.albumArt || '')) ? String(govde.albumArt) : '',
        isPlaying: Boolean(govde.isPlaying),
        progress: Math.max(0, Number(govde.progress) || 0),
        duration: Math.max(0, Number(govde.duration) || 0),
        source: 'youtube-music',
        updatedAt: Date.now()
      },
      'youtube-music'
    );
  }

  // ─── Spotify yetkilendirme ─────────────────────────────────────────────

  yetkiBaslat(clientId: string, donus: string): string {
    const id = String(clientId || '').trim();
    if (!clientIdGecerliMi(id)) throw new Error("Geçerli bir Spotify Client ID gerekli (Spotify Developer Dashboard → uygulaman → Settings).");
    const { dogrulayici, meydanOkuma } = pkceUret();
    const durum = pkceUret().dogrulayici.slice(0, 16);
    const simdi = Date.now();
    this.bekleyenler = [...this.bekleyenler.filter((b) => simdi - b.zaman < 15 * 60_000), { dogrulayici, clientId: id, donus, durum, zaman: simdi }].slice(-5);
    this.depo.yaz(A.clientId, id);
    this.not = `Onay bekleniyor. Spotify Dashboard → Redirect URIs listesinde tam olarak şu adres kayıtlı olmalı: ${donus}`;
    return yetkiAdresi(id, donus, meydanOkuma, durum);
  }

  /** Dönüşteki kodu token'a çevirir. `durum` verilirse eşleşen bekleyen kullanılır. */
  async koduTakasEt(hamKod: string, durum?: string): Promise<string> {
    const k = koduAyikla(hamKod);
    if ('hata' in k) throw new Error(k.hata);
    // `undefined` = elle yapıştırma (state yok); verilmiş ama boş state hiçbiriyle eşleşmez
    const adaylar = [...this.bekleyenler].reverse().filter((b) => durum === undefined || b.durum === durum);
    if (!adaylar.length) throw new Error("Bekleyen Spotify yetkilendirmesi yok — 'Bağlan'a basıp baştan başla.");
    let sonHata = '';
    for (const b of adaylar) {
      try {
        const r = await axios.post(
          'https://accounts.spotify.com/api/token',
          new URLSearchParams({ client_id: b.clientId, grant_type: 'authorization_code', code: k.kod, redirect_uri: b.donus, code_verifier: b.dogrulayici }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
        );
        this.bekleyenler = this.bekleyenler.filter((x) => x !== b);
        return await this.tokenlariKaydet(b.clientId, r.data);
      } catch (e: any) {
        sonHata = String(e?.response?.data?.error_description || e?.response?.data?.error || e?.message || e);
      }
    }
    this.not = `Spotify bağlanamadı: ${sonHata}`;
    throw new Error(this.not);
  }

  /** Hazır refresh token ile bağlanma (onay akışı olmadan). */
  async refreshIleBaglan(clientId: string, refresh: string): Promise<string> {
    if (!clientIdGecerliMi(clientId)) throw new Error('Geçersiz Client ID');
    if (!String(refresh || '').trim()) throw new Error('Refresh token boş');
    this.depo.yaz(A.clientId, clientId.trim());
    this.depo.yaz(A.refresh, refresh.trim(), true);
    this.erisim = { token: '', bitis: 0 };
    await this.erisimTokeni();
    return this.profilAdi();
  }

  private async tokenlariKaydet(clientId: string, veri: any): Promise<string> {
    if (!veri?.access_token || !veri?.refresh_token) throw new Error('Spotify token yanıtı eksik');
    this.depo.yaz(A.clientId, clientId);
    this.depo.yaz(A.refresh, String(veri.refresh_token), true);
    this.erisim = { token: String(veri.access_token), bitis: Date.now() + (Number(veri.expires_in) || 3600) * 1000 };
    this.not = '';
    const ad = await this.profilAdi();
    this.yoklamayiBaslat();
    return ad;
  }

  private async profilAdi(): Promise<string> {
    try {
      const r = await axios.get(`${API}/me`, { headers: { Authorization: `Bearer ${await this.erisimTokeni()}` }, timeout: 10000 });
      const ad = String(r.data?.display_name || r.data?.id || '');
      this.depo.yaz(A.ad, ad.slice(0, 80));
      return ad;
    } catch {
      return '';
    }
  }

  baglantiyiKes() {
    this.depo.yaz(A.refresh, '', true);
    this.depo.yaz(A.ad, '');
    this.erisim = { token: '', bitis: 0 };
    this.calaniGuncelle(null, 'spotify');
  }

  private async erisimTokeni(): Promise<string> {
    if (this.erisim.token && Date.now() < this.erisim.bitis - 30_000) return this.erisim.token;
    const clientId = this.depo.oku(A.clientId);
    const refresh = this.depo.oku(A.refresh);
    if (!clientId || !refresh) throw new Error('Spotify bağlı değil');
    try {
      const r = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refresh }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
      );
      this.erisim = { token: String(r.data.access_token), bitis: Date.now() + (Number(r.data.expires_in) || 3600) * 1000 };
      // Spotify bazen yeni refresh token verir (PKCE'de döner)
      if (r.data.refresh_token) this.depo.yaz(A.refresh, String(r.data.refresh_token), true);
      return this.erisim.token;
    } catch (e: any) {
      if (e?.response?.status === 400) {
        this.not = 'Spotify oturumu geçersizleşti — yeniden bağlan.';
        this.baglantiyiKes();
      }
      throw new Error(this.not || `Spotify oturumu yenilenemedi (${e?.response?.status || e?.message})`);
    }
  }

  // ─── Spotify oynatıcı ───────────────────────────────────────────────────

  private async istek(yontem: 'get' | 'put' | 'post', yol: string, govde?: unknown) {
    const token = await this.erisimTokeni();
    return axios.request({
      method: yontem,
      url: `${API}${yol}`,
      data: govde,
      headers: { Authorization: `Bearer ${token}`, ...(govde ? {} : { 'Content-Length': '0' }) },
      timeout: 10000,
      validateStatus: () => true
    });
  }

  async spotifyYokla(): Promise<void> {
    const r = await this.istek('get', '/me/player/currently-playing?additional_types=track,episode');
    if (r.status === 204) return this.calaniGuncelle(null, 'spotify');
    if (r.status === 429) {
      this.sonrakiYoklama = Date.now() + (Number(r.headers['retry-after']) || 30) * 1000;
      return;
    }
    if (r.status >= 400) throw new Error(oynaticiHatasi(r.status));
    this.calaniGuncelle(calaniAyikla(r.data), 'spotify');
  }

  yoklamayiBaslat() {
    if (this.yoklayici) return;
    let sonHarici = 0;
    this.yoklayici = setInterval(async () => {
      if (!this.spotifyBagliMi() && !this.ytmdBagliMi()) {
        // Konum aradaki sürede saatle ilerletilir: saniyede bir sormak yeter
        if (Date.now() - sonHarici < 900) return;
        sonHarici = Date.now();
        return this.hariciYokla();
      }
      if (!this.spotifyBagliMi() || Date.now() < this.sonrakiYoklama) return;
      try {
        await this.spotifyYokla();
        // Durdurma ve başlatma en geç 1 sn'de görünür; hata olursa aşağıda 30 sn ara verilir
        this.sonrakiYoklama = Date.now() + 900;
      } catch {
        // Ağ/oturum hatasında 30 sn ara ver (Spotify'a yüklenme)
        this.sonrakiYoklama = Date.now() + 30_000;
      }
    }, 500);
    this.yoklayici.unref?.();
  }

  yoklamayiDurdur() {
    if (this.yoklayici) clearInterval(this.yoklayici);
    this.yoklayici = null;
  }

  async parcaAra(sorgu: string): Promise<{ uri: string; id: string; title: string; artist: string; albumArt: string; sureMs: number } | null> {
    const q = String(sorgu || '').trim().slice(0, 200);
    if (!q) return null;
    const r = await this.istek('get', `/search?${new URLSearchParams({ q, type: 'track', limit: '1' }).toString()}`);
    if (r.status >= 400) throw new Error(oynaticiHatasi(r.status));
    const t = r.data?.tracks?.items?.[0];
    if (!t?.uri) return null;
    return {
      uri: String(t.uri),
      id: String(t.id),
      title: String(t.name || q),
      artist: (t.artists || []).map((a: any) => a?.name).filter(Boolean).join(', '),
      albumArt: String(t.album?.images?.[0]?.url || ''),
      sureMs: Number(t.duration_ms) || 0
    };
  }

  async parcaBilgisi(id: string): Promise<{ uri: string; id: string; title: string; artist: string; albumArt: string; sureMs: number } | null> {
    if (!/^[A-Za-z0-9]{22}$/.test(id)) return null;
    const r = await this.istek('get', `/tracks/${id}`);
    if (r.status >= 400) throw new Error(oynaticiHatasi(r.status));
    const t = r.data;
    return {
      uri: `spotify:track:${id}`,
      id,
      title: String(t?.name || ''),
      artist: (t?.artists || []).map((a: any) => a?.name).filter(Boolean).join(', '),
      albumArt: String(t?.album?.images?.[0]?.url || ''),
      sureMs: Number(t?.duration_ms) || 0
    };
  }

  /** Spotify sırasına ekler (mevcut şarkı bitince çalar) ya da hemen çalar. */
  async parcayiCal(uri: string, hemen: boolean): Promise<void> {
    if (!/^spotify:track:[A-Za-z0-9]{22}$/.test(uri)) throw new Error('Geçersiz Spotify parçası');
    const r = hemen
      ? await this.istek('put', '/me/player/play', { uris: [uri] })
      : await this.istek('post', `/me/player/queue?uri=${encodeURIComponent(uri)}`);
    if (r.status >= 400) throw new Error(oynaticiHatasi(r.status));
    setTimeout(() => void this.spotifyYokla().catch(() => {}), 1500).unref?.();
  }

  async spotifyKomut(eylem: string): Promise<void> {
    const calan = this.calan?.isPlaying;
    const tablo: Record<string, ['put' | 'post', string]> = {
      play: ['put', '/me/player/play'],
      pause: ['put', '/me/player/pause'],
      playPause: ['put', calan ? '/me/player/pause' : '/me/player/play'],
      next: ['post', '/me/player/next'],
      previous: ['post', '/me/player/previous']
    };
    const t = tablo[eylem] || (['muteToggle', 'toggleMute', 'mute', 'unmute'].includes(eylem) ? tablo.playPause : null);
    if (!t) throw new Error(`bilinmeyen komut: ${eylem}`);
    const r = await this.istek(t[0], t[1]);
    if (r.status >= 400) throw new Error(oynaticiHatasi(r.status));
    await this.spotifyYokla().catch(() => {});
  }

  async sonCalinanlar(limit: number): Promise<unknown> {
    const l = Math.min(50, Math.max(1, Math.floor(Number(limit)) || 50));
    const r = await this.istek('get', `/me/player/recently-played?limit=${l}`);
    if (r.status >= 400) throw new Error(oynaticiHatasi(r.status));
    return r.data;
  }

  // ─── YouTube Music Desktop ─────────────────────────────────────────────

  ytmdOturumu(govde: any) {
    const token = String(govde?.token || '');
    if (!token) {
      this.depo.yaz(A.ytmdToken, '', true);
      this.calaniGuncelle(null, 'youtube-music');
      return;
    }
    const host = String(govde?.host || '').trim();
    const port = String(govde?.port || '').trim();
    // Yalnız yerel YTMD Companion Server'a gidilir (SSRF olmasın)
    if (host && !/^(127\.0\.0\.1|localhost|\[::1\])$/i.test(host)) throw new Error('YTMD yalnız bu bilgisayarda (127.0.0.1) olabilir');
    if (port && !/^\d{2,5}$/.test(port)) throw new Error('Geçersiz port');
    if (host) this.depo.yaz(A.ytmdHost, host);
    if (port) this.depo.yaz(A.ytmdPort, port);
    this.depo.yaz(A.ytmdToken, token.slice(0, 500), true);
  }

  private async ytmdKomut(eylem: string): Promise<void> {
    const token = this.depo.oku(A.ytmdToken);
    if (!token) throw new Error('YouTube Music Desktop bağlı değil');
    const host = this.depo.oku(A.ytmdHost) || '127.0.0.1';
    const port = this.depo.oku(A.ytmdPort) || '9863';
    const komut = ['play', 'pause', 'playPause', 'next', 'previous', 'mute', 'unmute'].includes(eylem)
      ? eylem
      : eylem === 'muteToggle' || eylem === 'toggleMute'
        ? 'playPause'
        : null;
    if (!komut) throw new Error(`bilinmeyen komut: ${eylem}`);
    for (const baslik of [token, `Bearer ${token}`]) {
      const r = await axios.post(`http://${host}:${port}/api/v1/command`, { command: komut }, {
        headers: { Authorization: baslik },
        timeout: 5000,
        validateStatus: () => true
      });
      if (r.status < 300) return;
      if (r.status !== 401) throw new Error(`YTMD komutu başarısız (${r.status})`);
    }
    throw new Error('YTMD yetkilendirmesi reddedildi — yeniden bağlan');
  }

  /** Seçili kaynak önce, olmazsa diğeri */
  async komut(eylem: string, kaynak?: string): Promise<void> {
    const tercih = kaynak || this.kaynak();
    const sira = tercih === 'youtube-music' ? ['youtube-music', 'spotify'] : ['spotify', 'youtube-music'];
    let son: Error | null = null;
    const adres = this.hariciAdres();
    if (!this.spotifyBagliMi() && !this.ytmdBagliMi() && adres && this.hariciHedef()) {
      await axios.post(`${adres}/api/player/command`, { action: eylem, source: this.hariciHedef() === 'ytmd' ? 'youtube-music' : 'spotify' }, { timeout: 5000 });
      return;
    }
    for (const k of sira) {
      const bagli = k === 'spotify' ? this.spotifyBagliMi() : this.ytmdBagliMi();
      if (!bagli) continue;
      try {
        return k === 'spotify' ? await this.spotifyKomut(eylem) : await this.ytmdKomut(eylem);
      } catch (e: any) {
        son = e;
      }
    }
    throw son || new Error('Müzik kaynağı bağlı değil — Spotify ya da YouTube Music Desktop bağla');
  }
}
