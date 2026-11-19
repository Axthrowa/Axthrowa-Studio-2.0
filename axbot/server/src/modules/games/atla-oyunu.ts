/**
 * AxBoT — !atla oyunu (sunucu)
 * Developed by AxthrowA
 *
 * İzleyici `!atla [emote]` yazar; sunucu kimlikli bir atlayış yollar, OBS katmanı karakteri paraşütle
 * düşürür ve inişte puanı bildirir. Puanı sunucu kabul eder: atlayış kimliği yalnız bir kez sayılır,
 * süresi geçen ya da bilinmeyen kimlik yok sayılır, puan 0–100'e kırpılır. Sohbet yanıtı, sadakat puanı ve
 * skor tablosu buradan.
 *
 * Mod: `!topluatla [sn]` bekleme açar (herkes `!atla` yazar, süre bitince ya da `!atlat` ile hep birlikte
 * atlar), `!atlaiptal` beklemeyi kapatır, `!atlasifirla onay` skor tablosunu siler.
 */
import { db } from '../../db/index.js';
import { economy, cuzdanAdi } from '../economy/economy.js';
import { eventBus, type ChatMessagePayload } from '../../core/event-bus.js';

export interface AtlaSunucuAyari {
  beklemeSn: number;
  enCokHavada: number;
  puanCarpani: number;
  iskaDuyur: boolean;
  topluSn: number;
}

const VARSAYILAN: AtlaSunucuAyari = { beklemeSn: 30, enCokHavada: 8, puanCarpani: 1, iskaDuyur: false, topluSn: 30 };
const SONUC_SURESI_MS = 90_000;
const TOPLU_EN_COK = 60;

/** Panelde kaydedilmiş widget ayarından sunucunun kullandığı alanlar (sınırlı) */
export function sunucuAyari(ham: unknown): AtlaSunucuAyari {
  const j = ham && typeof ham === 'object' ? (ham as Record<string, unknown>) : {};
  const sayi = (v: unknown, varsayilan: number, en: number, cok: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(cok, Math.max(en, n)) : varsayilan;
  };
  return {
    beklemeSn: Math.round(sayi(j.beklemeSn, VARSAYILAN.beklemeSn, 0, 3600)),
    enCokHavada: Math.round(sayi(j.enCokHavada, VARSAYILAN.enCokHavada, 1, 40)),
    puanCarpani: sayi(j.puanCarpani, VARSAYILAN.puanCarpani, 0, 100),
    iskaDuyur: j.iskaDuyur === true,
    topluSn: Math.round(sayi(j.topluSn, VARSAYILAN.topluSn, 5, 600))
  };
}

