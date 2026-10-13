/**
 * StreamAxT — Twitch Helix istemcisi
 * Developed by AxthrowA
 *
 * Twitch sohbeti IRC ile okunuyor; moderasyon, yayın durumu ve kanal
 * bilgisi değişikliği ise yalnız Helix API ile yapılabilir. Kullanıcıdan
 * ayrıca Client-ID İSTEMİYORUZ: kayıtlı IRC jetonu `oauth2/validate` ile
 * doğrulanınca Twitch jetonun hangi uygulamaya (client_id) ve kime
 * (user_id) ait olduğunu söylüyor. Helix bu ikisiyle çağrılır.
 *
 * Kurallar ve belge kaynakları: `twitch-rules.ts`.
 */
import {
  kapsamVar,
  twitchHataAciklamasi,
  twitchJetonTemizle,
  twitchSureSinirla,
  twitchYayinCoz
} from './twitch-rules.js';

export interface TwitchDogrulama {
  clientId: string;
  login: string;
  userId: string;
  kapsamlar: string[];
  zaman: number;
}

export type HelixSonuc<T = any> = { ok: true; veri: T } | { ok: false; hata: string };

const HELIX = 'https://api.twitch.tv/helix';

export class TwitchHelix {
  private dogrulama: TwitchDogrulama | null = null;
  private kimlikler = new Map<string, string>();

  constructor(private jetonGetir: () => string) {}

  /** IRC mesajlarından gelen kullanıcı kimliğini önbelleğe alır (API çağrısı tasarrufu). */
  kimlikOgren(login: string, kimlik: string) {
    const l = String(login || '').toLowerCase();
    if (l && kimlik && /^\d+$/.test(kimlik)) this.kimlikler.set(l, kimlik);
    if (this.kimlikler.size > 5000) {
      const ilk = this.kimlikler.keys().next().value;
      if (ilk) this.kimlikler.delete(ilk);
    }
  }

  unut() {
    this.dogrulama = null;
  }

  /** Jetonu doğrular; 30 dk önbellekte tutar. */
  async dogrula(zorla = false): Promise<HelixSonuc<TwitchDogrulama>> {
    const jeton = twitchJetonTemizle(this.jetonGetir());
    if (!jeton) return { ok: false, hata: 'Twitch jetonu yok — Platformlar sekmesinden girin' };
    if (!zorla && this.dogrulama && Date.now() - this.dogrulama.zaman < 30 * 60_000) {
      return { ok: true, veri: this.dogrulama };
    }
    try {
      const r = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${jeton}` },
        signal: AbortSignal.timeout(8000)
      });
      const g: any = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, hata: twitchHataAciklamasi(r.status, g) };
      this.dogrulama = {
        clientId: String(g.client_id || ''),
        login: String(g.login || ''),
        userId: String(g.user_id || ''),
        kapsamlar: Array.isArray(g.scopes) ? g.scopes.map(String) : [],
        zaman: Date.now()
      };
      return { ok: true, veri: this.dogrulama };
    } catch (e: any) {
      return { ok: false, hata: `Twitch'e ulaşılamadı: ${String(e?.message || e).slice(0, 80)}` };
    }
  }

