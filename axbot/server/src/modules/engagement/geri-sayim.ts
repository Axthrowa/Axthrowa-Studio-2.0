/**
 * AxBoT — Geri sayım (sohbetten yönetilir)
 * Developed by AxthrowA
 *
 * Örnek alınan uzantı listesinde sohbetten başlatılan bir yayın sayacı vardı; bizde yalnız
 * subathon'un kendi sayacı ve Studio'nun "Başlıyor" ekranı vardı. Bu modül tek bir geri sayımı
 * tutar, değişince `geri_sayim_durumu` yayınlar; OBS katmanı (`/widgets/geri-sayim`) onu çizer.
 *
 * !gerisayim 10m Yayın başlıyor · !gerisayim 20:30 · !gerisayim +2m · !gerisayim duraklat|devam|dur
 */
import { db } from '../../db/index.js';
import { eventBus } from '../../core/event-bus.js';

const ANAHTAR = 'geri_sayim_durumu';
const EN_COK_MS = 24 * 3600_000;

export interface GeriSayimDurumu {
  /** Bitiş anı (ms). Duraklatılmışsa ya da sayaç yoksa null */
  bitis: number | null;
  /** Duraklatılmışken kalan süre (ms) */
  kalanMs: number | null;
  /** Başlangıçtaki toplam süre (ilerleme çubuğu için) */
  toplamMs: number;
  baslik: string;
}

export const BOS_DURUM: GeriSayimDurumu = { bitis: null, kalanMs: null, toplamMs: 0, baslik: '' };

/** "10m", "90s", "1h30m", "1sa 5dk", "15" (dakika) → ms; geçersizse null */
export function sureMs(metin: string): number | null {
  const m = String(metin || '').trim().toLowerCase().replace(',', '.');
  if (!m) return null;
  if (/^\d+(\.\d+)?$/.test(m)) return Math.round(Number(m) * 60_000) || null;
  const birim: Record<string, number> = { h: 3600_000, sa: 3600_000, s: 1000, sn: 1000, m: 60_000, dk: 60_000, d: 60_000 };
  let toplam = 0;
  let kalan = m.replace(/\s+/g, '');
  const re = /^(\d+(?:\.\d+)?)(sa|sn|dk|h|m|s|d)/;
  while (kalan) {
    const p = re.exec(kalan);
    if (!p) return null;
    toplam += Number(p[1]) * birim[p[2]];
    kalan = kalan.slice(p[0].length);
  }
  return toplam > 0 ? Math.round(toplam) : null;
}

/** "20:30" → bugün (geçtiyse yarın) o saate kalan ms; saat değilse null */
export function saateKalan(metin: string, simdi: Date): number | null {
  const p = /^(\d{1,2})[:.](\d{2})$/.exec(String(metin || '').trim());
  if (!p) return null;
  const sa = Number(p[1]);
  const dk = Number(p[2]);
  if (sa > 23 || dk > 59) return null;
  const hedef = new Date(simdi);
  hedef.setHours(sa, dk, 0, 0);
  if (hedef.getTime() <= simdi.getTime()) hedef.setDate(hedef.getDate() + 1);
  return hedef.getTime() - simdi.getTime();
}

/** Kalan süre (ms), sayaç yoksa 0 */
export function kalanSure(d: GeriSayimDurumu, simdi: number): number {
  if (d.kalanMs !== null) return Math.max(0, d.kalanMs);
  if (d.bitis === null) return 0;
  return Math.max(0, d.bitis - simdi);
}

/** 3725000 → "1:02:05", 65000 → "1:05" */
export function sureYazisi(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const sa = Math.floor(t / 3600);
  const dk = Math.floor((t % 3600) / 60);
  const sn = t % 60;
  const iki = (n: number) => String(n).padStart(2, '0');
  return sa > 0 ? `${sa}:${iki(dk)}:${iki(sn)}` : `${dk}:${iki(sn)}`;
}

class GeriSayim {
  private d: GeriSayimDurumu = { ...BOS_DURUM };
  private yuklendi = false;

