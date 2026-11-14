import { describe, expect, it } from "vitest";
import type { ReklamTakvimi } from "./platformAuth/twitchWrite";
import { BOS_REKLAM, reklamAdimi, type ReklamDurumu } from "./twitchReklam";

const t = (o: Partial<ReklamTakvimi>): ReklamTakvimi => ({ sonrakiReklam: 0, sure: 90, ertelemeHakki: 3, ertelemeYenilenme: 0, sonReklam: 500, prerollSuresi: 0, ...o });

describe("Twitch reklam olayları (Y7)", () => {
  it("60 sn kala bir kez duyurur, başlar ve süre dolunca biter", () => {
    let d: ReklamDurumu = BOS_REKLAM;
    const olaylar: string[] = [];
    const adim = (takvim: ReklamTakvimi, sn: number) => {
      const r = reklamAdimi(d, takvim, sn);
      d = r.durum;
      olaylar.push(...r.olaylar.map((o) => `${sn}:${o}`));
    };
    adim(t({ sonrakiReklam: 1100 }), 1000); // 100 sn var: erken
    adim(t({ sonrakiReklam: 1100 }), 1045); // 55 sn: duyuru
    adim(t({ sonrakiReklam: 1100 }), 1060); // aynı reklam: tekrar yok
    adim(t({ sonrakiReklam: 2900, sonReklam: 1100 }), 1105); // reklam başladı (90 sn)
    adim(t({ sonrakiReklam: 2900, sonReklam: 1100 }), 1150);
    adim(t({ sonrakiReklam: 2900, sonReklam: 1100 }), 1195); // bitti
    expect(olaylar).toEqual(["1045:reklam_yaklasiyor", "1105:reklam_basliyor", "1195:reklam_bitti"]);
  });

  it("ilk okumada geçmiş reklamı başlıyor saymaz, ertelenen reklamı yeniden duyurur", () => {
    expect(reklamAdimi(BOS_REKLAM, t({ sonReklam: 900 }), 1000).olaylar).toEqual([]);
    const ilk = reklamAdimi(BOS_REKLAM, t({ sonrakiReklam: 1030 }), 1000);
    expect(ilk.olaylar).toEqual(["reklam_yaklasiyor"]);
    // Ertele: sonraki reklam 5 dk kayar, 60 sn kala yeniden duyurulur
    expect(reklamAdimi(ilk.durum, t({ sonrakiReklam: 1330 }), 1010).olaylar).toEqual([]);
    expect(reklamAdimi(ilk.durum, t({ sonrakiReklam: 1330 }), 1280).olaylar).toEqual(["reklam_yaklasiyor"]);
  });
});
