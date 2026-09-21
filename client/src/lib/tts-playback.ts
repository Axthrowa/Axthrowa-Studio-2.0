/**
 * StreamAxT TTS playback — applies selected voice gender on the client
 * Developed by AxthrowA
 */

const MALE_HINTS = /male|man|erkek|ahmet|guy|ryan|conrad|henri|alvaro|diego|antonio|keita|injoon|dmitry|hamed|tolga|david|mark|james|daniel|thomas|fenrir|puck|charon|antoni|josh|adam/i;
const FEMALE_HINTS = /female|woman|kadın|kadin|emel|jenny|aria|sonia|katja|denise|elvira|elsa|francisca|nanami|zira|hazel|hedda|kore|aoede|rachel|sarah|gigi|elli/i;

export function pickBrowserVoice(lang = 'tr-TR', gender: 'male' | 'female' | 'neutral' = 'neutral'): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefix = String(lang).slice(0, 2).toLowerCase();
  const langMatches = voices.filter(v => v.lang.toLowerCase().startsWith(prefix));
  const pool = langMatches.length ? langMatches : voices;
  if (gender === 'male') {
    return pool.find(v => MALE_HINTS.test(`${v.name} ${v.voiceURI}`)) || pool.find(v => !FEMALE_HINTS.test(`${v.name} ${v.voiceURI}`)) || pool[0];
  }
  if (gender === 'female') {
    return pool.find(v => FEMALE_HINTS.test(`${v.name} ${v.voiceURI}`)) || pool[0];
  }
  return langMatches[0] || voices[0];
}

export function playTtsAudio(item: {
  audioBase64?: string;
  audioUrl?: string;
  processedText?: string;
  text?: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
  speed?: number;
  pitch?: number;
  volume?: number;
  engineUsed?: string;
  voice?: string;
}): Promise<void> {
  const src = item.audioBase64 || item.audioUrl;
  const text = item.processedText || item.text || '';
  const volume = Math.min(1, Math.max(0, item.volume ?? 0.8));
  const speed = Math.min(2, Math.max(0.5, item.speed || 1));
  const gender = item.gender || (MALE_HINTS.test(item.voice || '') ? 'male' : FEMALE_HINTS.test(item.voice || '') ? 'female' : 'neutral');
  const pitch = item.pitch || (item.engineUsed === 'google' && gender === 'male' ? 0.78 : item.engineUsed === 'google' && gender === 'female' ? 1.12 : 1);

  if (src) {
    return playPitched(src, volume, speed, pitch).catch(() => speakWebSpeech(text, item.language || 'tr-TR', gender, speed, pitch, volume));
  }
  return speakWebSpeech(text, item.language || 'tr-TR', gender, speed, pitch, volume);
}

function playPitched(src: string, volume: number, speed: number, pitch: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(pitch - 1) < 0.05) {
      const audio = new Audio(src);
      audio.volume = volume;
      audio.playbackRate = speed;
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('audio error'));
      audio.play().catch(reject);
      return;
    }

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    fetch(src)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = decoded;
        source.playbackRate.value = speed * pitch;
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.onended = () => {
          ctx.close().catch(() => {});
          resolve();
        };
        source.start(0);
      })
      .catch(reject);
  });
}

function speakWebSpeech(
  text: string,
  lang: string,
  gender: 'male' | 'female' | 'neutral',
  rate: number,
  pitch: number,
  volume: number
): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text) {
      resolve();
      return;
    }
    const speak = () => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = rate;
      utter.pitch = gender === 'male' ? Math.min(pitch, 0.85) : gender === 'female' ? Math.max(pitch, 1.05) : pitch;
      utter.volume = volume;
      const match = pickBrowserVoice(lang, gender);
      if (match) utter.voice = match;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => speak();
      setTimeout(speak, 250);
    } else {
      speak();
    }
  });
}
