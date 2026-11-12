/**
 * Ctrl+K komut paleti: sayfalar, sahneler, eylem kayıt defterindeki parametresiz eylemler ve uygulamadaki tüm ayarlar tek aramada.
 * Eylemler `actionsApi` üzerinden çalışır: izin, onay ve denetim günlüğü sunucuda aynen uygulanır.
 * Onay isteyen eylem (yayını başlat/bitir gibi) yanlışlıkla çalışmasın diye ikinci Enter ister.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { actionsApi } from "../../lib/api/actions";
import { fetchPlayerStatus, sendPlayerCommand } from "../../lib/api";
import { ANA_MENU, EKRANLAR, ekranMi, type MenuSayfasi } from "../../lib/anaMenu";
import { komutAra, type Komut } from "../../lib/komutPaleti";
import { obsControl } from "../../lib/obsControl";
import SohbetTemizleDiyalogu from "./SohbetTemizleDiyalogu";
import AYAR_DIZINI from "../../lib/ayarDizini.json";
import { botAyariIste } from "../../lib/embedMessages";
import type { NavId } from "../../lib/panelLayout";

/** `scripts/ayar-dizini.mjs` üretir: s sayfa, b bot sekmesi, t ayarın bulunduğu sekme, a ayarın adı */
type AyarKaydi = { s: string; a: string; b?: string; t?: string; g?: string };

const AYAR_SECICI = 'label, legend, h2, h3, h4, summary, p.uppercase, div.uppercase > span, [role="tab"], [role="group"][aria-label]';
const ayarAdi = (el: Element) => {
  if (el.matches('[role="group"][aria-label]')) return el.getAttribute("aria-label") || "";
  const k = el.cloneNode(true) as Element;
  k.querySelectorAll('select, option, input, textarea, button, svg, [aria-hidden="true"], .sr-only').forEach((x) => x.remove());
  return (k.textContent || "").replace(/\s+/g, " ").trim();
};

/** Sayfa açıldıktan sonra ayarı bulur (gerekirse sekmesini açar), görünür yere kaydırır ve kısa süre vurgular */
function ayaraGit(ad: string, sekme?: string, deneme = 0) {
  const kok = document.querySelector(".panel-shell") || document.body;
  const bul = (metin: string) => [...kok.querySelectorAll(AYAR_SECICI)].find((el) => !el.closest(".studio-nav-rail") && ayarAdi(el) === metin) as HTMLElement | undefined;
  if (sekme && deneme === 0) bul(sekme)?.click();
  const el = bul(ad);
  if (!el) {
    if (deneme < 12) window.setTimeout(() => ayaraGit(ad, sekme, deneme + 1), 150);
    return;
  }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("studio-ayar-vurgu");
  window.setTimeout(() => el.classList.remove("studio-ayar-vurgu"), 1800);
}

/** Gömülü bot çerçevesinden gelen Ctrl+K bu olayla ulaşır */
export const PALET_AC_OLAYI = "studio:komut-paleti";

type Props = {
  visibleTabs: string[];
  labelFor: (s: MenuSayfasi) => string;
  onSayfa: (s: MenuSayfasi) => void;
  onToast: (m: string) => void;
  /** Kısayol yakalanırken (tuş atama) palet açılmaz */
  kapali: () => boolean;
};