/** Katmanın bildirdiği puan: tam sayı, 0–100; geçersizse null */
export function puanGecerli(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number.NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Kişi başı bekleme: kalan saniye (0 = atlayabilir) */
export function beklemeKalan(son: number | undefined, beklemeSn: number, simdi = Date.now()): number {
  if (!son || beklemeSn <= 0) return 0;
  return Math.max(0, Math.ceil((son + beklemeSn * 1000 - simdi) / 1000));
}

export function sonucMetni(gorunen: string, puan: number, kazanc: number): string {
  if (puan >= 100) return `🎯 TAM İSABET! @${gorunen} hedefin tam ortasına indi: 100 puan${kazanc ? ` (+${kazanc})` : ''}`;
  if (puan >= 95) return `🎯 @${gorunen} neredeyse tam ortaya indi: ${puan} puan${kazanc ? ` (+${kazanc})` : ''}`;
  if (puan > 0) return `🪂 @${gorunen} hedefe indi: ${puan} puan${kazanc ? ` (+${kazanc})` : ''}`;
  return `💦 @${gorunen} hedefi ıskaladı.`;
}

export interface TabloSatiri {
  kullanici: string;
  gorunen: string;
  enIyi: number;
  toplam: number;
  atlayis: number;
  isabet: number;
}

type Bekleyen = { kullanici: string; gorunen: string; platform: string; zaman: number };
type Istek = { id: string; kullanici: string; gorunen: string; platform: string; emote?: { ad: string; url?: string } };

let sayac = 0;
const yeniKimlik = () => `${Date.now().toString(36)}-${(++sayac).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export class AtlaOyunu {
  private sonAtlayis = new Map<string, number>();
  private bekleyenler = new Map<string, Bekleyen>();
  private toplu: { bitis: number; sira: Istek[]; zaman: ReturnType<typeof setTimeout> } | null = null;
  /** Testte yerine sahte konur */
  yayinla: (ileti: Record<string, unknown>) => void = () => {};
  katmanAcikMi: () => boolean = () => true;
  sohbeteYaz: (platform: string, metin: string) => void = (platform, message) =>
    eventBus.emitBotMessage({ platform: platform as any, message });

  ayar(): AtlaSunucuAyari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get('widget_settings_atla-oyunu') as { value?: string } | undefined;
      return sunucuAyari(JSON.parse(r?.value || '{}'));
    } catch {
      return { ...VARSAYILAN };
    }
  }

  private havada(): number {
    const sinir = Date.now() - SONUC_SURESI_MS;
    for (const [id, b] of this.bekleyenler) if (b.zaman < sinir) this.bekleyenler.delete(id);
    return this.bekleyenler.size;
  }

  /** `!atla [emote]`: atlayışı başlatır ya da toplu bekleyişe ekler. Dönen metin sohbete yazılır (boş = sessiz). */
  atla(m: ChatMessagePayload, emote?: { ad: string; url?: string }): string {
    const kullanici = cuzdanAdi(m.platform, m.user.username);
    const gorunen = m.user.displayName || m.user.username;
    if (!kullanici) return '';
    if (!this.katmanAcikMi()) return `@${gorunen}, atlama alanı şu an kapalı (Atla Oyunu katmanı OBS'te açık değil).`;
    const a = this.ayar();
    if (this.toplu) {
      if (this.toplu.sira.some((x) => x.kullanici === kullanici)) return '';
      if (this.toplu.sira.length >= TOPLU_EN_COK) return `@${gorunen}, uçak doldu! Bir sonraki tura.`;
      this.toplu.sira.push({ id: yeniKimlik(), kullanici, gorunen, platform: m.platform, emote });
      this.topluYayinla();
      return '';
    }
    const kalan = beklemeKalan(this.sonAtlayis.get(kullanici), a.beklemeSn);
    if (kalan > 0) return `@${gorunen}, tekrar atlamak için ${kalan} sn bekle.`;
    if ([...this.bekleyenler.values()].some((b) => b.kullanici === kullanici)) return '';
    if (this.havada() >= a.enCokHavada) return `@${gorunen}, gökyüzü kalabalık, birkaç saniye sonra dene.`;
    this.gonder({ id: yeniKimlik(), kullanici, gorunen, platform: m.platform, emote });
    return '';
  }

  private gonder(i: Istek) {
    this.sonAtlayis.set(i.kullanici, Date.now());
    if (this.sonAtlayis.size > 5000) this.sonAtlayis.delete(this.sonAtlayis.keys().next().value as string);
    this.bekleyenler.set(i.id, { kullanici: i.kullanici, gorunen: i.gorunen, platform: i.platform, zaman: Date.now() });
    this.yayinla({ type: 'atla_oyunu_atla', data: { id: i.id, kullanici: i.kullanici.replace(/^[a-z]+:/, ''), gorunen: i.gorunen, platform: i.platform, emote: i.emote } });
  }

  /** Katmanın bildirdiği iniş. Yalnız bilinen, süresi geçmemiş kimlik bir kez sayılır. */
  sonuc(id: unknown, puanHam: unknown): { kabul: boolean; puan?: number } {
    const kimlik = String(id || '');
    const b = this.bekleyenler.get(kimlik);
    const puan = puanGecerli(puanHam);
    if (!b || puan === null || Date.now() - b.zaman > SONUC_SURESI_MS) return { kabul: false };
    this.bekleyenler.delete(kimlik);
    const a = this.ayar();
    const kazanc = puan > 0 ? Math.round(puan * a.puanCarpani) : 0;
    if (kazanc > 0) {
      try {
        economy.addPoints(b.kullanici, kazanc);
      } catch {
        /* puan sistemi kapalıysa skor yine yazılır */
      }
    }
    this.kaydet(b.kullanici, b.gorunen, puan);
    if (puan > 0 || a.iskaDuyur) this.sohbeteYaz(b.platform, sonucMetni(b.gorunen, puan, kazanc));
    this.yayinla({ type: 'atla_oyunu_tablo', tablo: this.tablo(5).map(({ gorunen, enIyi, toplam }) => ({ gorunen, enIyi, toplam })) });
    return { kabul: true, puan };
  }

  // --- toplu atlama ---
  topluAc(sn?: number): string {
    if (this.toplu) return `🪂 Toplu atlama zaten açık (${Math.ceil((this.toplu.bitis - Date.now()) / 1000)} sn).`;
    if (!this.katmanAcikMi()) return "Atla Oyunu katmanı OBS'te açık değil.";
    const sure = Math.max(5, Math.min(600, Math.round(sn || this.ayar().topluSn)));
    this.toplu = { bitis: Date.now() + sure * 1000, sira: [], zaman: setTimeout(() => this.birak(), sure * 1000) };
    this.topluYayinla();
    return `🪂 TOPLU ATLAMA! ${sure} sn içinde !atla yazan herkes aynı anda atlayacak.`;
  }

  birak(): string {
    const t = this.toplu;
    if (!t) return 'Bekleyen toplu atlama yok.';
    clearTimeout(t.zaman);
    this.toplu = null;
    this.yayinla({ type: 'atla_oyunu_toplu', acik: false });
    // Bir anda değil, çok kısa aralıklarla: hepsi aynı karede çıkınca üst üste biniyordu
    t.sira.forEach((i, n) => setTimeout(() => this.gonder(i), n * 140));
    return t.sira.length ? `🪂 ${t.sira.length} kişi atladı!` : 'Toplu atlamaya kimse katılmadı.';
  }

  iptal(): string {
    if (!this.toplu) return 'Bekleyen toplu atlama yok.';
    clearTimeout(this.toplu.zaman);
    this.toplu = null;
    this.yayinla({ type: 'atla_oyunu_toplu', acik: false });
    return 'Toplu atlama iptal edildi.';
  }

  private topluYayinla() {
    if (this.toplu) this.yayinla({ type: 'atla_oyunu_toplu', acik: true, bitis: this.toplu.bitis, bekleyen: this.toplu.sira.length });
  }

  // --- skor ---
  private kaydet(kullanici: string, gorunen: string, puan: number) {
    try {
      db.prepare(
        `INSERT INTO atla_skorlar (kullanici, gorunen, en_iyi, toplam, atlayis, isabet, son_puan, son_tarih)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)
         ON CONFLICT(kullanici) DO UPDATE SET gorunen = excluded.gorunen, en_iyi = MAX(en_iyi, excluded.en_iyi),
           toplam = toplam + excluded.toplam, atlayis = atlayis + 1, isabet = isabet + excluded.isabet,
           son_puan = excluded.son_puan, son_tarih = excluded.son_tarih`
      ).run(kullanici, gorunen.slice(0, 40), puan, puan, puan > 0 ? 1 : 0, puan, Date.now());
    } catch (e) {
      console.warn('[Atla] Skor yazılamadı:', (e as Error).message);
    }
  }

  tablo(adet = 5): TabloSatiri[] {
    try {
      return (
        db
          .prepare('SELECT kullanici, gorunen, en_iyi AS enIyi, toplam, atlayis, isabet FROM atla_skorlar WHERE atlayis > 0 ORDER BY en_iyi DESC, toplam DESC, son_tarih ASC LIMIT ?')
          .all(Math.max(1, Math.min(50, adet))) as unknown as TabloSatiri[]
      ).map((r) => ({ ...r }));
    } catch {
      return [];
    }
  }

  skor(m: ChatMessagePayload): string {
    const gorunen = m.user.displayName || m.user.username;
    try {
      const r = db.prepare('SELECT en_iyi, toplam, atlayis, isabet FROM atla_skorlar WHERE kullanici = ?').get(cuzdanAdi(m.platform, m.user.username)) as
        | { en_iyi: number; toplam: number; atlayis: number; isabet: number }
        | undefined;
      if (!r || !r.atlayis) return `@${gorunen}, henüz hiç atlamadın. !atla yaz!`;
      return `🪂 @${gorunen}: en iyi ${r.en_iyi} · toplam ${r.toplam} puan · ${r.atlayis} atlayış, ${r.isabet} isabet`;
    } catch {
      return '';
    }
  }

  enler(): string {
    const t = this.tablo(5);
    if (!t.length) return 'Henüz kimse hedefe inmedi. İlk sen ol: !atla';
    return '🏆 En iyi atlayışlar: ' + t.map((r, i) => `${i + 1}. ${r.gorunen} (${r.enIyi})`).join(' | ');
  }

  sifirla(): string {
    try {
      db.prepare('DELETE FROM atla_skorlar').run();
    } catch {
      /* tablo yoksa zaten boş */
    }
    this.yayinla({ type: 'atla_oyunu_tablo', tablo: [] });
    this.yayinla({ type: 'atla_oyunu_sifirla' });
    return '🧹 Atla skor tablosu sıfırlandı.';
  }
}

export const atlaOyunu = new AtlaOyunu();
