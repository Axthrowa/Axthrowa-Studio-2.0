/** Kalan kayıt süresi (OBS İstatistikler "Kalan kayıt süresi"): boş disk alanı ÷ ölçülen kayıt bit hızı */
export function kalanKayitSn(bosBayt: number | null | undefined, kbps: number | null | undefined): number | null {
  if (bosBayt == null || !kbps || kbps <= 0 || !Number.isFinite(kbps)) return null;
  return Math.floor((bosBayt * 8) / (kbps * 1000));
}

export function sureMetni(sn: number | null): string {
  if (sn == null) return "—";
  const s = Math.max(0, sn);
  const sa = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  return sa > 0 ? `${sa} sa ${dk} dk` : `${dk} dk`;
}

export function boyutMetni(bayt: number | null | undefined): string {
  if (bayt == null) return "—";
  return bayt >= 1024 ** 4 ? `${(bayt / 1024 ** 4).toFixed(2)} TB` : `${(bayt / 1024 ** 3).toFixed(1)} GB`;
}
