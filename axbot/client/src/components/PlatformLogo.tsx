import React from 'react';

export type PlatformType = 'kick' | 'twitch' | 'youtube' | 'discord' | 'tiktok' | 'trovo' | 'spotify' | 'ytmusic';

interface PlatformLogoProps {
  platform: PlatformType | string;
  className?: string;
  size?: number | string; // e.g. 20 or "w-5 h-5"
  variant?: 'icon' | 'badge' | 'pill';
  showLabel?: boolean;
}

export const PlatformLogo: React.FC<PlatformLogoProps> = ({
  platform,
  className = '',
  size = 20,
  variant = 'icon',
  showLabel = false
}) => {
  const norm = (platform || '').toLowerCase().trim();

  // Determine size classes or style
  const isClassSize = typeof size === 'string' && (size.includes('w-') || size.includes('h-'));
  const sizeClass = isClassSize ? size : '';
  const sizeStyle = !isClassSize ? { width: size, height: size } : undefined;

  const renderSvg = () => {
    switch (norm) {
      case 'kick':
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`${sizeClass} ${className}`}
            style={sizeStyle}
          >
            {/* Official Kick Pixel-Art Block K Glyph */}
            <path d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z" />
          </svg>
        );

      case 'twitch':
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`${sizeClass} ${className}`}
            style={sizeStyle}
          >
            {/* Official Twitch Glitch Logo */}
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
          </svg>
        );

      case 'youtube':
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`${sizeClass} ${className}`}
            style={sizeStyle}
          >
            {/* Official YouTube Play Icon */}
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        );

      case 'discord':
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`${sizeClass} ${className}`}
            style={sizeStyle}
          >
            {/* Official Discord Clyde Logo */}
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        );

      case 'tiktok':
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`${sizeClass} ${className}`}
            style={sizeStyle}
          >
            {/* Official TikTok Note Logo */}
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
        );

      case 'trovo':
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`${sizeClass} ${className}`}
            style={sizeStyle}
          >
            {/* Trovo'nun kendi logosu TELIFLIDIR ve kopyalanmadi.
                Burada notr, kendi cizdigimiz bir "canli yayin" isareti var. */}
            <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-5.2l-2.1 2.6a.9.9 0 0 1-1.4 0L9.2 18H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5.6 4.1v6.8a.6.6 0 0 0 .92.5l5.3-3.4a.6.6 0 0 0 0-1l-5.3-3.4a.6.6 0 0 0-.92.5z" />
          </svg>
        );

      case 'spotify':
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`${sizeClass} ${className}`}
            style={sizeStyle}
          >
            {/* Official Spotify Logo */}
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        );

      case 'ytmusic':
        return (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`${sizeClass} ${className}`}
            style={sizeStyle}
          >
            {/* Official YouTube Music Logo */}
            <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.091A7.098 7.098 0 0 1 4.909 12 7.098 7.098 0 0 1 12 4.909 7.098 7.098 0 0 1 19.091 12 7.098 7.098 0 0 1 12 19.091zm-2.182-11.455v8.728L16.364 12z" />
          </svg>
        );

      default:
        return null;
    }
  };

  if (variant === 'badge') {
    const badgeConfigs: Record<string, { bg: string; text: string; label: string; logoColor: string }> = {
      kick: { bg: 'bg-[#53fc18]', text: 'text-black', label: 'KICK', logoColor: 'text-black' },
      twitch: { bg: 'bg-[#9146ff]', text: 'text-white', label: 'TWITCH', logoColor: 'text-white' },
      youtube: { bg: 'bg-[#ff0000]', text: 'text-white', label: 'YOUTUBE', logoColor: 'text-white' },
      discord: { bg: 'bg-[#5865f2]', text: 'text-white', label: 'DISCORD', logoColor: 'text-white' },
      tiktok: { bg: 'bg-[#000000] border border-cyan-400/40', text: 'text-white', label: 'TIKTOK', logoColor: 'text-[#00f2fe]' },
      trovo: { bg: 'bg-[#19d66c] border border-emerald-300/40', text: 'text-black', label: 'TROVO', logoColor: 'text-black' },
      spotify: { bg: 'bg-[#1db954]', text: 'text-black', label: 'SPOTIFY', logoColor: 'text-black' },
      ytmusic: { bg: 'bg-[#ff0000]', text: 'text-white', label: 'YT MUSIC', logoColor: 'text-white' },
    };

    const cfg = badgeConfigs[norm] || { bg: 'bg-gray-700', text: 'text-white', label: norm.toUpperCase(), logoColor: 'text-white' };
    const padding = showLabel ? 'px-2 py-0.5 rounded-lg text-xs' : 'p-1 rounded-[5px]';

    return (
      <span
        title={cfg.label}
        className={`inline-flex items-center justify-center gap-1.5 flex-shrink-0 align-middle ${padding} font-black axt-etiket ${cfg.bg} ${cfg.text} shadow-sm ${className}`}
      >
        <span className={`${cfg.logoColor} flex items-center justify-center`}>
          {renderSvg()}
        </span>
        {showLabel && <span>{cfg.label}</span>}
      </span>
    );
  }

  if (variant === 'pill') {
    const pillConfigs: Record<string, { bg: string; border: string; text: string; label: string; logoColor: string }> = {
      kick: { bg: 'bg-[#53fc18]/10', border: 'border-[#53fc18]/30', text: 'text-[#53fc18]', label: 'Kick', logoColor: 'text-[#53fc18]' },
      twitch: { bg: 'bg-[#9146ff]/10', border: 'border-[#9146ff]/30', text: 'text-[#a970ff]', label: 'Twitch', logoColor: 'text-[#9146ff]' },
      youtube: { bg: 'bg-[#ff0000]/10', border: 'border-[#ff0000]/30', text: 'text-red-400', label: 'YouTube', logoColor: 'text-[#ff0000]' },
      discord: { bg: 'bg-[#5865f2]/10', border: 'border-[#5865f2]/30', text: 'text-[#7289da]', label: 'Discord', logoColor: 'text-[#5865f2]' },
      tiktok: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300', label: 'TikTok', logoColor: 'text-[#00f2fe]' },
      trovo: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', label: 'Trovo', logoColor: 'text-[#19d66c]' },
      spotify: { bg: 'bg-[#1db954]/10', border: 'border-[#1db954]/30', text: 'text-[#1db954]', label: 'Spotify', logoColor: 'text-[#1db954]' },
      ytmusic: { bg: 'bg-red-600/10', border: 'border-red-600/30', text: 'text-red-400', label: 'YT Music', logoColor: 'text-red-500' },
    };

    const pcfg = pillConfigs[norm] || { bg: 'bg-gray-800', border: 'border-gray-700', text: 'text-gray-300', label: norm, logoColor: 'text-white' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${pcfg.bg} ${pcfg.border} ${pcfg.text} ${className}`}>
        <span className={pcfg.logoColor}>
          {renderSvg()}
        </span>
        {showLabel && <span>{pcfg.label}</span>}
      </span>
    );
  }

  return renderSvg();
};

export default PlatformLogo;
