import { describe, expect, it } from "vitest";
import {
  ALTYAZISIZ_PLAYER_VARS,
  altyaziKapat,
  DEFAULT_END_MARGIN,
  extractYoutubeId,
  youtubeLoopPoint,
} from "./youtube";

describe("altyaziKapat", () => {
  it("altyazı izini boşaltır ve modülü kaldırır", () => {
    const cagrilar: string[] = [];
    const oynatici = {
      setOption: (m: string, k: string, v: unknown) => cagrilar.push(`set ${m} ${k} ${JSON.stringify(v)}`),
      unloadModule: (m: string) => cagrilar.push(`unload ${m}`),
    };
    altyaziKapat(oynatici);
    expect(cagrilar).toEqual([
      'set captions track {}',
      "unload captions",
      'set cc track {}',
      "unload cc",
    ]);
  });

  it("eksik ya da hata atan oynatıcıda patlamaz", () => {
    expect(() => altyaziKapat(null)).not.toThrow();
    expect(() => altyaziKapat({})).not.toThrow();
    expect(() =>
      altyaziKapat({
        setOption: () => {
          throw new Error("yok");
        },
        unloadModule: () => {
          throw new Error("yok");
        },
      }),
    ).not.toThrow();
  });

  it("oynatıcı ayarı altyazıyı yüklemez", () => {
    expect(ALTYAZISIZ_PLAYER_VARS.cc_load_policy).toBe(0);
  });
});

describe("extractYoutubeId", () => {
  it("watch, kısa bağlantı, embed ve shorts adreslerini çözer", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=2kK7QCgM_PE&t=4s")).toBe("2kK7QCgM_PE");
    expect(extractYoutubeId("https://youtu.be/2kK7QCgM_PE")).toBe("2kK7QCgM_PE");
    expect(extractYoutubeId("https://www.youtube.com/embed/2kK7QCgM_PE")).toBe("2kK7QCgM_PE");
    expect(extractYoutubeId("https://www.youtube.com/shorts/2kK7QCgM_PE")).toBe("2kK7QCgM_PE");
    expect(extractYoutubeId("2kK7QCgM_PE")).toBe("2kK7QCgM_PE");
  });

  it("kimlik yoksa null döner", () => {
    expect(extractYoutubeId("")).toBeNull();
    expect(extractYoutubeId("https://example.com/video")).toBeNull();
  });
});

describe("youtubeLoopPoint", () => {
  const DUR = 162;

  it("ayarlanmamış pay (null/0) varsayılana düşer", () => {
    // Regresyon: Number(null) === 0 olduğu için pay 0.5 sn'ye düşüyordu ve
    // video bitiş kartlarının çıktığı saniyeye kadar oynuyordu.
    const beklenen = DUR - DEFAULT_END_MARGIN;
    expect(youtubeLoopPoint(DUR, 0, 0, null as unknown as number)).toBe(beklenen);
    expect(youtubeLoopPoint(DUR, 0, 0, 0)).toBe(beklenen);
    expect(youtubeLoopPoint(DUR, 0, 0, undefined as unknown as number)).toBe(beklenen);
  });

  it("negatif pay = koruma kapalı: video neredeyse sonuna kadar oynar", () => {
    // ENDED durumunda YouTube tam ekran öneri ızgarası bastığı için son
    // ~1 sn yine atlanıyor.
    expect(youtubeLoopPoint(DUR, 0, 0, -1)).toBeCloseTo(DUR - 1.15, 5);
    expect(youtubeLoopPoint(DUR, 0, 161, -1)).toBeCloseTo(DUR - 1.15, 5);
  });

  it("kırpma bitişi videonun sonundaysa güvenli sınıra çekilir", () => {
    // youtubeEnd, süre okunduğunda otomatik olarak videonun sonuna yazılıyor;
    // o değere birebir uyulursa döngü tam kartların üstünde oluyordu.
    expect(youtubeLoopPoint(DUR, 0, 161, 3)).toBe(159);
    expect(youtubeLoopPoint(DUR, 0, 161, 8)).toBe(154);
    expect(youtubeLoopPoint(DUR, 0, 161, null as unknown as number)).toBe(
      DUR - DEFAULT_END_MARGIN
    );
  });

  it("güvenli sınırdan önceki kırpma bitişine dokunmaz", () => {
    expect(youtubeLoopPoint(DUR, 10, 60, 3)).toBe(60);
  });

  it("geç bir kırpma başlangıcı korumayı kapatmaz", () => {
    // Regresyon: "döngü noktası başlangıçtan büyük olmalı" koşulu yüzünden
    // başlangıç 150'ye alınınca koruma sessizce devre dışı kalıyor, video
    // sonuna kadar oynayıp kartları gösteriyordu.
    expect(youtubeLoopPoint(DUR, 150, 0, 20)).toBe(DUR - 20);
  });

  it("kısa videolarda yalnız ENDED ızgarasından kaçınır", () => {
    // 25 sn'den kısa videolara YouTube bitiş ekranı eklenemiyor; 20 sn pay
    // uygulanırsa böyle bir video neredeyse hiç oynamazdı.
    expect(youtubeLoopPoint(20, 0, 0, 20)).toBeCloseTo(20 - 1.15, 5);
    expect(youtubeLoopPoint(3, 0, 0, 3)).toBeCloseTo(3 - 1.15, 5);
    expect(youtubeLoopPoint(2, 0, 0, 3)).toBe(0);
  });

  it("pay videodan uzunsa oynayacak yer bırakır", () => {
    expect(youtubeLoopPoint(30, 0, 0, 45)).toBe(1);
  });

  describe("bitiş ekranı bilgisi geldiğinde", () => {
    it("kartı olmayan video hiç kısalmaz", () => {
      // Asıl kazanç bu: eskiden kartı olmayan videolardan da körlemesine
      // 20 sn kesiliyordu.
      const bilgi = { startSec: null, unknown: false };
      expect(youtubeLoopPoint(DUR, 0, 0, DEFAULT_END_MARGIN, bilgi)).toBeCloseTo(DUR - 1.15, 5);
    });

    it("kartı olan video tam perdenin açıldığı saniyede döner", () => {
      const bilgi = { startSec: 151.45, unknown: false };
      expect(youtubeLoopPoint(DUR, 0, 0, DEFAULT_END_MARGIN, bilgi)).toBeCloseTo(151.45, 5);
    });

    it("perde çok geç açılsa bile ENDED ızgarasına girilmez", () => {
      const bilgi = { startSec: DUR - 0.2, unknown: false };
      expect(youtubeLoopPoint(DUR, 0, 0, DEFAULT_END_MARGIN, bilgi)).toBeCloseTo(DUR - 1.15, 5);
    });

    it("kullanıcının kırpma bitişi daha erkense ona uyulur", () => {
      const bilgi = { startSec: 151.45, unknown: false };
      expect(youtubeLoopPoint(DUR, 0, 60, DEFAULT_END_MARGIN, bilgi)).toBe(60);
    });

    it("bilgi alınamadıysa kör paya düşer", () => {
      const bilgi = { startSec: null, unknown: true };
      expect(youtubeLoopPoint(DUR, 0, 0, DEFAULT_END_MARGIN, bilgi)).toBe(DUR - DEFAULT_END_MARGIN);
    });
  });
});
