/**
 * StreamAxT Multi-Engine TTS
 * Developed by AxthrowA
 */

import { WebSocket as WsClient } from 'ws';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { db } from '../../db/index.js';
import { TTSSettings } from '../../db/schema.js';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import { seyrekUyar } from '../../core/logger.js';
import { kufurleriMaskele } from './filters.js';

export interface TTSQueueItem {
  id: string;
  text: string;
  originalText: string;
  processedText: string;
  user: string;
  voice: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  speed: number;
  pitch: number;
  volume: number;
  primaryEngine: string;
  engineUsed: string;
  audioUrl?: string;
  audioBase64?: string;
  fallbackChain: string[];
  failedEngines: string[];
  timestamp: number;
}

export interface VoiceOption {
  id: string;
  label: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  engine: 'edge' | 'google' | 'gemini' | 'elevenlabs' | 'webspeech';
}

export const TTS_LANGUAGES = [
  { id: 'tr-TR', google: 'tr', label: 'Türkçe' },
  { id: 'en-US', google: 'en', label: 'English (US)' },
  { id: 'en-GB', google: 'en-GB', label: 'English (UK)' },
  { id: 'de-DE', google: 'de', label: 'Deutsch' },
  { id: 'fr-FR', google: 'fr', label: 'Français' },
  { id: 'es-ES', google: 'es', label: 'Español' },
  { id: 'it-IT', google: 'it', label: 'Italiano' },
  { id: 'pt-BR', google: 'pt', label: 'Português (BR)' },
  { id: 'ru-RU', google: 'ru', label: 'Русский' },
  { id: 'ja-JP', google: 'ja', label: '日本語' },
  { id: 'ko-KR', google: 'ko', label: '한국어' },
  { id: 'ar-SA', google: 'ar', label: 'العربية' },
  { id: 'nl-NL', google: 'nl', label: 'Nederlands' },
  { id: 'pl-PL', google: 'pl', label: 'Polski' }
] as const;

export const EDGE_VOICES: VoiceOption[] = [
  { id: 'tr-TR-AhmetNeural', label: 'Ahmet (Türkçe · Erkek)', language: 'tr-TR', gender: 'male', engine: 'edge' },
  { id: 'tr-TR-EmelNeural', label: 'Emel (Türkçe · Kadın)', language: 'tr-TR', gender: 'female', engine: 'edge' },
  { id: 'en-US-JennyNeural', label: 'Jenny (English US · Female)', language: 'en-US', gender: 'female', engine: 'edge' },
  { id: 'en-US-GuyNeural', label: 'Guy (English US · Male)', language: 'en-US', gender: 'male', engine: 'edge' },
  { id: 'en-US-AriaNeural', label: 'Aria (English US · Female)', language: 'en-US', gender: 'female', engine: 'edge' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (English UK · Female)', language: 'en-GB', gender: 'female', engine: 'edge' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (English UK · Male)', language: 'en-GB', gender: 'male', engine: 'edge' },
  { id: 'de-DE-KatjaNeural', label: 'Katja (Deutsch · Frau)', language: 'de-DE', gender: 'female', engine: 'edge' },
  { id: 'de-DE-ConradNeural', label: 'Conrad (Deutsch · Mann)', language: 'de-DE', gender: 'male', engine: 'edge' },
  { id: 'fr-FR-DeniseNeural', label: 'Denise (Français · Femme)', language: 'fr-FR', gender: 'female', engine: 'edge' },
  { id: 'fr-FR-HenriNeural', label: 'Henri (Français · Homme)', language: 'fr-FR', gender: 'male', engine: 'edge' },
  { id: 'es-ES-ElviraNeural', label: 'Elvira (Español · Mujer)', language: 'es-ES', gender: 'female', engine: 'edge' },
  { id: 'es-ES-AlvaroNeural', label: 'Alvaro (Español · Hombre)', language: 'es-ES', gender: 'male', engine: 'edge' },
  { id: 'it-IT-ElsaNeural', label: 'Elsa (Italiano · Donna)', language: 'it-IT', gender: 'female', engine: 'edge' },
  { id: 'it-IT-DiegoNeural', label: 'Diego (Italiano · Uomo)', language: 'it-IT', gender: 'male', engine: 'edge' },
  { id: 'pt-BR-FranciscaNeural', label: 'Francisca (Português · Mulher)', language: 'pt-BR', gender: 'female', engine: 'edge' },
  { id: 'pt-BR-AntonioNeural', label: 'Antonio (Português · Homem)', language: 'pt-BR', gender: 'male', engine: 'edge' },
  { id: 'ja-JP-NanamiNeural', label: 'Nanami (日本語 · 女性)', language: 'ja-JP', gender: 'female', engine: 'edge' },
  { id: 'ja-JP-KeitaNeural', label: 'Keita (日本語 · 男性)', language: 'ja-JP', gender: 'male', engine: 'edge' },
  { id: 'ko-KR-SunHiNeural', label: 'SunHi (한국어 · 여성)', language: 'ko-KR', gender: 'female', engine: 'edge' },
  { id: 'ko-KR-InJoonNeural', label: 'InJoon (한국어 · 남성)', language: 'ko-KR', gender: 'male', engine: 'edge' },
  { id: 'ru-RU-SvetlanaNeural', label: 'Svetlana (Русский · Женский)', language: 'ru-RU', gender: 'female', engine: 'edge' },
  { id: 'ru-RU-DmitryNeural', label: 'Dmitry (Русский · Мужской)', language: 'ru-RU', gender: 'male', engine: 'edge' },
  { id: 'ar-SA-ZariyahNeural', label: 'Zariyah (العربية · أنثى)', language: 'ar-SA', gender: 'female', engine: 'edge' },
  { id: 'ar-SA-HamedNeural', label: 'Hamed (العربية · ذكر)', language: 'ar-SA', gender: 'male', engine: 'edge' }
];

