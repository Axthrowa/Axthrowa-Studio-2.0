/**
 * StreamAxT — Gemini dışındaki yapay zekâ sağlayıcıları
 * Developed by AxthrowA
 *
 * Çoğu sağlayıcı OpenAI uyumlu `/chat/completions` ucunu konuşur (OpenAI, Groq,
 * OpenRouter, DeepSeek, Mistral, xAI, yerel Ollama ya da kullanıcının verdiği
 * uyumlu bir adres); Anthropic Claude kendi Messages API'siyle çağrılır.
 * Ayarlar: `ai_provider`, `ai_<sağlayıcı>_api_key`, `ai_<sağlayıcı>_model`,
 * `ai_custom_base_url`. Anahtarlar "api_key" içerdiği için DPAPI ile şifreli durur.
 */
import axios from 'axios';
import { db } from '../../db/index.js';

export interface SaglayiciTanimi {
  ad: string;
  kok: string;
  model: string;
  /** Anahtar gerekmez (yerel Ollama) */
  anahtarsiz?: boolean;
  tur: 'openai' | 'anthropic';
}

export const SAGLAYICILAR: Record<string, SaglayiciTanimi> = {
  openai: { ad: 'OpenAI (ChatGPT)', kok: 'https://api.openai.com/v1', model: 'gpt-4o-mini', tur: 'openai' },
  anthropic: { ad: 'Anthropic Claude', kok: 'https://api.anthropic.com/v1', model: 'claude-haiku-5-5', tur: 'anthropic' },
  groq: { ad: 'Groq', kok: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', tur: 'openai' },
  openrouter: { ad: 'OpenRouter', kok: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', tur: 'openai' },
  deepseek: { ad: 'DeepSeek', kok: 'https://api.deepseek.com/v1', model: 'deepseek-chat', tur: 'openai' },
  mistral: { ad: 'Mistral', kok: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', tur: 'openai' },
  xai: { ad: 'xAI Grok', kok: 'https://api.x.ai/v1', model: 'grok-3-mini', tur: 'openai' },
  ollama: { ad: 'Ollama (yerel)', kok: 'http://127.0.0.1:11434/v1', model: 'llama3.2', anahtarsiz: true, tur: 'openai' },
  custom: { ad: 'Özel (OpenAI uyumlu)', kok: '', model: '', tur: 'openai' }
};

function ayar(anahtar: string): string {
  return ((db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(anahtar) as { value?: string } | undefined)?.value || '').trim();
}

/** Seçili sağlayıcı; tanımsız ya da "gemini" ise null (Gemini yolu kullanılır). */
export function seciliSaglayici(): string | null {
  const s = ayar('ai_provider');
  return s && s !== 'gemini' && SAGLAYICILAR[s] ? s : null;
}

/** Özel adres yalnız http(s); düz http yalnız yerel ağ dışına çıkmayan adreslerde mantıklı ama kullanıcıya bırakılır. */
function kokAdresi(ad: string): string {
  const t = SAGLAYICILAR[ad];
  const k = ad === 'custom' ? ayar('ai_custom_base_url') : t.kok;
  try {
    const u = new URL(k);
    return u.protocol === 'https:' || u.protocol === 'http:' ? k.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

export function saglayiciAyari(ad: string) {
  const t = SAGLAYICILAR[ad];
  return {
    tanim: t,
    kok: kokAdresi(ad),
    anahtar: ayar(`ai_${ad}_api_key`),
    model: ayar(`ai_${ad}_model`) || t.model
  };
}

/**
 * "Güncel bilgi" açıkken Groq'ta gpt-oss modellerinin yerleşik internet araması. Eskiden `groq/compound`
 * modeline geçiliyordu; o model hesaplardan kaldırıldı ("does not exist or you do not have access").
 */
export function groqAramaAraci(ad: string, model: string): { tools?: { type: string }[] } {
  return ad === 'groq' && model.startsWith('openai/gpt-oss') && ayar('ai_web_arama') === 'true' ? { tools: [{ type: 'browser_search' }] } : {};
}

function hataMetni(e: any, ad: string): string {
  const durum = e?.response?.status;
  const govde = e?.response?.data;
  const mesaj = String(govde?.error?.message || govde?.error || govde?.message || e?.message || e).slice(0, 160);
  if (durum === 401 || durum === 403) return `${SAGLAYICILAR[ad].ad} anahtarı geçersiz ya da yetkisiz`;
  if (durum === 429) return `${SAGLAYICILAR[ad].ad} kotası/hız sınırı doldu`;
  if (durum === 404) return `${SAGLAYICILAR[ad].ad}: model ya da adres bulunamadı (${mesaj})`;
  return `${SAGLAYICILAR[ad].ad}: ${mesaj}`;
}

/** Tek seferlik metin üretimi. Hata atar (mesajı kullanıcıya gösterilebilir, anahtar içermez). */
export async function metinUret(ad: string, sistem: string, kullanici: string, zamanAsimiMs = 25_000): Promise<string> {
  const a = saglayiciAyari(ad);
  if (!a.kok) throw new Error(`${a.tanim.ad}: adres girilmemiş`);
  if (!a.anahtar && !a.tanim.anahtarsiz) throw new Error(`${a.tanim.ad} API anahtarı girilmemiş`);
  if (!a.model) throw new Error(`${a.tanim.ad}: model adı girilmemiş`);
  try {
    if (a.tanim.tur === 'anthropic') {
      const r = await axios.post(
        `${a.kok}/messages`,
        { model: a.model, max_tokens: 400, system: sistem, messages: [{ role: 'user', content: kullanici }] },
        { timeout: zamanAsimiMs, headers: { 'x-api-key': a.anahtar, 'anthropic-version': '2023-06-01' } }
      );
      const parca = (r.data?.content || []).find((c: any) => c?.type === 'text');
      return String(parca?.text || '').trim();
    }
    const r = await axios.post(
      `${a.kok}/chat/completions`,
      {
        model: a.model,
        ...groqAramaAraci(ad, a.model),
        // Düşünen modeller (gpt-oss) düşünme jetonlarını da bu sınırdan harcar; 400 boş cevap bırakabiliyordu
        max_tokens: 1024,
        messages: [
          { role: 'system', content: sistem },
          { role: 'user', content: kullanici }
        ]
      },
      { timeout: zamanAsimiMs, headers: a.anahtar ? { Authorization: `Bearer ${a.anahtar}` } : {} }
    );
    return String(r.data?.choices?.[0]?.message?.content || '').trim();
  } catch (e: any) {
    throw new Error(hataMetni(e, ad));
  }
}

/** Bağlantı denetimi: model listesini ister (üretim kotası harcamaz). */
export async function saglayiciDurumu(ad: string): Promise<{ hazir: boolean; anahtarVar: boolean; model: string; modeller: string[]; hata?: string }> {
  const a = saglayiciAyari(ad);
  const anahtarVar = Boolean(a.anahtar) || Boolean(a.tanim.anahtarsiz);
  if (!a.kok) return { hazir: false, anahtarVar, model: a.model, modeller: [], hata: 'Adres girilmemiş' };
  if (!anahtarVar) return { hazir: false, anahtarVar, model: a.model, modeller: [], hata: 'API anahtarı girilmemiş.' };
  try {
    const basliklar: Record<string, string> =
      a.tanim.tur === 'anthropic'
        ? { 'x-api-key': a.anahtar, 'anthropic-version': '2023-06-01' }
        : a.anahtar
          ? { Authorization: `Bearer ${a.anahtar}` }
          : {};
    const r = await axios.get(`${a.kok}/models`, { timeout: 10_000, headers: basliklar });
    const liste: any[] = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data?.models) ? r.data.models : [];
    const modeller = liste.map((m) => String(m?.id || m?.name || '')).filter(Boolean).slice(0, 200);
    return { hazir: true, anahtarVar, model: a.model, modeller };
  } catch (e: any) {
    return { hazir: false, anahtarVar, model: a.model, modeller: [], hata: hataMetni(e, ad) };
  }
}
