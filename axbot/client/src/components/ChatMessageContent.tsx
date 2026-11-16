import React from 'react';
import { useYediTvHaritasi } from '../lib/yediTv.js';

interface ChatMessageContentProps {
  message: string;
  platform?: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo';
  className?: string;
  size?: number; // emote height in px, default 24
  /** Twitch IRC `emotes` etiketi (kimlik → "baş-son" konumları): kanalın kendi ve abone emote'ları */
  twitchEmotes?: Record<string, string[]>;
}

/** Twitch konumları kod noktası (UTF-16 değil) sayar: ad → görsel */
export function twitchEmoteHaritasi(message: string, emotes?: Record<string, string[]>): Map<string, string> {
  const h = new Map<string, string>();
  if (!emotes) return h;
  const harfler = Array.from(message);
  for (const [id, konumlar] of Object.entries(emotes)) {
    const m = /^(\d+)-(\d+)$/.exec(konumlar?.[0] || '');
    if (!m || !/^[\w-]+$/.test(id)) continue;
    const ad = harfler.slice(Number(m[1]), Number(m[2]) + 1).join('');
    if (ad) h.set(ad, `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`);
  }
  return h;
}

// Global 7TV / Twitch / BTTV emote dictionary
const GLOBAL_EMOTES: Record<string, string> = {
  // 7TV & BTTV top popular
  KEKW: 'https://cdn.7tv.app/emote/60afb120f262e3d551e44f8f/2x.webp',
  monkaS: 'https://cdn.7tv.app/emote/603cb50bf129a07174e2a6d4/2x.webp',
  monkaW: 'https://cdn.7tv.app/emote/60ae31b5c468e227092c4e2c/2x.webp',
  pepeJAM: 'https://cdn.7tv.app/emote/604245ad8b971a0d33e5c94d/2x.webp',
  catJAM: 'https://cdn.7tv.app/emote/603cb951f129a07174e2a7b6/2x.webp',
  OMEGALUL: 'https://cdn.7tv.app/emote/60ae3214c468e227092c4e36/2x.webp',
  Pepega: 'https://cdn.7tv.app/emote/603cb478f129a07174e2a6ba/2x.webp',
  pepega: 'https://cdn.7tv.app/emote/603cb478f129a07174e2a6ba/2x.webp',
  Pog: 'https://cdn.7tv.app/emote/60b949c25f778d91a99ef835/2x.webp',
  pog: 'https://cdn.7tv.app/emote/60b949c25f778d91a99ef835/2x.webp',
  widepeepoHappy: 'https://cdn.7tv.app/emote/60ae32a1c468e227092c4e47/2x.webp',
  widepeepoSad: 'https://cdn.7tv.app/emote/60ae329ac468e227092c4e45/2x.webp',
  pepeLaugh: 'https://cdn.7tv.app/emote/60ae3238c468e227092c4e3c/2x.webp',
  Sadge: 'https://cdn.7tv.app/emote/60ae320ec468e227092c4e35/2x.webp',
  sadge: 'https://cdn.7tv.app/emote/60ae320ec468e227092c4e35/2x.webp',
  COCKA: 'https://cdn.7tv.app/emote/60ae31d3c468e227092c4e2f/2x.webp',
  modCheck: 'https://cdn.7tv.app/emote/60ae31fac468e227092c4e33/2x.webp',
  HUH: 'https://cdn.7tv.app/emote/622df149b0eb231872147f89/2x.webp',
  GIGACHAD: 'https://cdn.7tv.app/emote/60ae73eb9b466185888204bb/2x.webp',
  Aware: 'https://cdn.7tv.app/emote/61462ab9e3b97b095e69e4f0/2x.webp',
  Clueless: 'https://cdn.7tv.app/emote/61476100e3b97b095e69e71e/2x.webp',
  Susge: 'https://cdn.7tv.app/emote/60b64d1f2b4890a8867a58a7/2x.webp',
  AYAYA: 'https://cdn.7tv.app/emote/60ae325fc468e227092c4e41/2x.webp',
  BOP: 'https://cdn.7tv.app/emote/60ae3188c468e227092c4e27/2x.webp',
  POGGERS: 'https://cdn.7tv.app/emote/60ae3252c468e227092c4e40/2x.webp',
  NODDERS: 'https://cdn.7tv.app/emote/60ae31c6c468e227092c4e2d/2x.webp',
  NOPERS: 'https://cdn.7tv.app/emote/60ae31ccc468e227092c4e2e/2x.webp',
  EZ: 'https://cdn.7tv.app/emote/60ae323fc468e227092c4e3d/2x.webp',
  LULW: 'https://cdn.7tv.app/emote/60ae321dc468e227092c4e37/2x.webp',

  // Official Twitch global emotes
  Kappa: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0',
  kappa: 'https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0',
  PogChamp: 'https://static-cdn.jtvnw.net/emoticons/v2/305954156/default/dark/2.0',
  pogchamp: 'https://static-cdn.jtvnw.net/emoticons/v2/305954156/default/dark/2.0',
  LUL: 'https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/2.0',
  lul: 'https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/2.0',
  BibleThump: 'https://static-cdn.jtvnw.net/emoticons/v2/86/default/dark/2.0',
  Kreygasm: 'https://static-cdn.jtvnw.net/emoticons/v2/41/default/dark/2.0',
  ResidentSleeper: 'https://static-cdn.jtvnw.net/emoticons/v2/245/default/dark/2.0',
  HeyGuys: 'https://static-cdn.jtvnw.net/emoticons/v2/30259/default/dark/2.0',
  NotLikeThis: 'https://static-cdn.jtvnw.net/emoticons/v2/58765/default/dark/2.0',
  VoHiYo: 'https://static-cdn.jtvnw.net/emoticons/v2/81274/default/dark/2.0',
  CoolCat: 'https://static-cdn.jtvnw.net/emoticons/v2/58127/default/dark/2.0',
  BloodTrail: 'https://static-cdn.jtvnw.net/emoticons/v2/69/default/dark/2.0',
  WutFace: 'https://static-cdn.jtvnw.net/emoticons/v2/28087/default/dark/2.0',
  DansGame: 'https://static-cdn.jtvnw.net/emoticons/v2/33/default/dark/2.0',
  SwiftRage: 'https://static-cdn.jtvnw.net/emoticons/v2/34/default/dark/2.0',
  SMOrc: 'https://static-cdn.jtvnw.net/emoticons/v2/52/default/dark/2.0'
};

