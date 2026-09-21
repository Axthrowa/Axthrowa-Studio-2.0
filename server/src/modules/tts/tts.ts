/**
 * StreamAxT TTS Queue Bridge
 * Developed by AxthrowA
 */

import { EventEmitter } from 'events';
import { db } from '../../db/index.js';
import { multiEngineTTS, TTSQueueItem } from './tts-engine.js';
import { TTSSettings } from '../../db/schema.js';

export interface TTSItem {
  id: string;
  text: string;
  voice: string;
  user: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
  speed?: number;
  pitch?: number;
  volume?: number;
  audioUrl?: string;
  audioBase64?: string;
  engineUsed?: string;
  timestamp: number;
}

function toPlayable(item: TTSQueueItem): TTSItem {
  return {
    id: item.id,
    text: item.processedText || item.text,
    voice: item.voice,
    user: item.user,
    language: item.language,
    gender: item.gender,
    speed: item.speed,
    pitch: item.pitch,
    volume: item.volume,
    audioUrl: item.audioUrl,
    audioBase64: item.audioBase64,
    engineUsed: item.engineUsed,
    timestamp: item.timestamp
  };
}

class TTSEngine extends EventEmitter {
  constructor() {
    super();
    multiEngineTTS.on('tts_queued', (item: TTSQueueItem) => {
      this.emit('tts_queued', toPlayable(item));
    });
  }

  enqueue(text: string, user: string, voice?: string, override?: Partial<TTSSettings>): TTSItem | null {
    const enabledRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'tts_enabled'").get() as { value: string } | undefined;
    if (enabledRow?.value === 'false') return null;

    const settings = multiEngineTTS.getSettings();
    const selectedVoice = voice || settings.edgeVoice || 'tr-TR-AhmetNeural';

    multiEngineTTS.synthesizeWithFallback(text, user, {
      ...override,
      edgeVoice: selectedVoice
    }).catch((err) => {
      console.error('[TTS] Error synthesizing:', err);
    });

    return {
      id: `pending-${Date.now()}`,
      text,
      voice: selectedVoice,
      user,
      language: settings.language,
      timestamp: Date.now()
    };
  }

  async speak(text: string, user: string, override?: Partial<TTSSettings>): Promise<TTSItem | null> {
    const item = await multiEngineTTS.synthesizeWithFallback(text, user, override);
    return item ? toPlayable(item) : null;
  }

  getQueue(): TTSItem[] {
    return multiEngineTTS.getQueue().map(toPlayable);
  }

  clearQueue() {
    multiEngineTTS.clearQueue();
  }
}

export const ttsEngine = new TTSEngine();
export { multiEngineTTS } from './tts-engine.js';
export default ttsEngine;
