/**
 * Y11 yayın takvimi: planlı yayınlar panel ayarında (`yayinTakvimi`) durur. Twitch takvimine yazılan yayının segment
 * kimliği saklanır (silince Twitch'ten de kalkar). Giriş/Çıkış ekranı sıradaki yayını, panel yayın saatinde hatırlatır.
 */
export type PlanliYayin = { id: string; zaman: string; baslik: string; kategori: string; sureDk: number; twitchId?: string };
export type TakvimAyari = { goster: boolean; liste: PlanliYayin[] };

export function takvimAyari(v: unknown): TakvimAyari {
  const a = (v && typeof v === "object" ? v : {}) as Partial<TakvimAyari>;
  const liste = (Array.isArray(a.liste) ? a.liste : [])
    .filter((y): y is PlanliYayin => !!y && typeof y.id === "string" && !Number.isNaN(Date.parse(String(y.zaman))))
    .map((y) => ({
      id: y.id.slice(0, 60),
      zaman: new Date(y.zaman).toISOString(),
      baslik: String(y.baslik ?? "").slice(0, 140),
      kategori: String(y.kategori ?? "").slice(0, 100),
      sureDk: Math.min(1440, Math.max(30, Number(y.sureDk) || 120)),
      ...(typeof y.twitchId === "string" && y.twitchId ? { twitchId: y.twitchId.slice(0, 200) } : {}),
    }))
    .sort((x, y) => x.zaman.localeCompare(y.zaman))
    .slice(0, 50);
  return { goster: a.goster !== false, liste };
}

/** Henüz bitmemiş ilk yayın (başlamış ama süresi dolmamış olan da sayılır) */
export function siradakiYayin(liste: PlanliYayin[], simdi: number): PlanliYayin | null {
  return liste.find((y) => Date.parse(y.zaman) + y.sureDk * 60_000 > simdi) ?? null;
}

/** "Sıradaki yayın: Cuma 20:00 · Başlık" (bugün/yarın kısaltılır) */
export function siradakiMetni(y: PlanliYayin, simdi: number, dil = "tr-TR"): string {
  const t = new Date(y.zaman);
  const gun = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const fark = Math.round((gun(t) - gun(new Date(simdi))) / 86_400_000);
  const saat = t.toLocaleTimeString(dil, { hour: "2-digit", minute: "2-digit" });
  const ne = fark === 0 ? "Bugün" : fark === 1 ? "Yarın" : t.toLocaleDateString(dil, fark < 7 ? { weekday: "long" } : { day: "numeric", month: "long" });
  return `Sıradaki yayın: ${ne} ${saat}${y.baslik ? ` · ${y.baslik}` : ""}`;
}

/** Hatırlatma zamanı gelen yayınlar: başlangıçtan 5 dk önce ile başlangıç arası, daha önce hatırlatılmamış */
export function hatirlatilacaklar(liste: PlanliYayin[], simdi: number, hatirlatilan: ReadonlySet<string>): PlanliYayin[] {
  return liste.filter((y) => {
    const fark = Date.parse(y.zaman) - simdi;
    return fark <= 5 * 60_000 && fark > -60_000 && !hatirlatilan.has(y.id);
  });
}