  private async istek(
    yontem: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    yol: string,
    govde?: unknown,
    gerekenKapsam?: string
  ): Promise<HelixSonuc> {
    const d = await this.dogrula();
    if (!d.ok) return d;
    if (gerekenKapsam && !kapsamVar(d.veri.kapsamlar, gerekenKapsam)) {
      return {
        ok: false,
        hata: `Twitch jetonunda "${gerekenKapsam}" izni yok — bu izinle yeni jeton alıp Platformlar'a girin`
      };
    }
    try {
      const r = await fetch(`${HELIX}${yol}`, {
        method: yontem,
        headers: {
          'Client-Id': d.veri.clientId,
          Authorization: `Bearer ${twitchJetonTemizle(this.jetonGetir())}`,
          'Content-Type': 'application/json'
        },
        body: govde === undefined ? undefined : JSON.stringify(govde),
        signal: AbortSignal.timeout(10_000)
      });
      if (r.status === 204) return { ok: true, veri: null };
      const g: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 401) this.unut();
        return { ok: false, hata: twitchHataAciklamasi(r.status, g, gerekenKapsam) };
      }
      return { ok: true, veri: g };
    } catch (e: any) {
      return { ok: false, hata: `Twitch isteği başarısız: ${String(e?.message || e).slice(0, 80)}` };
    }
  }

  async kullaniciKimligi(login: string): Promise<HelixSonuc<string>> {
    const l = String(login || '').replace(/^@/, '').toLowerCase();
    if (!l) return { ok: false, hata: 'Kullanıcı adı boş' };
    const onbellek = this.kimlikler.get(l);
    if (onbellek) return { ok: true, veri: onbellek };
    const r = await this.istek('GET', `/users?login=${encodeURIComponent(l)}`);
    if (!r.ok) return r;
    const id = String(r.veri?.data?.[0]?.id || '');
    if (!id) return { ok: false, hata: `Twitch'te "${l}" bulunamadı` };
    this.kimlikler.set(l, id);
    return { ok: true, veri: id };
  }

  /** Hesabın açılış anı (epoch ms). Helix `/users` → `created_at`. */
  async hesapOlusturma(login: string): Promise<number | null> {
    const l = String(login || '').replace(/^@/, '').toLowerCase();
    if (!l) return null;
    const r = await this.istek('GET', `/users?login=${encodeURIComponent(l)}`);
    if (!r.ok) return null;
    const u = r.veri?.data?.[0];
    if (u?.id) this.kimlikler.set(l, String(u.id));
    const t = Date.parse(String(u?.created_at || ''));
    return Number.isFinite(t) ? t : null;
  }

  async yayin(login: string) {
    const r = await this.istek('GET', `/streams?user_login=${encodeURIComponent(String(login).toLowerCase())}`);
    if (!r.ok) return r;
    return { ok: true as const, veri: twitchYayinCoz(r.veri) };
  }

  /** `saniye` verilmezse KALICI ban. */
  async yasakla(kanal: string, hedef: string, saniye?: number, sebep?: string): Promise<HelixSonuc> {
    const d = await this.dogrula();
    if (!d.ok) return d;
    const yayinci = await this.kullaniciKimligi(kanal);
    if (!yayinci.ok) return yayinci;
    const kisi = await this.kullaniciKimligi(hedef);
    if (!kisi.ok) return kisi;
    const veri: Record<string, unknown> = { user_id: kisi.veri };
    if (saniye !== undefined) veri.duration = twitchSureSinirla(saniye);
    if (sebep) veri.reason = String(sebep).slice(0, 500);
    return this.istek(
      'POST',
      `/moderation/bans?broadcaster_id=${yayinci.veri}&moderator_id=${d.veri.userId}`,
      { data: veri },
      'moderator:manage:banned_users'
    );
  }

  /** Ban ya da zaman aşımını kaldırır: `DELETE /moderation/bans`. */
  async yasakKaldir(kanal: string, hedef: string): Promise<HelixSonuc> {
    const d = await this.dogrula();
    if (!d.ok) return d;
    const yayinci = await this.kullaniciKimligi(kanal);
    if (!yayinci.ok) return yayinci;
    const kisi = await this.kullaniciKimligi(hedef);
    if (!kisi.ok) return kisi;
    return this.istek(
      'DELETE',
      `/moderation/bans?broadcaster_id=${yayinci.veri}&moderator_id=${d.veri.userId}&user_id=${kisi.veri}`,
      undefined,
      'moderator:manage:banned_users'
    );
  }

  async mesajSil(kanal: string, mesajId: string): Promise<HelixSonuc> {
    const d = await this.dogrula();
    if (!d.ok) return d;
    const yayinci = await this.kullaniciKimligi(kanal);
    if (!yayinci.ok) return yayinci;
    return this.istek(
      'DELETE',
      `/moderation/chat?broadcaster_id=${yayinci.veri}&moderator_id=${d.veri.userId}&message_id=${encodeURIComponent(mesajId)}`,
      undefined,
      'moderator:manage:chat_messages'
    );
  }

  /** Sohbet modları: `PATCH /chat/settings` (gövde `sohbetModuGovdesi` ile doğrulanmış olmalı). */
  async sohbetModlari(kanal: string, govde: Record<string, boolean | number>): Promise<HelixSonuc> {
    const d = await this.dogrula();
    if (!d.ok) return d;
    const yayinci = await this.kullaniciKimligi(kanal);
    if (!yayinci.ok) return yayinci;
    return this.istek(
      'PATCH',
      `/chat/settings?broadcaster_id=${yayinci.veri}&moderator_id=${d.veri.userId}`,
      govde,
      'moderator:manage:chat_settings'
    );
  }

  /** Kategori adıyla arar; tam eşleşme yoksa ilk sonuç. */
  async kategoriBul(ad: string): Promise<HelixSonuc<{ id: string; ad: string }>> {
    const r = await this.istek('GET', `/search/categories?query=${encodeURIComponent(ad)}&first=10`);
    if (!r.ok) return r;
    const liste: any[] = Array.isArray(r.veri?.data) ? r.veri.data : [];
    if (!liste.length) return { ok: false, hata: `"${ad}" adlı Twitch kategorisi bulunamadı` };
    const tam = liste.find((k) => String(k.name).toLowerCase() === String(ad).toLowerCase());
    const k = tam || liste[0];
    return { ok: true, veri: { id: String(k.id), ad: String(k.name) } };
  }

  /** Yayın başlığı / kategorisi. Jeton YAYINCININ olmalı (Twitch kuralı). */
  async kanalGuncelle(kanal: string, deg: { baslik?: string; kategoriId?: string }): Promise<HelixSonuc> {
    const d = await this.dogrula();
    if (!d.ok) return d;
    const yayinci = await this.kullaniciKimligi(kanal);
    if (!yayinci.ok) return yayinci;
    if (yayinci.veri !== d.veri.userId) {
      return { ok: false, hata: 'Twitch başlık/kategoriyi yalnız YAYINCININ jetonuyla değiştirir (bot hesabı olamaz)' };
    }
    const govde: Record<string, string> = {};
    if (deg.baslik) govde.title = deg.baslik.slice(0, 140);
    if (deg.kategoriId) govde.game_id = deg.kategoriId;
    return this.istek('PATCH', `/channels?broadcaster_id=${yayinci.veri}`, govde, 'channel:manage:broadcast');
  }
}
