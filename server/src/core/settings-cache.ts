import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';
import { sifrele } from './security/vault.js';
import { gizliMi } from './security/redact.js';

/** Yalnız bu anahtarlar kabul edilir: paket dosyası sır ya da başka ayar yazamaz */
export function tohumKimlikleri(veri: Record<string, unknown>): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const k of ['kick_client_id', 'spotify_client_id']) {
    const d = veri?.[k];
    if (typeof d === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(d)) sonuc[k] = d;
  }
  return sonuc;
}

/** Sır yalnız ayar boşsa ve aynı Kick uygulamasına aitse alınır: başka uygulamanın sırrı girişi bozar */
export function kickSirriTohumu(id?: string, sir?: string, kayitliId?: string, kayitliSir?: string): { id: string; sir: string } | null {
  if (!id || !sir || kayitliSir) return null;
  if (kayitliId && kayitliId !== id) return null;
  return { id, sir };
}

class SettingsCache {
  private cache: Map<string, string> = new Map();
  private initialized: boolean = false;

  load() {
    try {
      const rows = db.prepare('SELECT key, value FROM bot_settings').all() as Array<{ key: string; value: string }>;
      this.cache.clear();
      for (const r of rows) {
        this.cache.set(r.key, r.value);
      }
      this.kimlikleriTohumla();
      this.kickSirriniAl();
      this.initialized = true;
    } catch (err) {
      console.warn('[SettingsCache] Error loading settings:', err);
    }
  }

  /** Studio kendi kayıtlı Kick uygulama sırrını ortamdan verir: pakette sır yok, Kick girişi yine de tamamlanır */
  private kickSirriniAl() {
    const al = kickSirriTohumu(process.env.AXBOT_KICK_CLIENT_ID, process.env.AXBOT_KICK_CLIENT_SECRET, this.cache.get('kick_client_id'), this.cache.get('kick_client_secret'));
    delete process.env.AXBOT_KICK_CLIENT_ID;
    delete process.env.AXBOT_KICK_CLIENT_SECRET;
    if (!al) return;
    this.set('kick_client_id', al.id);
    this.set('kick_client_secret', al.sir);
  }

  /** Pakete eklenen Client ID'ler yalnız boş ayarı doldurur: kullanıcının girdiğinin üstüne yazmaz */
  private kimlikleriTohumla() {
    const dosya = path.resolve(process.env.AXBOT_KIMLIK_DOSYASI || path.join(process.cwd(), 'varsayilan-kimlikler.json'));
    if (!fs.existsSync(dosya)) return;
    try {
      const okunan = JSON.parse(fs.readFileSync(dosya, 'utf8')) as Record<string, unknown>;
      for (const [k, v] of Object.entries(tohumKimlikleri(okunan))) {
        if (this.cache.get(k)) continue;
        db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
        this.cache.set(k, v);
      }
    } catch (err) {
      console.warn('[SettingsCache] Kimlik dosyası okunamadı:', err);
    }
  }

  get(key: string, defaultValue: string = ''): string {
    if (!this.initialized) {
      this.load();
    }
    return this.cache.get(key) ?? defaultValue;
  }

  getBoolean(key: string, defaultValue: boolean = false): boolean {
    const val = this.get(key);
    if (!val) return defaultValue;
    return val === 'true' || val === '1';
  }

  set(key: string, value: string) {
    this.cache.set(key, value);
    try {
      // Sır anahtarları (kick_client_secret, *_api_key…) diskte şifreli (S6);
      // önbellek düz metni tutar, okuma sarmalayıcısı diskten çözer.
      db.prepare(`
        INSERT INTO bot_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, gizliMi(key) ? String(sifrele(value)) : value);
    } catch (err) {
      console.error('[SettingsCache] Error saving key:', key, err);
    }
  }

  reload() {
    this.load();
  }
}

export const settingsCache = new SettingsCache();
export default settingsCache;
