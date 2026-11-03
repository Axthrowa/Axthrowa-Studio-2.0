/**
 * AxBoT — !clip: canlı yayından gerçek video klip (yerel ffmpeg)
 * Developed by AxthrowA
 *
 * Kick: kanal yanıtındaki HLS `playback_url` → 720p varyant → ffmpeg (yeniden
 * kodlama yok) → `data/klipler/*.mp4`. Klipler bilgisayarda kalır; panelin
 * Ekstralar > Klip sekmesinden izlenir/indirilir/silinir. Platforma yükleme YOK.
 *
 * Sınama: `STREAMAXT_KLIP_HLS_URL=http://127.0.0.1:<port>/...m3u8` yalnız
 * yerel adresi kabul eder (Kick sorgusu atlanır).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { ffmpegArgumanlari, hataSatiriTemizle, klipAdiGecerliMi, klipDosyaAdi, varyantSec } from './klip-saf.js';
import { hataMetni } from '../../core/logger.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function klipKlasoru(): string {
  return path.join(process.cwd(), 'data', 'klipler');
}

export interface KlipBilgisi {
  dosya: string;
  boyut: number;
  zaman: number;
  sure: number;
  kim: string;
}

/** ffmpeg yolu: ortam değişkeni ya da PATH. */
function ffmpegKomutu(): string {
  return String(process.env.STREAMAXT_FFMPEG || '').trim() || 'ffmpeg';
}

// "Yok" sonucu 1 dk tutulur: ffmpeg sonradan kurulursa yeniden başlatmadan görülür
let ffmpegVarOnbellek: { var: boolean; zaman: number } | null = null;
export function ffmpegVarMi(): Promise<boolean> {
  const o = ffmpegVarOnbellek;
  if (o && (o.var || Date.now() - o.zaman < 60_000)) return Promise.resolve(o.var);
  const kaydet = (v: boolean) => {
    ffmpegVarOnbellek = { var: v, zaman: Date.now() };
    return v;
  };
  return new Promise((coz) => {
    try {
      const p = spawn(ffmpegKomutu(), ['-version'], { windowsHide: true, stdio: 'ignore' });
      const zaman = setTimeout(() => p.kill('SIGKILL'), 10_000);
      p.on('error', () => {
        clearTimeout(zaman);
        coz(kaydet(false));
      });
      p.on('exit', (kod) => {
        clearTimeout(zaman);
        coz(kaydet(kod === 0));
      });
    } catch {
      coz(kaydet(false));
    }
  });
}