/**
 * Parses message tokens and renders platform emotes (Kick, Discord, Twitch, 7TV/BTTV) as images.
 */
export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({
  message,
  className = '',
  size = 24,
  twitchEmotes
}) => {
  // Kanalın ve 7TV genel setinin canlı listesi (sabit sözlük çevrimdışı yedek)
  const yediTv = useYediTvHaritasi();
  if (!message) return null;
  const twitch = twitchEmoteHaritasi(message, twitchEmotes);

  // Tokenize string while preserving Kick emotes [emote:id:name], Discord emojis <:name:id>, and words
  // Regex matches:
  // 1) Kick emotes: [emote:12345:name]
  // 2) Discord emojis: <:name:12345> or <a:name:12345>
  // 3) General words or whitespace
  const combinedRegex = /(\[emote:\d+:[^\]]+\]|<a?:[a-zA-Z0-9_~]+:\d+>|\s+)/g;
  const parts = message.split(combinedRegex).filter(Boolean);

  return (
    <span className={`inline leading-relaxed break-words ${className}`}>
      {parts.map((part, index) => {
        // 1. Kick Emote Pattern: [emote:5748035:collectiblesmonkaEyes]
        const kickMatch = part.match(/^\[emote:(\d+):([^\]]+)\]$/);
        if (kickMatch) {
          const emoteId = kickMatch[1];
          const emoteName = kickMatch[2];
          return (
            <img
              key={`kick_emote_${index}_${emoteId}`}
              src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
              alt={emoteName}
              title={emoteName}
              style={{ height: `${size}px`, maxWidth: `${size * 2}px` }}
              className="inline-block align-middle object-contain mx-0.5 my-[-2px] transition-transform hover:scale-125 select-none"
              loading="lazy"
              onError={(e) => {
                // If emote image fails to load, gracefully fallback to emote name text
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          );
        }

        // 2. Discord Emoji Pattern: <:kekw:123456789> or <a:dance:123456789>
        const discordMatch = part.match(/^<(a)?:([a-zA-Z0-9_~]+):(\d+)>$/);
        if (discordMatch) {
          const isAnimated = Boolean(discordMatch[1]);
          const emojiName = discordMatch[2];
          const emojiId = discordMatch[3];
          const ext = isAnimated ? 'gif' : 'webp';
          return (
            <img
              key={`dc_emoji_${index}_${emojiId}`}
              src={`https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=48&quality=lossless`}
              alt={emojiName}
              title={emojiName}
              style={{ height: `${size}px`, maxWidth: `${size * 2}px` }}
              className="inline-block align-middle object-contain mx-0.5 my-[-2px] transition-transform hover:scale-125 select-none"
              loading="lazy"
            />
          );
        }

        // 3. Check for Global 7TV / Twitch / BTTV emotes in plain text words
        const emoteUrl = twitch.get(part) || yediTv.get(part) || (Object.prototype.hasOwnProperty.call(GLOBAL_EMOTES, part) ? GLOBAL_EMOTES[part] : undefined);
        if (emoteUrl) {
          return (
            <img
              key={`global_emote_${index}_${part}`}
              src={emoteUrl}
              alt={part}
              title={part}
              style={{ height: `${size}px`, maxWidth: `${size * 2}px` }}
              className="inline-block align-middle object-contain mx-0.5 my-[-2px] transition-transform hover:scale-125 select-none"
              loading="lazy"
            />
          );
        }

        // 4. Regular text segment
        return <React.Fragment key={`text_${index}`}>{part}</React.Fragment>;
      })}
    </span>
  );
};

export default ChatMessageContent;