export default function KomutPaleti({ visibleTabs, labelFor, onSayfa, onToast, kapali }: Props) {
  const [acik, setAcik] = useState(false);
  const [sorgu, setSorgu] = useState("");
  const [secili, setSecili] = useState(0);
  const [onayli, setOnayli] = useState<string | null>(null);
  const [uzak, setUzak] = useState<Komut[]>([]);
  const [yuklenemedi, setYuklenemedi] = useState(false);
  const [temizleAcik, setTemizleAcik] = useState(false);
  const girdi = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const oncekiOdak = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ac = () => {
      if (kapali()) return;
      setAcik((a) => {
        if (!a) oncekiOdak.current = document.activeElement as HTMLElement | null;
        return !a;
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      ac();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALET_AC_OLAYI, ac);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALET_AC_OLAYI, ac);
    };
  }, [kapali]);

  useEffect(() => {
    if (!acik) return;
    setSorgu("");
    setSecili(0);
    setOnayli(null);
    setYuklenemedi(false);
    girdi.current?.focus();
    let iptal = false;
    void (async () => {
      const [eylemler, sahneler] = await Promise.allSettled([actionsApi.list(), obsControl.scenes()]);
      if (iptal) return;
      if (eylemler.status === "rejected") setYuklenemedi(true);
      const tum = eylemler.status === "fulfilled" ? eylemler.value : [];
      const sahneEylemi = tum.find((a) => a.id === "scene.switch");
      const sahneKomutlari: Komut[] =
        sahneler.status === "fulfilled" && sahneEylemi
          ? sahneler.value.scenes.map((ad) => ({
              id: `sahne:${ad}`,
              ad: `${ad} sahnesine geç`,
              grup: "Sahne",
              anahtar: "sahne",
              onay: sahneEylemi.confirm,
              engel: sahneEylemi.available ? null : sahneEylemi.reason,
              calistir: () => actionsApi.run("scene.switch", { scene: ad }, sahneEylemi.confirm),
            }))
          : [];
      const eylemKomutlari: Komut[] = tum
        .filter((a) => a.params.length === 0)
        .map((a) => ({
          id: `eylem:${a.id}`,
          ad: a.label,
          grup: "Eylem",
          onay: a.confirm,
          engel: a.available ? null : a.reason || "Şu an kullanılamıyor",
          calistir: () => actionsApi.run(a.id, {}, a.confirm),
        }));
      setUzak([...sahneKomutlari, ...eylemKomutlari]);
    })();
    return () => {
      iptal = true;
    };
  }, [acik]);

  const komutlar = useMemo<Komut[]>(() => {
    const gorunur = new Set(visibleTabs);
    // Ekranlar satırı paletde üç ayrı sayfa olarak aranır (Giriş, Mola, Çıkış)
    const sayfalar: Komut[] = ANA_MENU.flatMap((g) => g.sayfalar)
      .flatMap((s): MenuSayfasi[] => (ekranMi(s.nav) ? EKRANLAR.map((e) => ({ nav: e.id, adAnahtari: e.adAnahtari })) : [s]))
      .filter((s) => gorunur.has(s.nav))
      .map((s) => ({ id: `sayfa:${s.nav}:${s.botSayfa || ""}:${s.kip || ""}`, ad: labelFor(s), grup: "Sayfa", calistir: () => onSayfa(s) }));
    const hazir: Komut[] = [
      { id: "cekilis", ad: "Çekiliş başlat", grup: "Bot", calistir: () => onSayfa({ nav: "bot", botSayfa: "giveaways" }) },
      { id: "anket", ad: "Anket aç", grup: "Bot", calistir: () => onSayfa({ nav: "bot", botSayfa: "polls" }) },
      { id: "temizle", ad: "Sohbeti temizle", grup: "Sohbet", calistir: () => setTemizleAcik(true) },
      {
        id: "sonraki",
        ad: "Sonraki şarkı",
        grup: "Resonance",
        anahtar: "müzik parça spotify youtube",
        calistir: async () => {
          const st = await fetchPlayerStatus();
          await sendPlayerCommand("next", st.nowPlaying?.source || st.source);
        },
      },
    ];
    const ayarlar: Komut[] = (AYAR_DIZINI as AyarKaydi[])
      .filter((k) => gorunur.has(k.s))
      .map((k) => {
        const sayfa: MenuSayfasi = { nav: k.s as NavId, botSayfa: k.b };
        return {
          id: `ayar:${k.s}:${k.b || ""}:${k.t || ""}:${k.a}`,
          ad: k.a,
          // Aynı ad Giriş/Çıkış/Mola gibi birkaç sayfada geçer: hangisi olduğu yanda yazar
          grup: k.g || `Ayar · ${labelFor(sayfa)}`,
          anahtar: `${labelFor(sayfa)} ${k.b || ""} ${k.t || ""} ${k.g ? "widget overlay katman" : ""}`,
          calistir: () => {
            onSayfa(sayfa);
            // Bot sayfaları çerçevede açılır: kaydırmayı bot yapar, istek AxBotHost üzerinden gider (ayara-git)
            if (k.s === "bot") botAyariIste(k.a, k.t);
            else window.setTimeout(() => ayaraGit(k.a, k.t), 200);
          },
        };
      });
    // Ayarlar en sonda: sayfa ve eylem adları aramada önce gelsin
    return [...hazir, ...uzak, ...sayfalar, ...ayarlar];
  }, [visibleTabs, labelFor, onSayfa, uzak]);

  const sonuc = useMemo(() => komutAra(komutlar, sorgu).slice(0, 50), [komutlar, sorgu]);
  const aktif = sonuc[Math.min(secili, sonuc.length - 1)];

  useEffect(() => {
    liste.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [secili, sonuc]);

  const kapat = () => {
    setAcik(false);
    oncekiOdak.current?.focus?.();
  };

  const calistir = (k: Komut | undefined) => {
    if (!k) return;
    if (k.engel) return onToast(k.engel);
    if (k.onay && onayli !== k.id) return setOnayli(k.id);
    kapat();
    Promise.resolve()
      .then(k.calistir)
      .catch((e) => onToast(`${k.ad}: ${String((e as Error).message || e).slice(0, 160)}`));
  };

  const tus = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!sonuc.length) return;
      const adim = e.key === "ArrowDown" ? 1 : -1;
      setSecili((s) => (Math.min(s, sonuc.length - 1) + adim + sonuc.length) % sonuc.length);
      setOnayli(null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      calistir(aktif);
    } else if (e.key === "Escape") {
      e.preventDefault();
      kapat();
    }
  };

  return (
    <>
      {acik ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) kapat();
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="Komut paleti" className="flex max-h-[60vh] w-full max-w-xl flex-col overflow-hidden rounded-md border border-white/15 bg-panel-elevated shadow-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b border-panel-border px-3">
              <Search aria-hidden className="h-4 w-4 shrink-0 text-panel-muted" />
              <input
                ref={girdi}
                value={sorgu}
                onChange={(e) => {
                  setSorgu(e.target.value);
                  setSecili(0);
                  setOnayli(null);
                }}
                onKeyDown={tus}
                role="combobox"
                aria-expanded
                aria-controls="komut-listesi"
                aria-activedescendant={aktif ? `komut-${sonuc.indexOf(aktif)}` : undefined}
                aria-label="Komut ara"
                placeholder="Komut, ayar, sahne ya da sayfa ara…"
                className="h-11 min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-panel-muted"
              />
              <kbd className="shrink-0 rounded border border-panel-border px-1.5 py-0.5 font-mono text-[11px] text-panel-muted">Esc</kbd>
            </div>
            <div ref={liste} id="komut-listesi" role="listbox" aria-label="Komutlar" className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-1">
              {sonuc.length === 0 ? <p className="px-3 py-6 text-center text-[13px] text-panel-muted">Eşleşen komut yok.</p> : null}
              {sonuc.map((k, i) => {
                const secilen = k === aktif;
                return (
                  <button
                    key={k.id}
                    id={`komut-${i}`}
                    type="button"
                    role="option"
                    aria-selected={secilen}
                    tabIndex={-1}
                    onMouseMove={() => {
                      if (i !== secili) {
                        setSecili(i);
                        setOnayli(null);
                      }
                    }}
                    onClick={() => calistir(k)}
                    className={`flex h-9 w-full items-center gap-3 rounded px-2.5 text-left text-[13px] transition-transform active:scale-[0.98] motion-reduce:active:scale-100 ${secilen ? "bg-[var(--dt-surface-3)] text-white" : "text-white/85"} ${k.engel ? "opacity-50" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{k.ad}</span>
                    {onayli === k.id ? (
                      <span className="shrink-0 text-xs font-semibold text-red-400">Emin misin? Tekrar Enter</span>
                    ) : (
                      <span className="shrink-0 text-[11px] text-panel-muted">{k.engel ? "Kullanılamıyor" : k.grup}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {yuklenemedi ? <p className="shrink-0 border-t border-panel-border px-3 py-1.5 text-xs text-panel-muted">Eylemler yüklenemedi; sayfalar kullanılabilir.</p> : null}
          </div>
        </div>
      ) : null}
      <SohbetTemizleDiyalogu open={temizleAcik} onClose={() => setTemizleAcik(false)} onDone={onToast} />
    </>
  );
}
