import { describe, expect, it } from "vitest";
import { ANA_MENU, BOT_SEKMELERI, OVERLAY_PENCERESI, TUM_AYARLAR, botSekmesiBul, menuGrubuBul, satirGorunur, satirHedefi, sayfaAcikMi } from "./anaMenu";
import { DEFAULT_TABS } from "./panelLayout";
import { bosGecmis, gecmiseEkle, gecmisteGit } from "./gezinmeGecmisi";

/** Botun App.tsx'teki bütün sayfaları (yeni sayfa eklenince buraya da eklenir) */
const BOT_SAYFALARI = "kurulum dashboard platforms multichat trivia tts donations shield commands timers automod botadvanced interaction integrations extras rankings alerts polls pano sesli otomasyon songrequest economy games giveaways overlays ai settings".split(" ");

describe("ana menü (A2)", () => {
  it("yedi başlık, plan sırasıyla; Ctrl+1..7 bu sırayı kullanır", () => {
    expect(ANA_MENU.map((g) => g.id)).toEqual(["hazirlik", "canli", "sahne", "etkilesim", "bot", "sonrasi", "ayarlar"]);
  });

  it("her sekme menüde bir satırla açılır", () => {
    const gorunen = new Set(DEFAULT_TABS.map((t) => t.id as string));
    for (const t of DEFAULT_TABS) {
      expect(ANA_MENU.some((g) => g.sayfalar.some((s) => satirGorunur(s, gorunen) && sayfaAcikMi(s, t.id)))).toBe(true);
    }
  });

  it("Sahne: Giriş, Mola ve Çıkış tek Ekranlar satırında; eski adresler bu satırı seçer", () => {
    const sahne = ANA_MENU.find((g) => g.id === "sahne")!;
    expect(sahne.sayfalar.map((s) => s.adAnahtari ?? s.nav)).toEqual(["nav.ekranlar", "yayin", "nav.overlaylar", "music", "sounds"]);
    const ekranlar = sahne.sayfalar[0];
    for (const eski of ["starting", "brb", "ending"]) {
      expect(menuGrubuBul(eski)).toBe("sahne");
      expect(sayfaAcikMi(ekranlar, eski)).toBe(true);
    }
    // Satıra basınca son açık ekran; o gizliyse ilk görünen
    expect(satirHedefi(ekranlar, new Set(["starting", "brb", "ending"]), "brb")).toEqual({ nav: "brb" });
    expect(satirHedefi(ekranlar, new Set(["ending"]), "brb")).toEqual({ nav: "ending" });
    expect(satirGorunur(ekranlar, new Set(["ending"]))).toBe(true);
    expect(satirGorunur(ekranlar, new Set(["chat"]))).toBe(false);
  });

  it("Tüm ayarlar kalktı: botun her sayfası bir başlıkta ya da kendi bot sekmesinde", () => {
    for (const sayfa of BOT_SAYFALARI) {
      const grup = menuGrubuBul("bot", sayfa);
      if (grup === "bot") expect(BOT_SEKMELERI.find((s) => s.alt.includes(sayfa)), sayfa).toBeTruthy();
    }
    expect(menuGrubuBul("bot", "platforms")).toBe("hazirlik");
    expect(menuGrubuBul("bot", "songrequest")).toBe("etkilesim");
    expect(botSekmesiBul("otomasyon")).toBe("otomasyon");
    expect(botSekmesiBul("ai")).toBe("commands");
    expect(botSekmesiBul("bilinmeyen")).toBe("commands");
    expect(botSekmesiBul(TUM_AYARLAR)).toBe(TUM_AYARLAR);
    expect(menuGrubuBul("bot", TUM_AYARLAR)).toBe("bot");
    expect(BOT_SEKMELERI.map((s) => s.ad)).toEqual(["Komutlar", "Oyunlar", "Puanlar", "Moderasyon", "Otomasyon", "Genel"]);
  });

  it("Yayın sonrası: Rapor, Canlı ekranının yayın sonrası kipidir", () => {
    const rapor = ANA_MENU.find((g) => g.id === "sonrasi")!.sayfalar[0];
    expect(rapor).toMatchObject({ nav: "control", kip: "sonrasi" });
    expect(menuGrubuBul("control", undefined, "sonrasi")).toBe("sonrasi");
    expect(menuGrubuBul("control", undefined, "canli")).toBe("canli");
    expect(sayfaAcikMi(rapor, "control", undefined, "sonrasi")).toBe(true);
    expect(sayfaAcikMi({ nav: "control" }, "control", undefined, "sonrasi")).toBe(false);
    // Faz 7 menüsü: bölüm satırları raporu açar, seçili görünen Rapor'dur
    const sonrasi = ANA_MENU.find((g) => g.id === "sonrasi")!.sayfalar;
    expect(sonrasi.map((x) => x.bolum ?? null)).toEqual([null, "isaretler", "sarkilar", "karsilastirma"]);
    expect(sayfaAcikMi(sonrasi[1], "control", undefined, "sonrasi")).toBe(false);
    expect(menuGrubuBul("control", undefined, "sonrasi")).toBe("sonrasi");
  });

  it("A2b: Yayın bilgisi Hazırlık'ta kendi sayfası, Ödüller Etkileşim'de", () => {
    expect(menuGrubuBul("yayinBilgisi")).toBe("hazirlik");
    expect(menuGrubuBul("control", undefined, "oncesi")).toBe("canli");
    expect(menuGrubuBul("bot", "oduller")).toBe("etkilesim");
  });

  it("bot sayfası kendi başlığını bulur", () => {
    expect(menuGrubuBul("bot", "giveaways")).toBe("etkilesim");
    expect(menuGrubuBul("bot", "alerts")).toBe("sahne");
    expect(menuGrubuBul("bot", "commands")).toBe("bot");
    expect(menuGrubuBul("bot")).toBe("bot");
    expect(menuGrubuBul("chat")).toBe("canli");
    expect(menuGrubuBul("hotkeys")).toBe("ayarlar");
  });

  it("Overlay ve Uyarılar penceresinde dört sayfa; aynı gruptaki alt sayfada satır seçili kalır", () => {
    expect(OVERLAY_PENCERESI.map((s) => s.id)).toEqual(["overlays", "alerts", "pano", "tts"]);
    const overlay = { nav: "bot" as const, botSayfa: "overlays" };
    expect(sayfaAcikMi(overlay, "bot", "alerts")).toBe(true);
    expect(sayfaAcikMi(overlay, "bot", "commands")).toBe(false);
  });

  it("Etkileşimde beş sayfa, yalnız açık olan seçili", () => {
    const grup = ANA_MENU.find((g) => g.id === "etkilesim")!;
    expect(grup.sayfalar.map((s) => s.botSayfa)).toEqual(["polls", "giveaways", "interaction", "songrequest", "oduller"]);
    expect(sayfaAcikMi(grup.sayfalar[1], "bot", "giveaways")).toBe(true);
    expect(sayfaAcikMi(grup.sayfalar[0], "bot", "giveaways")).toBe(false);
  });
});

describe("gezinme geçmişi (Alt+← / Alt+→)", () => {
  const ayni = (a: string, b: string) => a === b;
  it("geri, ileri; geri gidip yeni sayfa açınca ileri kısmı silinir; aynı sayfa üst üste eklenmez", () => {
    let g = bosGecmis<string>();
    for (const s of ["a", "b", "b", "c"]) g = gecmiseEkle(g, s, ayni);
    expect(g.liste).toEqual(["a", "b", "c"]);
    const geri = gecmisteGit(g, -1)!;
    expect(geri.sayfa).toBe("b");
    expect(gecmisteGit(geri.gecmis, 1)!.sayfa).toBe("c");
    g = gecmiseEkle(geri.gecmis, "d", ayni);
    expect(g.liste).toEqual(["a", "b", "d"]);
    expect(gecmisteGit(g, 1)).toBeNull();
    expect(gecmisteGit(bosGecmis<string>(), -1)).toBeNull();
  });
});