  private yukle() {
    if (this.yuklendi) return;
    this.yuklendi = true;
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(ANAHTAR) as { value?: string } | undefined;
      if (r?.value) this.d = { ...BOS_DURUM, ...JSON.parse(r.value) };
    } catch {
      /* bozuk kayıt: boş başla */
    }
  }

  private kaydet() {
    try {
      db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
        ANAHTAR,
        JSON.stringify(this.d)
      );
    } catch (e) {
      console.warn('[GeriSayim] kaydedilemedi:', e);
    }
    eventBus.emit('widget_update', { type: 'geri_sayim_durumu', data: this.durum() });
  }

  durum(): GeriSayimDurumu & { simdi: number } {
    this.yukle();
    return { ...this.d, simdi: Date.now() };
  }

  baslat(ms: number, baslik: string, simdi = Date.now()) {
    this.yukle();
    const sure = Math.min(EN_COK_MS, Math.max(1000, ms));
    this.d = { bitis: simdi + sure, kalanMs: null, toplamMs: sure, baslik: baslik.slice(0, 80) };
    this.kaydet();
  }

  ekle(ms: number, simdi = Date.now()): boolean {
    this.yukle();
    if (this.d.bitis === null && this.d.kalanMs === null) return false;
    if (this.d.kalanMs !== null) this.d.kalanMs = Math.min(EN_COK_MS, Math.max(0, this.d.kalanMs + ms));
    else this.d.bitis = simdi + Math.min(EN_COK_MS, Math.max(0, kalanSure(this.d, simdi) + ms));
    this.d.toplamMs = Math.max(this.d.toplamMs, kalanSure(this.d, simdi));
    this.kaydet();
    return true;
  }

  duraklat(simdi = Date.now()): boolean {
    this.yukle();
    if (this.d.bitis === null) return false;
    this.d = { ...this.d, kalanMs: kalanSure(this.d, simdi), bitis: null };
    this.kaydet();
    return true;
  }

  devam(simdi = Date.now()): boolean {
    this.yukle();
    if (this.d.kalanMs === null) return false;
    this.d = { ...this.d, bitis: simdi + this.d.kalanMs, kalanMs: null };
    this.kaydet();
    return true;
  }

  durdur() {
    this.yukle();
    this.d = { ...BOS_DURUM };
    this.kaydet();
  }

  /** Sohbet komutu. Dönen: sohbete yazılacak yanıt */
  komut(args: string[], simdi = new Date()): string {
    const ilk = (args[0] || '').toLowerCase();
    const an = simdi.getTime();
    if (!ilk) {
      const k = kalanSure(this.durum(), an);
      return k > 0 ? `⏳ ${this.d.baslik || 'Geri sayım'}: ${sureYazisi(k)}${this.d.kalanMs !== null ? ' (duraklatıldı)' : ''}` : '⏳ Geri sayım yok. Kullanım: !gerisayim 10m Başlık · !gerisayim 20:30';
    }
    if (['dur', 'stop', 'iptal', 'sifirla'].includes(ilk)) {
      this.durdur();
      return '⏹️ Geri sayım kapatıldı.';
    }
    if (['duraklat', 'pause'].includes(ilk)) return this.duraklat(an) ? '⏸️ Geri sayım duraklatıldı.' : '⏳ Çalışan bir geri sayım yok.';
    if (['devam', 'resume'].includes(ilk)) return this.devam(an) ? '▶️ Geri sayım devam ediyor.' : '⏳ Duraklatılmış bir geri sayım yok.';
    if (/^[+-]/.test(ilk)) {
      const ms = sureMs(ilk.slice(1));
      if (!ms) return '⏳ Süre anlaşılmadı. Örnek: !gerisayim +2m';
      return this.ekle(ilk[0] === '-' ? -ms : ms, an) ? `⏳ Yeni süre: ${sureYazisi(kalanSure(this.d, an))}` : '⏳ Önce bir geri sayım başlatın.';
    }
    const ms = saateKalan(ilk, simdi) ?? sureMs(ilk);
    if (!ms) return '⏳ Süre anlaşılmadı. Örnek: !gerisayim 10m Yayın başlıyor · !gerisayim 1h30m · !gerisayim 20:30';
    const baslik = args.slice(1).join(' ').trim();
    this.baslat(ms, baslik, an);
    return `⏳ Geri sayım başladı: ${sureYazisi(Math.min(EN_COK_MS, ms))}${baslik ? ` — ${baslik}` : ''}`;
  }
}

export const geriSayim = new GeriSayim();
