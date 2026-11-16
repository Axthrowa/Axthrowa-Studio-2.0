/**
 * AxBoT — OAuth yönlendirme adresi ve `state` doğrulaması
 * Developed by AxthrowA
 *
 * Kick yetkilendirmesi eskiden `http://localhost:3001/...` adresine sabitti:
 * sunucu başka portta (PORT=3011) çalışınca Kick kullanıcıyı ya boşluğa ya da
 * AYNI makinedeki başka bir AxBoT kopyasına döndürüyordu. Ayrıca üretilen
 * `state` hiç denetlenmiyordu; geri dönüşte yalnız PKCE'ye güveniliyordu.
 */
import crypto from 'crypto';

/** Sunucunun dinlediği port (index.ts ile aynı kural). */
export function sunucuPortu(env: NodeJS.ProcessEnv = process.env): number {
  const p = Number(env.PORT);
  return Number.isInteger(p) && p > 0 && p < 65536 ? p : 3001;
}

/** Kick geliştirici portalına kaydedilmesi gereken geri dönüş adresi. */
export function kickYonlendirmeAdresi(port: number = sunucuPortu()): string {
  return `http://localhost:${port}/api/auth/kick/callback`;
}

/** Bekleyen yetkilendirmenin ömrü: kullanıcı giriş sayfasında oyalanabilir. */
export const STATE_OMRU_MS = 15 * 60 * 1000;

export interface BekleyenState {
  deger: string;
  bitis: number;
}

export function yeniState(simdi: number = Date.now()): BekleyenState {
  return { deger: crypto.randomBytes(16).toString('hex'), bitis: simdi + STATE_OMRU_MS };
}

/**
 * Geri dönüşteki `state` bekleneni mi? Tek kullanımlıktır: çağıran başarılı
 * eşleşmeden sonra bekleyeni silmelidir. Sabit zamanlı karşılaştırma.
 */
export function stateGecerliMi(bekleyen: BekleyenState | null, gelen: unknown, simdi: number = Date.now()): boolean {
  if (!bekleyen || typeof gelen !== 'string' || !gelen) return false;
  if (simdi > bekleyen.bitis) return false;
  const a = Buffer.from(bekleyen.deger);
  const b = Buffer.from(gelen);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
