/**
 * Sohbet satırındaki kullanıcı resmi. Mesajla gelen adres yoksa Kick ve Twitch için
 * sunucudan sorulur; resim bulunamazsa isteğe göre adın baş harfi çizilir.
 * Developed by AxthrowA
 */
import { useState, type CSSProperties } from 'react';

export type AvatarBicimi = 'circle' | 'rounded' | 'square';

export function avatarAdresi(platform: string, kullanici?: string, url?: string): string {
  if (url && /^https:\/\//i.test(url)) return url;
  if ((platform === 'kick' || platform === 'twitch') && kullanici && /^[A-Za-z0-9_-]{1,40}$/.test(kullanici)) {
    return `/api/chat/avatar/${platform}/${encodeURIComponent(kullanici)}`;
  }
  return '';
}

export function basHarf(ad?: string): string {
  return Array.from(String(ad || '').trim())[0]?.toLocaleUpperCase('tr') || '?';
}

const YARICAP: Record<AvatarBicimi, string> = { circle: '50%', rounded: '22%', square: '0' };

interface Props {
  platform: string;
  kullanici?: string;
  ad?: string;
  url?: string;
  boyut: number;
  bicim?: AvatarBicimi | string;
  yedekHarf?: boolean;
  renk?: string;
  onClick?: () => void;
  className?: string;
}

export function SohbetAvatari({ platform, kullanici, ad, url, boyut, bicim, yedekHarf = true, renk, onClick, className = '' }: Props) {
  const adres = avatarAdresi(platform, kullanici, url);
  const [bozuk, setBozuk] = useState('');
  const stil: CSSProperties = {
    width: boyut,
    height: boyut,
    borderRadius: YARICAP[bicim as AvatarBicimi] ?? YARICAP.circle,
    flexShrink: 0,
    cursor: onClick ? 'pointer' : undefined
  };
  if (adres && bozuk !== adres) {
    return (
      <img
        src={adres}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={className}
        style={{ ...stil, objectFit: 'cover' }}
        onClick={onClick}
        onError={() => setBozuk(adres)}
      />
    );
  }
  if (!yedekHarf) return null;
  return (
    <span
      aria-hidden
      className={className}
      onClick={onClick}
      style={{ ...stil, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#1f2937', color: renk || '#e5e7eb', fontSize: Math.round(boyut * 0.5), fontWeight: 700, lineHeight: 1 }}
    >
      {basHarf(ad || kullanici)}
    </span>
  );
}
