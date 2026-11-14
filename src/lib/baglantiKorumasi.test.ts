import { describe, expect, it } from "vitest";
import { BOS_DURUM, korumaAdimi, korumaAyari, type KorumaDurumu, type Ornek } from "./baglantiKorumasi";

const ayar = korumaAyari({ acik: true, sahne: "Mola", esikKbps: 2000, kareEsigi: 5 });
const iyi: Ornek = { aktif: true, yenidenBaglaniyor: false, kbps: 6000, yogunluk: 0, kareOrani: 0, sahne: "Oyun" };

/** Sahte OBS: örnekleri 3 sn arayla verir, geçilen sahneyi bir sonraki örneğe yansıtır */
function oynat(ornekler: Partial<Ornek>[]) {
  let d: KorumaDurumu = BOS_DURUM;
  let sahne = "Oyun";
  const olaylar: string[] = [];
  ornekler.forEach((o, i) => {
    const r = korumaAdimi(d, { ...iyi, sahne, ...o }, ayar, i * 3000);
    d = r.durum;
    for (const a of r.adimlar) {
      olaylar.push(a.tur === "kare" ? `kare ${a.oran}` : `${a.tur} ${a.sahne ?? "-"}`);
      if (a.tur !== "kare" && a.sahne) sahne = a.sahne;
    }
  });
  return { olaylar, sahne };
}

describe("bağlantı koruması (Y12)", () => {
  it("bit hızı düşünce Mola'ya geçer, düzelince döner", () => {
    const dusuk = { kbps: 800 };
    // Molada bit hızı düşük kalsa da ağ sakinse dönülür (durağan sahne)
    const r = oynat([{}, dusuk, dusuk, dusuk, dusuk, dusuk, dusuk, dusuk, dusuk, dusuk]);
    expect(r.olaylar).toEqual(["dustu Mola", "duzeldi Oyun"]);
    expect(r.sahne).toBe("Oyun");
  });

  it("kısa dalgalanmada geçmez, yeniden bağlanırken geçer ve sürerken dönmez", () => {
    expect(oynat([{ kbps: 800 }, {}, { kbps: 800 }, {}]).olaylar).toEqual([]);
    const kopuk = { yenidenBaglaniyor: true, kbps: null };
    expect(oynat([kopuk, kopuk, kopuk, kopuk, kopuk, kopuk, kopuk]).olaylar).toEqual(["dustu Mola"]);
  });

  it("korumadayken yayıncı sahne değiştirirse geri dönmez", () => {
    let d: KorumaDurumu = BOS_DURUM;
    for (const [i, o] of [{ kbps: 500 }, { kbps: 500 }, { kbps: 500 }].entries()) d = korumaAdimi(d, { ...iyi, ...o }, ayar, i * 3000).durum;
    expect(d.korumada).toBe(true);
    const r = korumaAdimi(d, { ...iyi, sahne: "Sohbet" }, ayar, 9000);
    expect(r.durum.korumada).toBe(false);
    expect(r.adimlar).toEqual([]);
  });

  it("kare düşüşü eşiği bir kez bildirilir, kapalıyken hiçbir şey yapmaz", () => {
    expect(oynat([{ kareOrani: 7.25 }, { kareOrani: 8 }, { kareOrani: 1 }, { kareOrani: 6 }]).olaylar).toEqual(["kare 7.3", "kare 6"]);
    expect(korumaAdimi(BOS_DURUM, { ...iyi, kbps: 1 }, korumaAyari({ acik: false }), 99_999).adimlar).toEqual([]);
  });
});
