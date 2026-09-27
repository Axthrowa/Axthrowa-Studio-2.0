/**
 * Yayın çalışma alanının saf yardımcıları (test edilir).
 */
import { cikisEtkin, KAYNAK_TURLERI, type MotorDurumu, type MotorKaynak, type MotorSahneOgesi } from "./api/motor";

/** Süreyi `SS:DD:ss` biçiminde yazar (canlı / kayıt sayacı). */
export function sureBicimi(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const iki = (n: number) => String(n).padStart(2, "0");
  return `${iki(Math.floor(s / 3600))}:${iki(Math.floor((s % 3600) / 60))}:${iki(s % 60)}`;
}

/** Kaynak ses taşıyor mu (mikser ve iz maskesi için). */
export function sesKaynagi(k: Pick<MotorKaynak, "tur">): boolean {
  return !!KAYNAK_TURLERI.find((t) => t.tur === k.tur)?.ses;
}

/** Motor alttan üste verir; kaynak listesi OBS'teki gibi üstten alta gösterilir. */
export function ustenAlta(ogeler: MotorSahneOgesi[]): MotorSahneOgesi[] {
  return [...ogeler].reverse();
}

/** Canlı hedef sayısı / toplam motor hedefi (etkin + anahtarlı). */
export function canliOzeti(d: Pick<MotorDurumu, "hedefler">): { canli: number; toplam: number } {
  const uygun = d.hedefler.filter((h) => h.etkin && h.anahtarVar);
  return { canli: uygun.filter((h) => cikisEtkin(h.durum)).length, toplam: uygun.length };
}

/** Sayısal alan girdisi: boş/geçersiz → null; sınırlar içinde yuvarlanır. */
export function sayiGirdisi(metin: string, en_az: number, en_cok: number): number | null {
  const v = Number(metin.replace(",", "."));
  if (!metin.trim() || !Number.isFinite(v)) return null;
  return Math.round(Math.min(en_cok, Math.max(en_az, v)));
}
