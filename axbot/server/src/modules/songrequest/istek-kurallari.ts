/**
 * Şarkı isteği kuralları (B6), saf: seviyeye göre sıradaki istek sınırı, kullanıcı engel listesi ve ücret.
 * Ayar boşsa bir üst seviye için izleyici sınırı geçerlidir. Yayıncı ve modlar hiçbir kurala takılmaz.
 */
export type IstekYapan = { username: string; displayName: string; isMod: boolean; isSub: boolean; isVip: boolean; isBroadcaster: boolean };
export type SinirAyari = { izleyici: string; abone: string; vip: string };

const sayi = (v: string, yedek: number) => (String(v ?? '').trim() === '' ? yedek : Math.max(0, Math.floor(Number(v) || 0)));

/** Kişinin sırada aynı anda tutabileceği istek sayısı; 0 = sınırsız */
export function istekSiniri(u: IstekYapan, a: SinirAyari): number {
  if (u.isBroadcaster || u.isMod) return 0;
  const izleyici = sayi(a.izleyici, 2);
  const secilen = [u.isVip ? sayi(a.vip, izleyici) : null, u.isSub ? sayi(a.abone, izleyici) : null].filter((n): n is number => n !== null);
  if (!secilen.length) return izleyici;
  // 0 sınırsızdır: en cömert seviye kazanır
  return secilen.includes(0) ? 0 : Math.max(...secilen, izleyici);
}

/** Her satıra bir kullanıcı adı; @ ve büyük/küçük harf önemsiz */
export function kullaniciEngelli(u: IstekYapan, liste: string): boolean {
  if (u.isBroadcaster || u.isMod) return false;
  const adlar = new Set(String(liste || '').split(/\r?\n|,/).map((s) => s.trim().replace(/^@/, '').toLowerCase()).filter(Boolean));
  return adlar.has(u.username.toLowerCase()) || adlar.has(u.displayName.toLowerCase());
}

/** Ücret alınacak mı ve bakiye yetiyor mu. Ücret istek sıraya girince düşülür, ret olursa hiç düşülmez. */
export function ucretDurumu(u: IstekYapan, ucret: number, bakiye: number): { ucret: number } | { neden: string } {
  const u2 = Math.max(0, Math.floor(ucret) || 0);
  if (!u2 || u.isBroadcaster || u.isMod) return { ucret: 0 };
  if (bakiye < u2) return { neden: `şarkı isteği ${u2} puan, sende ${bakiye} var` };
  return { ucret: u2 };
}

/** K4: kayıtlı ödemeler → yalnız hâlâ sırada bekleyen ve biçimi doğru olanlar */
export function odenenleriYukle(kayit: unknown, bekliyor: (id: string) => boolean): Map<string, { kullanici: string; ucret: number }> {
  const m = new Map<string, { kullanici: string; ucret: number }>();
  if (!Array.isArray(kayit)) return m;
  for (const g of kayit) {
    const [id, o] = Array.isArray(g) ? g : [];
    const ucret = Math.floor(Number(o?.ucret));
    if (typeof id === 'string' && typeof o?.kullanici === 'string' && ucret > 0 && bekliyor(id)) m.set(id, { kullanici: o.kullanici, ucret });
  }
  return m;
}

/** K4: kayıtlı beğeniler (son 50 şarkı) → şarkı adı başına beğenen kişiler */
export function begenileriYukle(kayit: unknown): Map<string, Set<string>> {
  if (!Array.isArray(kayit)) return new Map();
  return new Map(
    kayit
      .filter((g): g is [string, unknown[]] => Array.isArray(g) && typeof g[0] === 'string' && Array.isArray(g[1]))
      .slice(-50)
      .map(([ad, kisiler]) => [ad, new Set(kisiler.map(String))])
  );
}
