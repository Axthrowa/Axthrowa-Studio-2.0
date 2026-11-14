/**
 * Y7 Twitch reklam takibi: takvimden "yaklaşıyor (60 sn)", "başlıyor" ve "bitti" olaylarını çıkarır; olaylar AxBoT
 * otomasyonuna gider (sohbete duyuru otomasyon kuralında "Sohbete yaz" eylemiyle yapılır, Studio kendiliğinden yazmaz).
 * Zamanlar Twitch'in verdiği gibi Unix saniye.
 */
import { axbotBase } from "./axbot";
import type { ReklamTakvimi } from "./platformAuth/twitchWrite";

export const YAKLASIYOR_SN = 60;

export type ReklamDurumu = { duyurulan: number; sonReklam: number | null; sure: number; bitis: number | null };
export const BOS_REKLAM: ReklamDurumu = { duyurulan: 0, sonReklam: null, sure: 0, bitis: null };
export type ReklamOlayi = "reklam_yaklasiyor" | "reklam_basliyor" | "reklam_bitti";

export function reklamAdimi(d: ReklamDurumu, t: ReklamTakvimi, simdiSn: number): { durum: ReklamDurumu; olaylar: ReklamOlayi[] } {
  const olaylar: ReklamOlayi[] = [];
  const n = { ...d };
  const kalan = t.sonrakiReklam - simdiSn;
  if (t.sonrakiReklam > 0 && kalan > 0 && kalan <= YAKLASIYOR_SN && n.duyurulan !== t.sonrakiReklam) {
    olaylar.push("reklam_yaklasiyor");
    n.duyurulan = t.sonrakiReklam;
  }
  // Başlangıç son reklam zamanının ilerlemesinden anlaşılır (elle başlatılan reklamı da yakalar); ilk okumada olay yok
  if (n.sonReklam !== null && t.sonReklam > n.sonReklam) {
    olaylar.push("reklam_basliyor");
    n.bitis = t.sonReklam + (n.sure || t.sure || 30);
  }
  n.sonReklam = t.sonReklam;
  if (n.bitis !== null && simdiSn >= n.bitis) {
    olaylar.push("reklam_bitti");
    n.bitis = null;
  }
  // Süre bir sonraki turda biten reklamın süresi olarak kullanılır (Twitch "duration" sıradaki reklamı anlatır)
  n.sure = t.sure;
  return { durum: n, olaylar };
}

export async function reklamOlayiGonder(tur: ReklamOlayi, miktar?: number) {
  try {
    await fetch(`${await axbotBase()}/api/otomasyon/olay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tur, miktar }) });
  } catch {
    /* AxBoT kapalı */
  }
}
