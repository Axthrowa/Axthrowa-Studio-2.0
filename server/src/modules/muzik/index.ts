/**
 * StreamAxT — müzik host'unun StreamAxT örneği (bot_settings deposu + WebSocket yayını)
 * Developed by AxthrowA
 *
 * Depo `settingsCache`: `spotify_refresh_token` ve `ytmd_token` adları "token"
 * içerdiği için diske DPAPI ile şifreli yazılır (core/security/redact gizliMi).
 */
import { settingsCache } from '../../core/settings-cache.js';
import { gizliMi } from '../../core/security/redact.js';
import { MuzikHost } from './muzik.js';

let ozelYayin: ((m: unknown) => void) | null = null;

/** /ws/overlay-sync istemcilerine ve OBS widget'larına yayın (rota dosyası bağlar) */
export function muzikYayiniBagla(f: (m: unknown) => void) {
  ozelYayin = f;
}

export const muzikHost = new MuzikHost(
  {
    oku: (k) => settingsCache.get(k, ''),
    yaz: (k, v, gizli) => {
      if (gizli && !gizliMi(k)) throw new Error(`Gizli değer şifrelenmeyen bir anahtara yazılamaz: ${k}`);
      settingsCache.set(k, v);
    }
  },
  (m) => ozelYayin?.(m),
  // Yayın Yönetim Aracı'nın Resonance host'u (bot kendi Spotify'ı bağlı değilken); kapalıysa 15 sn'de bir dener
  () => process.env.STREAMAXT_MUZIK_HOST ?? settingsCache.get('muzik_harici_host', 'http://127.0.0.1:8843')
);
