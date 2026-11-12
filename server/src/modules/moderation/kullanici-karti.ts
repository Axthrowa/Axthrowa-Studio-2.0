/** Sohbet kartı: son mesajlar ve bu kullanıcıya yazılmış cezalar. */

const CEZA = /^(MANUAL_TIMEOUT|MANUAL_BAN|MANUAL_UNBAN|MANUAL_DELETE_MESSAGE|SHARED_BAN_ENFORCED|SHARED_BAN_FAILED)$|^automod:/;

export function cezaMi(action: string): boolean {
  return CEZA.test(action);
}

export function hedefEsit(target: string | null | undefined, ad: string): boolean {
  const a = String(target || '').replace(/^@/, '').trim().toLocaleLowerCase('tr');
  const b = ad.replace(/^@/, '').trim().toLocaleLowerCase('tr');
  return Boolean(b) && a === b;
}

export interface KartMesaji {
  message: string;
  timestamp: number;
}

export interface KartCeza {
  action: string;
  timestamp: number;
  details: string | null;
  target: string | null;
}

export function kullaniciKarti(ad: string, mesajlar: KartMesaji[], kayitlar: KartCeza[]) {
  const son = mesajlar
    .filter((m) => String(m.message || '').trim())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)
    .reverse();
  const cezalar = kayitlar
    .filter((k) => hedefEsit(k.target, ad) && cezaMi(k.action))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
  return { mesajlar: son, cezalar };
}
