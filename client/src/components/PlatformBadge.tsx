import React from 'react';

export interface BadgeInfo {
  type: string;
  text?: string;
  imageUrl?: string;
  image_url?: string;
  count?: number;
}

interface PlatformBadgeProps {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  badge: string | BadgeInfo;
  size?: number;
}

/**
 * Pixel-perfect original platform badges for Kick, Twitch, YouTube, Discord & TikTok.
 */
export const PlatformBadge: React.FC<PlatformBadgeProps> = ({ platform, badge, size = 18 }) => {
  // Normalize badge info
  const badgeObj: BadgeInfo = typeof badge === 'string' 
    ? { type: badge.split('/')[0].toLowerCase(), text: badge }
    : { ...badge, type: (badge.type || '').toLowerCase(), imageUrl: badge.imageUrl || badge.image_url };

  const type = badgeObj.type;
  const directImage = badgeObj.imageUrl;

  // 1. Direct platform CDN image (e.g. Kick badges_v2 or custom subscriber badge)
  if (directImage) {
    return (
      <img
        src={directImage}
        alt={badgeObj.text || type}
        title={badgeObj.text || type}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="inline-block rounded object-contain flex-shrink-0 align-middle select-none"
        loading="lazy"
      />
    );
  }

  // 2. Twitch Official CDN Badges
  if (platform === 'twitch') {
    const twitchBadgeUrls: Record<string, string> = {
      broadcaster: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309d084cd10/2',
      moderator: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2',
      mod: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2',
      vip: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/2',
      subscriber: 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff44952179d/2',
      sub: 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff44952179d/2',
      founder: 'https://static-cdn.jtvnw.net/badges/v1/09d93036-9ce6-45c6-8e7e-3161742058fb/2',
      partner: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/2',
      verified: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/2',
      premium: 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a998-423e-abcb-65624a34eb60/2',
      prime: 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a998-423e-abcb-65624a34eb60/2',
      turbo: 'https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-abac-f6c23f87dd47/2',
      artist: 'https://static-cdn.jtvnw.net/badges/v1/4500a716-3464-47f9-892f-b00630ff768f/2'
    };

    if (twitchBadgeUrls[type]) {
      return (
        <img
          src={twitchBadgeUrls[type]}
          alt={badgeObj.text || type}
          title={badgeObj.text || type}
          style={{ width: `${size}px`, height: `${size}px` }}
          className="inline-block rounded object-contain flex-shrink-0 align-middle select-none shadow-sm"
          loading="lazy"
        />
      );
    }
  }

  // 3. Kick Official Style Badges (Exact match to Kick platform UI)
  if (platform === 'kick') {
    const KICK_CROWN = "M12 4 8.5 9.2 4 6.5l1.6 9.3h12.8L20 6.5l-4.5 2.7zM5.6 18.2h12.8v2H5.6z";
    const KICK_SWORD = "M20.7 5.6a4.5 4.5 0 0 1-5.9 5.9l-7.2 7.2a1.8 1.8 0 1 1-2.5-2.5l7.2-7.2a4.5 4.5 0 0 1 5.9-5.9l-2.8 2.8 2.5 2.5 2.8-2.8z";
    const KICK_SEAL = "M12 1.5 14.6 4l3.5-.4 1 3.4 3 1.9-1.6 3.1 1.6 3.1-3 1.9-1 3.4-3.5-.4L12 22.5 9.4 20l-3.5.4-1-3.4-3-1.9L4.5 12 2.9 8.9l3-1.9 1-3.4L10.4 4 12 1.5zm-1 13.6 5.3-5.3-1.4-1.4-3.9 3.9-1.9-1.9-1.4 1.4 3.3 3.3z";
    const KICK_STAR = "M12 2.6 15 9l7 .9-5.1 4.8 1.3 6.9L12 18.2 5.8 21.6l1.3-6.9L2 9.9 9 9l3-6.4z";
    const KICK_HEART = "M12 21s-7.8-4.9-9.4-9.4C1.3 8 3.4 4.5 7 4.5c2 0 3.6 1 5 2.7 1.4-1.7 3-2.7 5-2.7 3.6 0 5.7 3.5 4.4 7.1C19.8 16.1 12 21 12 21z";
    const KICK_GIFT = "M20 8h-2.4a3 3 0 0 0-4.1-4.2L12 4.9l-1.5-1.1A3 3 0 0 0 6.4 8H4v4h1v9h14v-9h1V8zm-6.3-2.7a1.2 1.2 0 1 1 1.6 1.8L13 8V5.9l.7-.6zM8.7 5.3l.6.6V8L7.7 7.1a1.2 1.2 0 0 1 1-1.8zM13 19h-2v-9h2v9z";
    const KICK_SHIELD = "M12 2 4 5.2v6c0 5 3.4 9.6 8 10.8 4.6-1.2 8-5.8 8-10.8v-6L12 2zm-1 14.5-4-4 1.5-1.5 2.5 2.5 5-5L17.5 10l-6.5 6.5z";

    if (type === 'broadcaster' || type === 'owner') {
      return (
        <span
          title="Yayıncı"
          style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#e91916' }}
          className="inline-flex items-center justify-center rounded-[4px] text-white font-black flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[11px] h-[11px]">
            <path d={KICK_CROWN} />
          </svg>
        </span>
      );
    }

    if (type === 'moderator' || type === 'mod') {
      return (
        <span
          title="Moderatör"
          style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#00c7ff' }}
          className="inline-flex items-center justify-center rounded-[4px] text-black font-black flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[11px] h-[11px]">
            <path d={KICK_SWORD} />
          </svg>
        </span>
      );
    }

    if (type === 'vip') {
      return (
        <span
          title="VIP"
          style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#e9b800' }}
          className="inline-flex items-center justify-center rounded-[4px] text-black font-bold flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[11px] h-[11px]">
            <path d={KICK_STAR} />
          </svg>
        </span>
      );
    }

    if (type === 'subscriber' || type === 'sub') {
      return (
        <span
          title={`Abone ${badgeObj.count ? `(${badgeObj.count}. Ay)` : ''}`}
          style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#3EEDFE' }}
          className="inline-flex items-center justify-center rounded-[4px] text-black font-black flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[11px] h-[11px]">
            <path d={KICK_STAR} />
          </svg>
        </span>
      );
    }

    if (type === 'sub_gifter' || type === 'gifter') {
      return (
        <span
          title="Abonelik Hediye Eden"
          style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#3EEDFE' }}
          className="inline-flex items-center justify-center rounded-[4px] text-black font-black flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[11px] h-[11px]">
            <path d={KICK_GIFT} />
          </svg>
        </span>
      );
    }

    if (type === 'founder') {
      return (
        <span
          title="Kurucu Abone"
          style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#ff9d00' }}
          className="inline-flex items-center justify-center rounded-[4px] text-black font-black flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[11px] h-[11px]">
            <path d={KICK_HEART} />
          </svg>
        </span>
      );
    }

    if (type === 'verified') {
      return (
        <span
          title="Doğrulanmış"
          style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#1475e1' }}
          className="inline-flex items-center justify-center rounded-full text-white font-black flex-shrink-0 align-middle select-none shadow-sm"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[11px] h-[11px]">
            <path d={KICK_SEAL} />
          </svg>
        </span>
      );
    }

    if (type === 'og') {
      return (
        <span
          title="OG"
          style={{ width: `${size}px`, height: `${size}px`, backgroundColor: '#00ffb2' }}
          className="inline-flex items-center justify-center rounded-[4px] text-black font-black flex-shrink-0 align-middle select-none shadow-sm"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[11px] h-[11px]">
            <path d={KICK_SHIELD} />
          </svg>
        </span>
      );
    }
  }

  // 4. YouTube Badges
  if (platform === 'youtube') {
    if (type === 'broadcaster' || type === 'owner') {
      return (
        <span
          title="Yayıncı / Kanal Sahibi"
          style={{ width: `${size}px`, height: `${size}px` }}
          className="inline-flex items-center justify-center rounded-full bg-red-600 text-white font-bold flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[10px] h-[10px]">
            <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
          </svg>
        </span>
      );
    }
    if (type === 'moderator' || type === 'mod') {
      return (
        <span
          title="YouTube Moderatörü"
          style={{ width: `${size}px`, height: `${size}px` }}
          className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white font-bold flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[10px] h-[10px]">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
          </svg>
        </span>
      );
    }
    if (type === 'member' || type === 'subscriber' || type === 'sub') {
      return (
        <span
          title="Katıl Üyesi"
          style={{ width: `${size}px`, height: `${size}px` }}
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 text-white font-bold flex-shrink-0 align-middle shadow-sm select-none"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-[10px] h-[10px]">
            <path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" />
          </svg>
        </span>
      );
    }
  }

  // 5. Discord Badges
  if (platform === 'discord') {
    if (type === 'owner' || type === 'broadcaster') {
      return (
        <span
          title="Sunucu Sahibi"
          style={{ width: `${size}px`, height: `${size}px` }}
          className="inline-flex items-center justify-center rounded bg-amber-500 text-black font-bold flex-shrink-0 align-middle select-none"
        >
          👑
        </span>
      );
    }
    if (type === 'bot') {
      return (
        <span
          title="Bot"
          className="inline-flex items-center justify-center px-1 rounded bg-[#5865f2] text-white text-[9px] font-black tracking-wider uppercase flex-shrink-0 align-middle select-none h-[14px]"
        >
          BOT
        </span>
      );
    }
    if (type === 'moderator' || type === 'mod') {
      return (
        <span
          title="Discord Yöneticisi"
          style={{ width: `${size}px`, height: `${size}px` }}
          className="inline-flex items-center justify-center rounded bg-[#5865f2] text-white font-bold flex-shrink-0 align-middle select-none"
        >
          🛡️
        </span>
      );
    }
  }

  // 6. Generic Fallback Role Badge
  if (type === 'broadcaster' || type === 'owner') {
    return (
      <span className="bg-red-500/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 select-none">
        YAYINCI
      </span>
    );
  }
  if (type === 'moderator' || type === 'mod') {
    return (
      <span className="bg-[#53fc18] text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 select-none">
        MOD
      </span>
    );
  }
  if (type === 'subscriber' || type === 'sub') {
    return (
      <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 select-none">
        ABONE
      </span>
    );
  }
  if (type === 'vip') {
    return (
      <span className="bg-fuchsia-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 select-none">
        VIP
      </span>
    );
  }

  return null;
};