const GEMINI_GENDER: Record<string, 'male' | 'female'> = {
  Puck: 'male', Charon: 'male', Fenrir: 'male', Orus: 'male', Enceladus: 'male',
  Iapetus: 'male', Algieba: 'male', Algenib: 'male', Rasalgethi: 'male',
  Kore: 'female', Aoede: 'female', Leda: 'female', Zephyr: 'female',
  Callirrhoe: 'female', Autonoe: 'female', Despina: 'female', Erinome: 'female',
  Laomedeia: 'female', Achernar: 'female', Umbriel: 'female'
};

export const GEMINI_VOICES: VoiceOption[] = [
  'Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr',
  'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
  'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar'
].map((name) => {
  const gender = GEMINI_GENDER[name] || 'neutral';
  const genderLabel = gender === 'male' ? 'Erkek' : gender === 'female' ? 'Kadın' : 'Nötr';
  return {
    id: name,
    label: `${name} (Gemini · ${genderLabel})`,
    language: 'multi',
    gender,
    engine: 'gemini' as const
  };
});

export const ELEVENLABS_VOICES: VoiceOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (Kadın · Net)', language: 'en-US', gender: 'female', engine: 'elevenlabs' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah (Kadın · Sıcak)', language: 'en-US', gender: 'female', engine: 'elevenlabs' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni (Erkek · Narrator)', language: 'en-US', gender: 'male', engine: 'elevenlabs' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh (Erkek · Derin)', language: 'en-US', gender: 'male', engine: 'elevenlabs' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (Erkek · Haber)', language: 'en-US', gender: 'male', engine: 'elevenlabs' },
  { id: 'jBpfuIE2acCO8z3wKNLl', label: 'Gigi (Kadın · Enerjik)', language: 'en-US', gender: 'female', engine: 'elevenlabs' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli (Kadın · Genç)', language: 'en-US', gender: 'female', engine: 'elevenlabs' }
];

export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  primaryEngine: 'edge',
  fallbackChain: ['edge', 'gemini', 'elevenlabs', 'google', 'webspeech'],
  language: 'tr-TR',
  edgeVoice: 'tr-TR-AhmetNeural',
  googleLang: 'tr',
  geminiVoice: 'Puck',
  elevenlabsApiKey: '',
  elevenlabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
  speed: 1.0,
  pitch: 1.0,
  volume: 0.8,
  profanityFilter: true,
  removeUrls: true,
  maxLength: 300,
  minPointsOrDonation: 0
};

