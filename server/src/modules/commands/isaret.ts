/**
 * U6: sohbetteki !isaret (mod) yayının o anını AxthrowA Studio'da işaretler (tekrar arabelleği, kayıt bölümü,
 * sahne); Twitch'te ayrıca platform işareti konur.
 */
import axios from 'axios';
import { muzikHost } from '../muzik/index.js';

export type IsaretSonucu = { ok: true; tekrar?: boolean } | { ok: false; hata: string } | null;

/** Studio açık değilse null */
export async function studioIsareti(not: string): Promise<IsaretSonucu> {
  const adres = muzikHost.hariciAdres();
  if (!adres) return null;
  try {
    const r = await axios.post(`${adres}/api/actions/run`, { id: 'marker.add', params: { note: not, via: 'chat' }, confirm: false }, { timeout: 10_000 });
    return { ok: true, tekrar: !!r.data?.result?.replayPath };
  } catch (e: any) {
    return { ok: false, hata: String(e?.response?.data?.error || e?.message || e).slice(0, 120) };
  }
}

/** Studio ve Twitch sonuçlarından tek sohbet yanıtı */
export function isaretYaniti(studio: IsaretSonucu, twitch: IsaretSonucu): string {
  const parca: string[] = [];
  if (studio?.ok) parca.push(studio.tekrar ? 'tekrar kaydedildi' : 'Studio\'ya yazıldı');
  if (twitch?.ok) parca.push('Twitch\'e işaret kondu');
  if (parca.length) return `📍 İşaretlendi: ${parca.join(', ')}.`;
  const hata = [studio && !studio.ok ? `Studio: ${studio.hata}` : '', twitch && !twitch.ok ? `Twitch: ${twitch.hata}` : ''].filter(Boolean).join(' · ');
  return `İşaret konamadı: ${hata || 'AxthrowA Studio açık değil'}`;
}
