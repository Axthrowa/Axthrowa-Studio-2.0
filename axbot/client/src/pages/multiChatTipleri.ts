/** Çoklu sohbet: ceza adları ve izleyici kartı tipleri (TEK-4). */


export const CEZA_AD: Record<string, string> = {
  MANUAL_TIMEOUT: 'Zaman aşımı',
  MANUAL_BAN: 'Ban',
  MANUAL_UNBAN: 'Ban kalktı',
  MANUAL_DELETE_MESSAGE: 'Mesaj silindi',
  SHARED_BAN_ENFORCED: 'Kara liste',
  SHARED_BAN_FAILED: 'Kara liste başarısız'
};

export const cezaAdi = (action: string) => (action.startsWith('automod:') ? `AutoMod (${action.slice(8)})` : CEZA_AD[action] || action);

export type TemizlikSonucu = { ok: boolean; yontem?: string; silinen?: number; kalan?: number; hata?: string };

export interface ViewerModalData {
  username: string;
  displayName: string;
  platform: string;
  /** Botun kendi mesajı: moderasyon düğmeleri gösterilmez. */
  kendiBotu?: boolean;
  avatarUrl?: string;
  roles?: string[];
  note: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentDetails?: { positives?: number; negatives?: number; messageCount?: number; summary?: string; source?: string; recent?: string[] };
  kart?: {
    mesajlar: { message: string; timestamp: number }[];
    cezalar: { action: string; timestamp: number; details: string | null }[];
  };
}