function voiceLangFromId(voiceId: string, fallback = 'tr-TR'): string {
  const match = EDGE_VOICES.find(v => v.id === voiceId);
  if (match) return match.language;
  const parts = voiceId.split('-');
  if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
  return fallback;
}

function googleLangFromLocale(locale: string): string {
  const found = TTS_LANGUAGES.find(l => l.id === locale);
  if (found) return found.google;
  return (locale.split('-')[0] || 'tr').toLowerCase();
}

export function genderOfVoice(voiceId?: string): 'male' | 'female' | 'neutral' {
  if (!voiceId) return 'neutral';
  const edge = EDGE_VOICES.find(v => v.id === voiceId);
  if (edge) return edge.gender;
  const gemini = GEMINI_VOICES.find(v => v.id === voiceId);
  if (gemini) return gemini.gender;
  const eleven = ELEVENLABS_VOICES.find(v => v.id === voiceId);
  if (eleven) return eleven.gender;
  const lower = voiceId.toLowerCase();
  if (/(ahmet|guy|ryan|conrad|henri|alvaro|diego|antonio|keita|injoon|dmitry|hamed|fenrir|puck|charon|antoni|josh|adam|male|man)/i.test(lower)) return 'male';
  if (/(emel|jenny|aria|sonia|katja|denise|elvira|elsa|francisca|nanami|sunhi|svetlana|zariyah|kore|aoede|rachel|sarah|gigi|elli|female|woman)/i.test(lower)) return 'female';
  return 'neutral';
}

function pcmToWavBase64(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): string {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bits / 8), 28);
  header.writeUInt16LE(channels * (bits / 8), 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return `data:audio/wav;base64,${Buffer.concat([header, pcm]).toString('base64')}`;
}

export class MultiEngineTTS extends EventEmitter {
  private queue: TTSQueueItem[] = [];

  getSettings(): TTSSettings {
    try {
      const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'tts_advanced_settings'").get() as { value: string } | undefined;
      if (row?.value) {
        // OKURKEN ses değiştirilmez. Eskiden burada Edge sesinin cinsiyeti
        // dayatılıyordu: kullanıcı erkek karakterle kadın Gemini sesi seçse bile
        // ayar her okunuşta "Puck"a dönüyordu; seçim hiç tutmuyordu.
        return { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(row.value) } as TTSSettings;
      }
    } catch (e) {
      seyrekUyar('ayar:tts', '[TTS] Ayar okunamadı — varsayılan kullanılıyor', e);
    }
    return { ...DEFAULT_TTS_SETTINGS };
  }