/** Yayının HLS adresi (yalnız Kick; yayın kapalıysa null). */
async function hlsAdresi(platform: string): Promise<string | null> {
  const sinama = String(process.env.STREAMAXT_KLIP_HLS_URL || '').trim();
  if (sinama && /^http:\/\/127\.0\.0\.1:\d+\//.test(sinama)) return sinama;
  if (platform !== 'kick') return null;
  const { kickPlatform } = await import('../../platforms/kick.js');
  const kanal = kickPlatform.getStatus().channel;
  if (!kanal) return null;
  const r = await axios.get(`https://kick.com/api/v2/channels/${encodeURIComponent(kanal)}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    timeout: 8000
  });
  if (!r.data?.livestream || !r.data?.playback_url) return null;
  return String(r.data.playback_url);
}

class KlipYoneticisi {
  private calisiyor = false;

  mesgulMu(): boolean {
    return this.calisiyor;
  }

  /**
   * Klibi başlatır; bitince `bildir` çağrılır. Dönen değer anında yanıt içindir.
   */
  async baslat(
    platform: string,
    kim: string,
    sure: number,
    bildir: (metin: string, dosya?: string) => void
  ): Promise<{ ok: true } | { ok: false; sebep: 'mesgul' | 'ffmpeg-yok' | 'yayin-yok' | 'hata'; hata?: string }> {
    if (this.calisiyor) return { ok: false, sebep: 'mesgul' };
    // Bayrak HEMEN alınır: aşağıdaki beklemeler sırasında gelen ikinci !clip
    // ikinci bir ffmpeg açmasın. Başlatılamazsa bırakılır.
    this.calisiyor = true;
    let basladi = false;
    try {
      const r = await this.hazirlaVeBaslat(platform, kim, sure, bildir);
      basladi = r.ok;
      return r;
    } finally {
      if (!basladi) this.calisiyor = false;
    }
  }

  private async hazirlaVeBaslat(
    platform: string,
    kim: string,
    sure: number,
    bildir: (metin: string, dosya?: string) => void
  ): Promise<{ ok: true } | { ok: false; sebep: 'mesgul' | 'ffmpeg-yok' | 'yayin-yok' | 'hata'; hata?: string }> {
    if (!(await ffmpegVarMi())) return { ok: false, sebep: 'ffmpeg-yok' };
    let ana: string | null;
    try {
      ana = await hlsAdresi(platform);
    } catch (e) {
      return { ok: false, sebep: 'hata', hata: hataSatiriTemizle(hataMetni(e)) };
    }
    if (!ana) return { ok: false, sebep: 'yayin-yok' };

    // Ana listeden 720p varyantı (yoksa adres zaten medya listesidir)
    let girdi = ana;
    try {
      const liste = String((await axios.get(ana, { headers: { 'User-Agent': UA }, timeout: 8000, responseType: 'text' })).data);
      girdi = varyantSec(liste, ana) || ana;
    } catch {
      /* ffmpeg ana listeyi de okuyabilir */
    }

    fs.mkdirSync(klipKlasoru(), { recursive: true });
    const dosya = klipDosyaAdi(kim, new Date(), sure);
    const hedef = path.join(klipKlasoru(), dosya);
    const p = spawn(ffmpegKomutu(), ['-user_agent', UA, ...ffmpegArgumanlari(girdi, hedef, sure)], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let hataCiktisi = '';
    p.stderr?.on('data', (d) => (hataCiktisi = (hataCiktisi + String(d)).slice(-600)));
    const zamanAsimi = setTimeout(() => p.kill('SIGKILL'), (sure + 45) * 1000);
    p.on('error', (e) => {
      clearTimeout(zamanAsimi);
      this.calisiyor = false;
      bildir(`❌ Klip alınamadı: ${hataSatiriTemizle(hataMetni(e))}`);
    });
    p.on('exit', (kod) => {
      clearTimeout(zamanAsimi);
      this.calisiyor = false;
      let boyut = 0;
      try {
        boyut = fs.statSync(hedef).size;
      } catch {
        /* dosya yok */
      }
      if (boyut > 10_000) {
        bildir(`🎬 Klip hazır: ${sure} sn (${(boyut / 1048576).toFixed(1)} MB) — yayıncı panelinden paylaşabilir.`, dosya);
      } else {
        try {
          fs.unlinkSync(hedef);
        } catch {
          /* yok */
        }
        bildir(`❌ Klip alınamadı (ffmpeg ${kod ?? 'durduruldu'})${hataCiktisi ? `: ${hataSatiriTemizle(hataCiktisi.trim().split('\n').pop() || '')}` : ''}`);
      }
    });
    return { ok: true };
  }

  listele(): KlipBilgisi[] {
    try {
      return fs
        .readdirSync(klipKlasoru())
        .filter(klipAdiGecerliMi)
        .map((dosya) => {
          const st = fs.statSync(path.join(klipKlasoru(), dosya));
          const m = dosya.match(/^\d{8}-\d{6}_([\w-]+)_(\d+)sn\.mp4$/);
          return { dosya, boyut: st.size, zaman: st.mtimeMs, sure: Number(m?.[2]) || 0, kim: m?.[1] || '' };
        })
        .sort((a, b) => b.zaman - a.zaman);
    } catch {
      return [];
    }
  }

  yol(dosya: string): string | null {
    if (!klipAdiGecerliMi(dosya)) return null;
    const p = path.join(klipKlasoru(), dosya);
    return fs.existsSync(p) ? p : null;
  }

  sil(dosya: string): boolean {
    const p = this.yol(dosya);
    if (!p) return false;
    try {
      fs.unlinkSync(p);
      return true;
    } catch {
      // Dosya açık olabilir (oynatılıyor/indiriliyor): rota 404 döner, sunucu düşmez
      return false;
    }
  }
}

export const klipYoneticisi = new KlipYoneticisi();