interface PlatformBadgesProps {
  platform: 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok';
  user: {
    badges?: string[];
    rawBadges?: any[];
    isBroadcaster?: boolean;
    isMod?: boolean;
    isSub?: boolean;
    isVip?: boolean;
  };
  size?: number;
}

/**
 * Renders all applicable badges for a user on a given platform.
 */
export const PlatformBadges: React.FC<PlatformBadgesProps> = ({ platform, user, size = 18 }) => {
  const badgeItems: Array<{ key: string; badge: string | BadgeInfo }> = [];

  // 1. Raw badges provided by platform (e.g. Kick badges_v2 with imageUrl, or Twitch badge tags)
  if (Array.isArray(user.rawBadges) && user.rawBadges.length > 0) {
    user.rawBadges.forEach((rb, idx) => {
      if (typeof rb === 'string') {
        badgeItems.push({ key: `raw_${idx}_${rb}`, badge: rb });
      } else if (rb && typeof rb === 'object') {
        badgeItems.push({
          key: `raw_${idx}_${rb.type || rb.name || idx}`,
          badge: {
            type: rb.type || rb.name || '',
            text: rb.text || rb.name,
            imageUrl: rb.image_url || rb.imageUrl,
            count: rb.count
          }
        });
      }
    });
  }

  // 2. If no raw badges or specific roles are set, ensure roles are represented
  const hasBroadcaster = badgeItems.some(b => typeof b.badge === 'string' ? b.badge.startsWith('broadcaster') : b.badge.type === 'broadcaster');
  const hasMod = badgeItems.some(b => typeof b.badge === 'string' ? (b.badge.startsWith('moderator') || b.badge.startsWith('mod')) : (b.badge.type === 'moderator' || b.badge.type === 'mod'));
  const hasVip = badgeItems.some(b => typeof b.badge === 'string' ? b.badge.startsWith('vip') : b.badge.type === 'vip');
  const hasSub = badgeItems.some(b => typeof b.badge === 'string' ? (b.badge.startsWith('subscriber') || b.badge.startsWith('sub')) : (b.badge.type === 'subscriber' || b.badge.type === 'sub'));

  if (user.isBroadcaster && !hasBroadcaster) {
    badgeItems.unshift({ key: 'role_broadcaster', badge: 'broadcaster' });
  }
  if (user.isMod && !user.isBroadcaster && !hasMod) {
    badgeItems.push({ key: 'role_mod', badge: 'moderator' });
  }
  if (user.isVip && !hasVip) {
    badgeItems.push({ key: 'role_vip', badge: 'vip' });
  }
  if (user.isSub && !hasSub) {
    badgeItems.push({ key: 'role_sub', badge: 'subscriber' });
  }

  // Also include user.badges if not already in badgeItems
  if (Array.isArray(user.badges)) {
    user.badges.forEach((bStr, idx) => {
      const bType = bStr.split('/')[0].toLowerCase();
      const alreadyPresent = badgeItems.some(existing => {
        const exType = typeof existing.badge === 'string' ? existing.badge.split('/')[0].toLowerCase() : existing.badge.type.toLowerCase();
        return exType === bType;
      });
      if (!alreadyPresent) {
        badgeItems.push({ key: `b_${idx}_${bStr}`, badge: bStr });
      }
    });
  }

  if (badgeItems.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1 flex-shrink-0 align-middle mr-0.5">
      {badgeItems.map(item => (
        <PlatformBadge key={item.key} platform={platform} badge={item.badge} size={size} />
      ))}
    </div>
  );
};