  saveSettings(settings: Partial<TTSSettings>): TTSSettings {
    const current = this.getSettings();
    const language = settings.language || current.language || 'tr-TR';
    const updated: TTSSettings = {
      ...current,
      ...settings,
      language,
      googleLang: settings.googleLang || googleLangFromLocale(language)
    };

    // Dil değişti ve seçili ses o dile ait değilse, aynı cinsiyette bir ses seç.
    // (Eskiden yalnız `edgeVoice` hiç gönderilmemişse çalışıyordu; arayüz tüm
    // ayarı birlikte gönderdiği için dil değiştirmek sesi hiç değiştirmiyordu.)
    if (settings.language) {
      const seciliDilUyumlu = EDGE_VOICES.some(
        v => v.id === updated.edgeVoice && v.language === settings.language,
      );
      if (!seciliDilUyumlu) {
        const istenen = genderOfVoice(current.edgeVoice);
        const ayniCinsiyet = EDGE_VOICES.find(
          v => v.language === settings.language && v.gender === istenen,
        );
        const herhangi = EDGE_VOICES.find(v => v.language === settings.language);
        const secim = ayniCinsiyet || herhangi;
        if (secim) updated.edgeVoice = secim.id;
      }
    }

    // Cinsiyet hizalaması yalnız KOLAYLIK içindir, kısıt değil.
    //
    // Eskiden her kayıtta Edge sesinin cinsiyeti dayatılıyordu: kullanıcı
    // Gemini'de "Charon" seçse bile ayar "Puck"a, ElevenLabs seçimi de sabit
    // bir kimliğe geri dönüyordu ("ses ve karakter ayarları düzgün değil").
    // Artık yalnız (a) o motorun sesi hiç seçilmemişse ya da (b) kullanıcı bu
    // kayıtta DİLİ değiştirip o motorun sesini göndermediyse otomatik doldurulur.
    const gender = genderOfVoice(updated.edgeVoice);
    const dilDegisti = !!settings.language && settings.language !== current.language;
    if (gender === 'male' || gender === 'female') {
      const geminiAcikca = settings.geminiVoice !== undefined;
      if (!geminiAcikca && (!updated.geminiVoice || dilDegisti)) {
        updated.geminiVoice = gender === 'female' ? 'Kore' : 'Puck';
      }
      const elevenAcikca = settings.elevenlabsVoiceId !== undefined;
      if (!elevenAcikca && !updated.elevenlabsVoiceId) {
        updated.elevenlabsVoiceId = gender === 'male' ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM';
      }
    }

    db.prepare(`
      INSERT INTO bot_settings (key, value) VALUES ('tts_advanced_settings', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(updated));

    db.prepare(`
      INSERT INTO bot_settings (key, value) VALUES ('tts_voice', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(updated.edgeVoice);

    db.prepare(`
      INSERT INTO bot_settings (key, value) VALUES ('tts_volume', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(String(updated.volume));

    return updated;
  }

  getVoiceCatalog() {
    return {
      languages: TTS_LANGUAGES,
      edge: EDGE_VOICES,
      gemini: GEMINI_VOICES,
      elevenlabs: ELEVENLABS_VOICES
    };
  }

  filterText(rawText: string, settings: TTSSettings): string {
    let text = rawText || '';
    if (settings.removeUrls) {
      text = text.replace(/https?:\/\/\S+/gi, '').replace(/www\.\S+/gi, '');
    }
    text = text.replace(/(.)\1{4,}/g, '$1$1');
    if (settings.profanityFilter) {
      text = kufurleriMaskele(text);
    }
    const maxLen = settings.maxLength || 300;
    return text.slice(0, maxLen).trim();
  }

  private edgeDrmParams(skewSeconds = 0): { query: string; token: string } {
    const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
    const WIN_EPOCH = 11644473600;
    let ticks = Date.now() / 1000 + skewSeconds + WIN_EPOCH;
    ticks -= ticks % 300;
    ticks *= 1e9 / 100;
    const hash = crypto.createHash('sha256').update(`${ticks.toFixed(0)}${TRUSTED}`).digest('hex').toUpperCase();
    return {
      token: TRUSTED,
      query: `TrustedClientToken=${TRUSTED}&Sec-MS-GEC=${hash}&Sec-MS-GEC-Version=1-143.0.3650.75`
    };
  }

  async synthesizeEdge(text: string, voice = 'tr-TR-AhmetNeural', speed = 1.0, pitch = 1.0): Promise<string> {
    let lastErr: Error | null = null;
    for (const skew of [0, -300, 300]) {
      try {
        return await this.synthesizeEdgeOnce(text, voice, speed, pitch, skew);
      } catch (err: any) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Edge TTS başarısız');
  }

  private synthesizeEdgeOnce(text: string, voice: string, speed: number, pitch: number, skewSeconds: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4().replace(/-/g, '');
      const ratePercent = Math.round((speed - 1.0) * 100);
      const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
      const pitchHz = Math.round((pitch - 1.0) * 50);
      const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;
      const xmlLang = voiceLangFromId(voice);
      const drm = this.edgeDrmParams(skewSeconds);
      const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?${drm.query}&ConnectionId=${requestId}`;

      const ws = new WsClient(wsUrl, {
        headers: {
          Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache',
          Cookie: `muid=${crypto.randomBytes(16).toString('hex').toUpperCase()};`
        }
      });

      const audioChunks: Buffer[] = [];
      let isDone = false;

      const finish = (err?: Error) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timer);
        try { ws.terminate(); } catch {}
        if (err) return reject(err);
        if (audioChunks.length === 0) return reject(new Error('Edge TTS returned empty audio'));
        const fullBuffer = Buffer.concat(audioChunks);
        resolve(`data:audio/mp3;base64,${fullBuffer.toString('base64')}`);
      };

      const timer = setTimeout(() => finish(new Error(`Edge TTS timed out (skew ${skewSeconds})`)), 8000);

      ws.on('open', () => {
        const configMessage =
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
                }
              }
            }
          });
        ws.send(configMessage);

        const escapedText = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

        const ssmlShort =
          `X-RequestId:${requestId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `Path:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${xmlLang}'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='${pitchStr}' rate='${rateStr}'>${escapedText}</prosody>` +
          `</voice></speak>`;

        ws.send(ssmlShort);
      });

      ws.on('message', (data: Buffer | string, isBinary: boolean) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (isBinary || buf.includes(0)) {
          if (buf.length > 2) {
            const headerLen = buf.readUInt16BE(0);
            if (buf.length > 2 + headerLen) {
              const headerText = buf.subarray(2, 2 + headerLen).toString('utf-8');
              if (headerText.includes('Path:audio')) {
                const audioData = buf.subarray(2 + headerLen);
                if (audioData.length > 0) audioChunks.push(audioData);
              }
            } else {
              const sep = buf.indexOf('\r\n\r\n');
              if (sep > 0 && buf.length > sep + 4) {
                audioChunks.push(buf.subarray(sep + 4));
              }
            }
          }
        } else {
          const str = buf.toString('utf-8');
          if (str.includes('Path:turn.end')) finish();
        }
      });

      ws.on('error', (err) => finish(err));
      ws.on('close', (code) => {
        if (!isDone && audioChunks.length > 0) finish();
        else if (!isDone) finish(new Error(`Edge TTS kapandı (skew ${skewSeconds}, ${code})`));
      });
    });
  }

  async synthesizeGoogle(text: string, lang = 'tr'): Promise<string> {
    const encoded = encodeURIComponent(text);
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;
    const response = await axios.get(googleUrl, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (response.status === 200 && response.data) {
      return `data:audio/mp3;base64,${Buffer.from(response.data).toString('base64')}`;
    }
    throw new Error(`Google TTS status: ${response.status}`);
  }

  async synthesizeGemini(text: string, voice = 'Puck'): Promise<string> {
    const keyRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_api_key'").get() as { value: string } | undefined;
    const apiKey = keyRow?.value || process.env.GEMINI_API_KEY || '';
    if (!apiKey) throw new Error('Gemini API anahtarı yok');

    const client = new GoogleGenAI({ apiKey });
    const models = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
    let lastErr: Error | null = null;

    for (const model of models) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: [{ parts: [{ text }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        });
        const inline = (response as any)?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
        if (!inline?.data) throw new Error('Gemini TTS boş yanıt');
        const mime = String(inline.mimeType || 'audio/l16');
        const raw = Buffer.from(inline.data, 'base64');
        if (mime.includes('wav') || mime.includes('mp3') || mime.includes('mpeg')) {
          const ext = mime.includes('wav') ? 'wav' : 'mp3';
          return `data:audio/${ext};base64,${raw.toString('base64')}`;
        }
        return pcmToWavBase64(raw);
      } catch (err: any) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Gemini TTS başarısız');
  }

  async synthesizeElevenLabs(text: string, apiKey: string, voiceId?: string): Promise<string> {
    if (!apiKey) throw new Error('ElevenLabs API Key not configured');
    const selectedVoice = voiceId || '21m00Tcm4TlvDq8ikWAM';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`;
    const response = await axios.post(
      url,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      },
      {
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
        timeout: 12000
      }
    );
    if (response.status === 200 && response.data) {
      return `data:audio/mpeg;base64,${Buffer.from(response.data).toString('base64')}`;
    }
    throw new Error(`ElevenLabs status: ${response.status}`);
  }

  async synthesizeWithFallback(
    rawText: string,
    user = 'Sistem',
    override?: Partial<TTSSettings>
  ): Promise<TTSQueueItem | null> {
    const settings: TTSSettings = { ...this.getSettings(), ...(override || {}) };
    const processedText = this.filterText(rawText, settings);
    if (!processedText) return null;

    const language = settings.language || 'tr-TR';
    const googleLang = settings.googleLang || googleLangFromLocale(language);
    const selectedVoice = settings.edgeVoice || DEFAULT_TTS_SETTINGS.edgeVoice;
    const gender = genderOfVoice(selectedVoice);
    // Seçilen sesler aynen kullanılır; cinsiyet yalnız ses HİÇ seçilmemişse
    // varsayılan belirler. (Eskiden burada da seçim eziliyordu.)
    const geminiVoice = settings.geminiVoice || (gender === 'female' ? 'Kore' : 'Puck');
    const elevenVoice = settings.elevenlabsVoiceId || (gender === 'male' ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM');
    const fallbackChain = settings.fallbackChain?.length
      ? settings.fallbackChain
      : DEFAULT_TTS_SETTINGS.fallbackChain;

    const failedEngines: string[] = [];
    let audioBase64: string | undefined;
    let engineUsed = 'webspeech';
    let playbackPitch = settings.pitch || 1;

    for (const engine of fallbackChain) {
      try {
        if (engine === 'edge') {
          audioBase64 = await this.synthesizeEdge(processedText, selectedVoice, settings.speed, settings.pitch);
          engineUsed = 'edge';
          break;
        }
        if (engine === 'google') {
          // Google ücretsiz ucu ses seçtirmiyor (kadın tonlu). Erkek karakterde
          // eskiden motor TAMAMEN atlanıyordu; diğer motorlar da düşerse TTS hiç
          // çalışmıyordu. Artık son çare olarak kullanılır: yalnız zincirin son
          // sırasındaysa ya da kullanıcı açıkça izin verdiyse.
          const sonCare = fallbackChain[fallbackChain.length - 1] === 'google';
          if (gender === 'male' && !sonCare && settings.googleForMale === false) {
            failedEngines.push('google (erkek karakter için kapalı)');
            continue;
          }
          if (gender === 'male') playbackPitch = Math.min(playbackPitch, 0.9);
          audioBase64 = await this.synthesizeGoogle(processedText, googleLang);
          engineUsed = 'google';
          if (gender === 'female' && (!settings.pitch || settings.pitch === 1)) playbackPitch = 1.12;
          break;
        }
        if (engine === 'gemini') {
          audioBase64 = await this.synthesizeGemini(processedText, geminiVoice);
          engineUsed = 'gemini';
          break;
        }
        if (engine === 'elevenlabs') {
          if (!settings.elevenlabsApiKey) {
            failedEngines.push('elevenlabs (API Key yok)');
            continue;
          }
          audioBase64 = await this.synthesizeElevenLabs(processedText, settings.elevenlabsApiKey, elevenVoice);
          engineUsed = 'elevenlabs';
          break;
        }
        if (engine === 'webspeech') {
          engineUsed = 'webspeech';
          break;
        }
      } catch (err: any) {
        failedEngines.push(`${engine} (${err?.message || 'hata'})`);
      }
    }

    const item: TTSQueueItem = {
      id: uuidv4(),
      text: processedText,
      originalText: rawText,
      processedText,
      user,
      voice: engineUsed === 'gemini' ? geminiVoice : engineUsed === 'elevenlabs' ? elevenVoice : selectedVoice,
      language,
      gender,
      speed: settings.speed,
      pitch: playbackPitch,
      volume: settings.volume,
      primaryEngine: settings.primaryEngine,
      engineUsed,
      audioBase64,
      fallbackChain,
      failedEngines,
      timestamp: Date.now()
    };

    this.queue.push(item);
    if (this.queue.length > 50) this.queue.shift();
    this.emit('tts_queued', item);
    return item;
  }

  getQueue(): TTSQueueItem[] {
    return this.queue;
  }

  clearQueue() {
    this.queue = [];
  }
}

export const multiEngineTTS = new MultiEngineTTS();
export default multiEngineTTS;
