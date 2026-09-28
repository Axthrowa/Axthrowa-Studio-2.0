/**
 * Yayın ayarları penceresi (OBS "Settings" karşılığı; etkin profile yazılır). Aranabilir bölümler: Video, Çıkış
 * (Basit / Gelişmiş / Uzman — Uzman'da kodlayıcının kendi özellik formu), Kayıt (biçim, izler, klasör), Tekrar
 * arabelleği, Ses (adlandırılmış karışımlar, izleme aygıtı), Çoklu Yayın (platform başına kart: sunucu, anahtar
 * göster/kopyala/değiştir/sil, tuval, ses izi, bit hızı, bağlantı sınaması), Kısayollar.
 *
 * Güvenlik: anahtar yalnız "Göster"e basınca bu bilgisayardan okunur, 20 sn sonra gizlenir ve hiçbir kalıcı duruma
 * yazılmaz; "Kopyala" panoyu 30 sn sonra (hâlâ aynı değerse) temizler. Uzman kipte ayar sessizce değiştirilmez.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motorApi, obsWebsocketApi, type MotorProfil, type MotorProfilYaniti, type MotorSesDurumu, type ObsWebsocketDurumu } from "../../lib/api/motor";
import { multistreamApi, type Destination, type MultistreamStatus, type Platform } from "../../lib/api/multistream";
import { OzellikGovdesi } from "./OzellikFormu";
import { hataMetni, Pencere } from "./ortak";

type Bolum = "video" | "cikis" | "kayit" | "tekrar" | "ses" | "coklu" | "gelismis" | "uzak" | "kisayol";

const BOLUMLER: { id: Bolum; ad: string; anahtarlar: string }[] = [
  { id: "video", ad: "Video", anahtarlar: "kare hızı fps çözünürlük tuval taban çıkış ölçekli ölçek filtresi lanczos bicubic dikey yatay" },
  { id: "cikis", ad: "Çıkış", anahtarlar: "kodlayıcı encoder nvenc x264 bit hızı bitrate anahtar kare keyframe ses bit hızı basit gelişmiş uzman kodlama paylaşımı" },
  { id: "kayit", ad: "Kayıt", anahtarlar: "kayıt biçim mkv mp4 hibrit parçalı mov iz klasör yol çok izli" },
  { id: "tekrar", ad: "Tekrar arabelleği", anahtarlar: "tekrar replay klip süre" },
  { id: "ses", ad: "Ses", anahtarlar: "iz adı karışım vod müziksiz temiz izleme aygıtı kulaklık monitoring örnekleme hızı khz kanal mono stereo 5.1" },
  { id: "coklu", ad: "Çoklu yayın", anahtarlar: "hedef platform twitch youtube kick rtmp sunucu anahtar stream key göster kopyala sına bağlantı bit hızı tuval iz" },
  { id: "gelismis", ad: "Gelişmiş", anahtarlar: "renk biçimi nv12 p010 i444 renk uzayı 709 601 srgb hdr 2100 aralık ağ bağlanılacak ip ipv4 ipv6 düşük gecikme dinamik bit hızı yeniden bağlan deneme" },
  { id: "uzak", ad: "Uzaktan denetim", anahtarlar: "obs-websocket websocket stream deck touch portal streamer.bot uzaktan denetim port parola" },
  { id: "kisayol", ad: "Kısayollar", anahtarlar: "kısayol hotkey tuş bas konuş push to talk" },
];

/** Uzaktan denetim: obs-websocket 5.x uyumlu sunucu. Parola yalnız "Göster"le bu bilgisayardan okunur, 20 sn sonra gizlenir. */
function UzaktanDenetim({ onToast }: { onToast: (m: string) => void }) {
  const [d, setD] = useState<ObsWebsocketDurumu | null>(null);
  const [parola, setParola] = useState<string | null>(null);
  const gizle = useRef<number | undefined>(undefined);
  const yukle = useCallback(() => obsWebsocketApi.durum().then(setD, (e) => onToast(`Uzaktan denetim: ${hataMetni(e)}`)), [onToast]);
  useEffect(() => {
    void yukle();
    return () => window.clearTimeout(gizle.current);
  }, [yukle]);
  const ayarla = async (g: Parameters<typeof obsWebsocketApi.ayarla>[0], basari?: string) => {
    try {
      await obsWebsocketApi.ayarla(g);
      if (basari) onToast(basari);
    } catch (e) {
      onToast(`Uzaktan denetim: ${hataMetni(e)}`);
    }
    void yukle();
  };
  const goster = async () => {
    try {
      setParola((await obsWebsocketApi.parola()).parola);
      window.clearTimeout(gizle.current);
      gizle.current = window.setTimeout(() => setParola(null), 20_000);
    } catch (e) {
      onToast(`Parola okunamadı: ${hataMetni(e)}`);
    }
  };
  const kopyala = async () => {
    try {
      const p = (await obsWebsocketApi.parola()).parola;
      await navigator.clipboard.writeText(p);
      onToast("Parola panoya kopyalandı; 30 sn sonra pano temizlenir");
      window.setTimeout(async () => {
        try {
          if ((await navigator.clipboard.readText()) === p) await navigator.clipboard.writeText("");
        } catch {
          /* pano okunamıyorsa dokunma */
        }
      }, 30_000);
    } catch (e) {
      onToast(`Kopyalanamadı: ${hataMetni(e)}`);
    }
  };
  if (!d) return <p className="p-3 text-[12px] dt-soluk">Okunuyor…</p>;
  return (
    <div className="dt-form">
      <span className="dt-etiket">Sunucu</span>
      <label className="inline-flex items-center gap-1.5">
        <input type="checkbox" checked={d.etkin} onChange={(e) => void ayarla({ etkin: e.target.checked }, e.target.checked ? "Uzaktan denetim açıldı" : "Uzaktan denetim kapatıldı")} />
        obs-websocket {d.surum} uyumlu sunucuyu aç
        <span className="dt-durum" data-ton={d.calisanPort ? "iyi" : undefined}>
          {d.calisanPort ? `dinleniyor: 127.0.0.1:${d.calisanPort}` : "kapalı"}
        </span>
      </label>
      <label htmlFor="ay-wsport">Port</label>
      <SayiAlani id="ay-wsport" deger={d.port} en_az={1024} en_cok={65535} onUygula={(v) => void ayarla({ port: v })} />
      <span className="dt-etiket">Parola</span>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <code className="dt-input w-48 select-all">{parola ?? (d.parolaVar ? "••••••••••••••••" : "(açınca üretilir)")}</code>
        <button type="button" className="dt-btn" disabled={!d.parolaVar && !d.etkin} onClick={() => void goster()}>
          Göster
        </button>
        <button type="button" className="dt-btn" disabled={!d.parolaVar && !d.etkin} onClick={() => void kopyala()}>
          Kopyala
        </button>
        <button type="button" className="dt-btn" onClick={() => void ayarla({ parola_yenile: true }, "Yeni parola üretildi; bağlı araçlarda güncelleyin")}>
          Yenile
        </button>
      </span>
      <span className="dt-etiket">Yayın denetimi</span>
      <label className="inline-flex items-center gap-1.5">
        <input type="checkbox" checked={d.yayinDenetimi} onChange={(e) => void ayarla({ yayin_denetimi: e.target.checked })} />
        Bağlı araçlar yayını başlatıp durdurabilsin (StartStream / StopStream)
      </label>
      <span />
      <span className="text-[11px] dt-soluk">
        Stream Deck, Touch Portal, Streamer.bot gibi araçlar bu uygulamayı OBS gibi denetler: sahneler, ses, sahne öğeleri, filtreler, Studio Mode, kayıt, tekrar, sanal kamera ({d.istekSayisi} istek).
        Yalnız bu bilgisayardan bağlanılır; parola Windows Kimlik Yöneticisi'nde saklanır. Varsayılan port 4456 — OBS Studio'nun kendi 4455 portuyla çakışmaz. Yayın denetimi izni kapalıyken yayını
        başlatma/durdurma istekleri reddedilir.
      </span>
    </div>
  );
}

const KARE_HIZLARI = [24, 25, 30, 48, 50, 60, 100, 120, 144];
const TABAN_HAZIR: [number, number][] = [
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
  [1280, 720],
];
const CIKIS_HAZIR: [number, number][] = [
  [1920, 1080],
  [1600, 900],
  [1280, 720],
  [1152, 648],
  [2560, 1440],
];
const DIKEY_HAZIR: [number, number][] = [
  [1080, 1920],
  [720, 1280],
];
const OLCEK_ADI: Record<string, string> = { bilinear: "Bilinear (en hızlı, bulanık)", bicubic: "Bicubic (keskin, 16 örnek)", lanczos: "Lanczos (keskin, 36 örnek)", area: "Alan (alt örnekleme)" };
const BICIM_ADI: Record<string, string> = { nv12: "NV12 (8 bit, 4:2:0)", i420: "I420 (8 bit, 4:2:0)", i444: "I444 (8 bit, 4:4:4)", p010: "P010 (10 bit, 4:2:0)", i010: "I010 (10 bit, 4:2:0)", bgra: "BGRA (8 bit)" };
const UZAY_ADI: Record<string, string> = { "601": "Rec. 601", "709": "Rec. 709", srgb: "sRGB", "2100pq": "Rec. 2100 (PQ)", "2100hlg": "Rec. 2100 (HLG)" };
const HOPARLOR_ADI: Record<string, string> = { mono: "Mono", stereo: "Stereo", "2.1": "2.1", "4.0": "4.0", "4.1": "4.1", "5.1": "5.1", "7.1": "7.1" };

/** Çözünürlük seçimi: hazır listesi + serbest genişlik × yükseklik (çift sayı, 16–7680) */
function BoyutAlani({ id, deger, hazir, onUygula }: { id: string; deger: [number, number]; hazir: [number, number][]; onUygula: (v: [number, number]) => void }) {
  const [g, setG] = useState(String(deger[0]));
  const [y, setY] = useState(String(deger[1]));
  useEffect(() => {
    setG(String(deger[0]));
    setY(String(deger[1]));
  }, [deger]);
  const liste = hazir.some(([a, b]) => a === deger[0] && b === deger[1]) ? hazir : [...hazir, deger];
  const uygula = () => {
    const [a, b] = [Math.round(Number(g)), Math.round(Number(y))];
    const gecerli = (n: number) => Number.isFinite(n) && n >= 16 && n <= 7680 && n % 2 === 0;
    if (gecerli(a) && gecerli(b)) {
      if (a !== deger[0] || b !== deger[1]) onUygula([a, b]);
    } else {
      setG(String(deger[0]));
      setY(String(deger[1]));
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select id={id} className="dt-input w-40" value={`${deger[0]}x${deger[1]}`} onChange={(e) => onUygula(e.target.value.split("x").map(Number) as [number, number])}>
        {liste.map(([a, b]) => (
          <option key={`${a}x${b}`} value={`${a}x${b}`}>
            {a}×{b}
          </option>
        ))}
      </select>
      <input className="dt-input dt-sayi w-20" aria-label="Genişlik" inputMode="numeric" value={g} onChange={(e) => setG(e.target.value)} onBlur={uygula} onKeyDown={(e) => e.key === "Enter" && uygula()} />
      <span className="dt-birim">×</span>
      <input className="dt-input dt-sayi w-20" aria-label="Yükseklik" inputMode="numeric" value={y} onChange={(e) => setY(e.target.value)} onBlur={uygula} onKeyDown={(e) => e.key === "Enter" && uygula()} />
      <span className="dt-birim">px (çift sayı)</span>
    </span>
  );
}

const PLATFORM_ADI: Record<Platform, string> = { twitch: "Twitch", youtube: "YouTube", kick: "Kick", custom: "Özel RTMP" };

/** Nötr platform simgesi: baş harf (marka logosu kullanılmaz) */
function PlatformSimgesi({ p }: { p: Platform }) {
  return (
    <span className="dt-platform-simge" aria-hidden>
      {PLATFORM_ADI[p].slice(0, 1)}
    </span>
  );
}

function SayiAlani({ id, deger, en_az, en_cok, birim, devreDisi, onUygula }: { id: string; deger: number; en_az: number; en_cok: number; birim?: string; devreDisi?: boolean; onUygula: (v: number) => void }) {
  const [m, setM] = useState(String(deger));
  useEffect(() => setM(String(deger)), [deger]);
  const uygula = () => {
    const v = Math.round(Number(m));
    if (Number.isFinite(v) && v >= en_az && v <= en_cok) {
      if (v !== deger) onUygula(v);
    } else setM(String(deger));
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <input id={id} className="dt-input dt-sayi w-24" inputMode="numeric" value={m} disabled={devreDisi} onChange={(e) => setM(e.target.value)} onBlur={uygula} onKeyDown={(e) => e.key === "Enter" && uygula()} />
      {birim && <span className="dt-birim">{birim}</span>}
      <span className="dt-birim">
        ({en_az}–{en_cok})
      </span>
    </span>
  );
}

// ─── Çoklu yayın kartı ─────────────────────────────────────────────────────

function HedefKarti({
  h,
  profil,
  sinirlar,
  onGuncelle,
  onToast,
  onDegisti,
}: {
  h: Destination;
  profil: MotorProfil;
  sinirlar: MultistreamStatus["sinirlar"];
  onGuncelle: (degisim: Record<string, unknown>) => void;
  onToast: (m: string) => void;
  onDegisti: () => void;
}) {
  const [gorunen, setGorunen] = useState<string | null>(null);
  const [yeniAnahtar, setYeniAnahtar] = useState<string | null>(null);
  const [sunucu, setSunucu] = useState(h.server);
  const [sinama, setSinama] = useState<string | null>(null);
  const gizle = useRef<number | undefined>(undefined);
  useEffect(() => setSunucu(h.server), [h.server]);
  useEffect(() => () => window.clearTimeout(gizle.current), []);
  const atama = profil.hedefler[h.id] ?? { tuval: "ana", iz: 0 };
  const tuvalBh = atama.tuval === "dikey" ? profil.cikis.bit_hizi_dikey : profil.cikis.bit_hizi_ana;
  const etkinBh = atama.bit_hizi ?? tuvalBh;
  // Yönlendiricide (FFmpeg) etkin mi — motor hedef durumu çalışma alanında ayrıca gösterilir
  const yayinda = ["connecting", "live", "warning", "reconnecting"].includes(String(h.state).toLowerCase());
  const kickAsim = h.platform === "kick" && sinirlar && etkinBh > sinirlar.kickMaxKbps;

  const yap = async (etiket: string, f: () => Promise<unknown>, basari?: string) => {
    try {
      await f();
      if (basari) onToast(basari);
      onDegisti();
    } catch (e) {
      onToast(`${etiket}: ${hataMetni(e)}`);
    }
  };
  const goster = async () => {
    try {
      const r = await multistreamApi.reveal(h.id);
      setGorunen(r.key);
      window.clearTimeout(gizle.current);
      gizle.current = window.setTimeout(() => setGorunen(null), 20_000);
    } catch (e) {
      onToast(`Anahtar gösterilemedi: ${hataMetni(e)}`);
    }
  };
  const kopyala = async () => {
    try {
      const { key } = await multistreamApi.reveal(h.id);
      await navigator.clipboard.writeText(key);
      onToast("Anahtar panoya kopyalandı; 30 sn sonra pano temizlenir");
      window.setTimeout(async () => {
        try {
          if ((await navigator.clipboard.readText()) === key) await navigator.clipboard.writeText("");
        } catch {
          /* pano okunamıyorsa dokunma */
        }
      }, 30_000);
    } catch (e) {
      onToast(`Kopyalanamadı: ${hataMetni(e)}`);
    }
  };
  const atamaYaz = (a: Partial<typeof atama>) => onGuncelle({ hedefler: { [h.id]: { ...atama, ...a } } });

  return (
    <div className="dt-hedef-karti" aria-label={`${PLATFORM_ADI[h.platform]} hedefi ${h.name}`}>
      <div className="flex items-center gap-2">
        <PlatformSimgesi p={h.platform} />
        <span className="font-semibold">{h.name}</span>
        <span className="dt-soluk text-[11px]">{PLATFORM_ADI[h.platform]}</span>
        <span className="dt-bosluk" />
        <span className="dt-durum" data-ton={yayinda ? "iyi" : h.hasKey ? undefined : "uyari"}>
          {yayinda ? "yayında (yönlendirici)" : h.hasKey ? "hazır" : "anahtar yok"}
        </span>
        <label className="inline-flex items-center gap-1.5 text-[12px]">
          <input type="checkbox" checked={h.enabled} onChange={(e) => void yap("Hedef", () => multistreamApi.upsert({ id: h.id, name: h.name, platform: h.platform, server: h.server, enabled: e.target.checked }))} />
          Etkin
        </label>
      </div>
      <div className="dt-form px-0">
        <label htmlFor={`hs-${h.id}`}>Sunucu</label>
        <input
          id={`hs-${h.id}`}
          className="dt-input"
          value={sunucu}
          onChange={(e) => setSunucu(e.target.value)}
          onBlur={() => sunucu.trim() !== h.server && void yap("Sunucu", () => multistreamApi.upsert({ id: h.id, name: h.name, platform: h.platform, server: sunucu.trim(), enabled: h.enabled }))}
        />
        <span className="dt-etiket">Yayın anahtarı</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="dt-kod dt-anahtar-alani" aria-live="polite">
            {gorunen ?? (h.hasKey ? "••••••••••••••••" : "kayıtlı değil")}
          </span>
          {h.hasKey && (
            <>
              <button type="button" className="dt-btn" onClick={() => (gorunen ? setGorunen(null) : void goster())} title="Yalnız bu bilgisayarda, 20 sn">
                {gorunen ? "Gizle" : "Göster"}
              </button>
              <button type="button" className="dt-btn" onClick={() => void kopyala()}>
                Kopyala
              </button>
            </>
          )}
          <button type="button" className="dt-btn" onClick={() => setYeniAnahtar("")}>
            {h.hasKey ? "Değiştir" : "Ekle"}
          </button>
          {h.hasKey && (
            <button type="button" className="dt-btn-danger" onClick={() => void yap("Anahtar silinemedi", () => multistreamApi.keyDelete(h.id), "Anahtar silindi")}>
              Sil
            </button>
          )}
        </span>
        {yeniAnahtar !== null && (
          <>
            <label htmlFor={`hk-${h.id}`}>Yeni anahtar</label>
            <span className="flex items-center gap-1.5">
              <input id={`hk-${h.id}`} type="password" autoComplete="off" className="dt-input min-w-0 flex-1" value={yeniAnahtar} onChange={(e) => setYeniAnahtar(e.target.value)} />
              <button
                type="button"
                className="dt-btn-primary"
                disabled={!yeniAnahtar.trim()}
                onClick={() => {
                  const k = yeniAnahtar;
                  setYeniAnahtar(null);
                  void yap("Anahtar kaydedilemedi", () => multistreamApi.upsert({ id: h.id, name: h.name, platform: h.platform, server: h.server, enabled: h.enabled, key: k }), "Anahtar Kimlik Yöneticisine yazıldı");
                }}
              >
                Kaydet
              </button>
              <button type="button" className="dt-btn" onClick={() => setYeniAnahtar(null)}>
                Vazgeç
              </button>
            </span>
          </>
        )}
        <span className="dt-etiket">Başvuru</span>
        <span className="dt-kod dt-soluk">{h.keyRef ?? "—"}</span>
        <label htmlFor={`ht-${h.id}`}>Tuval</label>
        <select id={`ht-${h.id}`} className="dt-input w-40" value={atama.tuval} onChange={(e) => atamaYaz({ tuval: e.target.value })}>
          <option value="ana">Yatay (1920×1080)</option>
          <option value="dikey">Dikey (1080×1920)</option>
        </select>
        <label htmlFor={`hi-${h.id}`}>Ses karışımı</label>
        <select id={`hi-${h.id}`} className="dt-input w-48" value={atama.iz} onChange={(e) => atamaYaz({ iz: Number(e.target.value) })}>
          {profil.iz_adlari.map((a, i) => (
            <option key={i} value={i}>
              İz {i + 1} · {a}
            </option>
          ))}
        </select>
        <label htmlFor={`hb-${h.id}`}>Bit hızı</label>
        <span className="flex flex-wrap items-center gap-1.5">
          <input
            id={`hb-${h.id}`}
            className="dt-input dt-sayi w-24"
            inputMode="numeric"
            placeholder={String(tuvalBh)}
            defaultValue={atama.bit_hizi ?? ""}
            key={`${h.id}-${atama.bit_hizi ?? ""}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v) return atama.bit_hizi != null && atamaYaz({ bit_hizi: null });
              const n = Math.round(Number(v));
              if (Number.isFinite(n) && n >= 200 && n <= 100000 && n !== atama.bit_hizi) atamaYaz({ bit_hizi: n });
            }}
          />
          <span className="dt-birim">kbps · boş: tuvalin bit hızı ({tuvalBh}) ile kodlayıcı paylaşılır</span>
          {h.platform === "kick" && sinirlar && (
            <button type="button" className="dt-btn" onClick={() => atamaYaz({ bit_hizi: Math.min(tuvalBh, sinirlar.kickMaxKbps) })} title={`${sinirlar.kaynaklar.kick} · ${sinirlar.dogrulama}`}>
              Kick sınırına uy
            </button>
          )}
        </span>
        {kickAsim && (
          <>
            <span />
            <span className="dt-uyari-metni text-[11px]">
              Kick en fazla {sinirlar!.kickMaxKbps} kbps kabul eder (kaynak: {sinirlar!.kaynaklar.kick}, {sinirlar!.dogrulama}). Uzman kipte ayar kendiliğinden değiştirilmez.
            </span>
          </>
        )}
        <span className="dt-etiket">Bağlantı</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            className="dt-btn"
            onClick={async () => {
              setSinama("Sınanıyor…");
              try {
                const r = await multistreamApi.test(h.id);
                setSinama(r.ok ? `Sunucuya ulaşıldı (${r.sunucu}, ${r.ms} ms). ${r.not}` : `Ulaşılamadı (${r.sunucu}): ${r.hata}`);
              } catch (e) {
                setSinama(`Sınanamadı: ${hataMetni(e)}`);
              }
            }}
          >
            Sına
          </button>
          {sinama && <span className="text-[11px] dt-soluk">{sinama}</span>}
        </span>
      </div>
    </div>
  );
}

function YeniHedef({ durum, onToast, onDegisti }: { durum: MultistreamStatus | null; onToast: (m: string) => void; onDegisti: () => void }) {
  const [acik, setAcik] = useState(false);
  const [f, setF] = useState<{ name: string; platform: Platform; server: string; key: string }>({ name: "", platform: "twitch", server: "", key: "" });
  const onerilen = (p: Platform) => durum?.presets.find((x) => x.platform === p)?.server ?? "";
  if (!acik)
    return (
      <button type="button" className="dt-btn" onClick={() => (setAcik(true), setF((x) => ({ ...x, server: onerilen(x.platform) })))}>
        + Hedef ekle
      </button>
    );
  return (
    <div className="dt-hedef-karti">
      <div className="dt-form px-0">
        <label htmlFor="yh-ad">Ad</label>
        <input id="yh-ad" className="dt-input" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label htmlFor="yh-p">Platform</label>
        <select id="yh-p" className="dt-input w-40" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as Platform, server: onerilen(e.target.value as Platform) })}>
          {(Object.keys(PLATFORM_ADI) as Platform[]).map((p) => (
            <option key={p} value={p}>
              {PLATFORM_ADI[p]}
            </option>
          ))}
        </select>
        <label htmlFor="yh-s">Sunucu</label>
        <input id="yh-s" className="dt-input" placeholder="rtmps://…" value={f.server} onChange={(e) => setF({ ...f, server: e.target.value })} />
        <label htmlFor="yh-k">Yayın anahtarı</label>
        <input id="yh-k" type="password" autoComplete="off" className="dt-input" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="dt-btn" onClick={() => setAcik(false)}>
          Vazgeç
        </button>
        <button
          type="button"
          className="dt-btn-primary"
          disabled={!f.name.trim() || !f.server.trim()}
          onClick={async () => {
            try {
              await multistreamApi.upsert({ name: f.name.trim(), platform: f.platform, server: f.server.trim(), enabled: true, key: f.key || undefined });
              setAcik(false);
              setF({ name: "", platform: "twitch", server: onerilen("twitch"), key: "" });
              onDegisti();
            } catch (e) {
              onToast(`Hedef eklenemedi: ${hataMetni(e)}`);
            }
          }}
        >
          Ekle
        </button>
      </div>
      <p className="text-[11px] dt-soluk">Anahtar yalnız Windows Kimlik Yöneticisine yazılır; ayar dosyalarında, günlüklerde ve destek paketinde yer almaz.</p>
    </div>
  );
}

// ─── Pencere ───────────────────────────────────────────────────────────────

export function YayinAyarlari({ baslangic = "cikis", motorKodlayicilari, onToast, onGit, onKapat }: { baslangic?: Bolum; motorKodlayicilari?: string[]; onToast: (m: string) => void; onGit?: (h: "hotkeys") => void; onKapat: () => void }) {
  const [bolum, setBolum] = useState<Bolum>(baslangic);
  const [ara, setAra] = useState("");
  const [p, setP] = useState<MotorProfilYaniti | null>(null);
  const [ms, setMs] = useState<MultistreamStatus | null>(null);
  const [ses, setSes] = useState<MotorSesDurumu | null>(null);
  const [bekleyen, setBekleyen] = useState(false);

  const yukle = useCallback(async () => {
    try {
      setP(await motorApi.profil());
    } catch (e) {
      onToast(`Profil okunamadı: ${hataMetni(e)}`);
    }
    multistreamApi.status().then(setMs, () => setMs(null));
  }, [onToast]);
  useEffect(() => {
    void yukle();
  }, [yukle]);
  useEffect(() => {
    if (p?.calisiyor) motorApi.ses().then(setSes, () => setSes(null));
  }, [p?.calisiyor]);

  const guncelle = async (degisim: Record<string, unknown>) => {
    try {
      const r = (await motorApi.profilGuncelle(degisim)) as Awaited<ReturnType<typeof motorApi.profilGuncelle>> & { motorYenidenBasladi?: boolean };
      setP((x) => (x ? { ...x, profil: r.profil } : x));
      setBekleyen(r.bekleyen);
      if (r.motorYenidenBasladi) onToast("Motor yeni video/ses ayarlarıyla yeniden başladı");
    } catch (e) {
      onToast(`Ayar kaydedilemedi: ${hataMetni(e)}`);
    }
  };

  const gorunenBolumler = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase("tr");
    return q ? BOLUMLER.filter((b) => `${b.ad} ${b.anahtarlar}`.toLocaleLowerCase("tr").includes(q)) : BOLUMLER;
  }, [ara]);
  useEffect(() => {
    if (gorunenBolumler.length && !gorunenBolumler.some((b) => b.id === bolum)) setBolum(gorunenBolumler[0].id);
  }, [gorunenBolumler, bolum]);

  const pr = p?.profil;
  const kodlayiciOku = useCallback(() => motorApi.kodlayiciOzellikleri(pr?.cikis.kodlayici ?? ""), [pr?.cikis.kodlayici]);
  const kodlayiciYaz = useCallback((a: Record<string, unknown>) => motorApi.profilGuncelle({ cikis: { uzman: { [pr?.cikis.kodlayici ?? ""]: a } } }).then((r) => setP((x) => (x ? { ...x, profil: r.profil } : x))), [pr?.cikis.kodlayici]);

  return (
    <Pencere
      baslik={`Yayın ayarları${pr ? ` — profil: ${pr.ad}` : ""}`}
      genis
      onKapat={onKapat}
      alt={
        <>
          <span className="mr-auto text-[11px] dt-soluk">
            {bekleyen ? "Yayın/kayıt sürüyor: yeni çıkış ayarları o çıktı durup yeniden başlayınca uygulanır." : "Değişiklikler etkin profile anında yazılır."}
          </span>
          <button type="button" className="dt-btn-primary" onClick={onKapat}>
            Kapat
          </button>
        </>
      }
    >
      <div className="grid h-full min-h-0" style={{ gridTemplateColumns: "200px minmax(0,1fr)" }}>
        <nav className="flex min-h-0 flex-col border-r border-[color:var(--dt-line)]" aria-label="Ayar bölümleri">
          <input className="dt-input m-2" placeholder="Ayarlarda ara…" aria-label="Ayarlarda ara" value={ara} onChange={(e) => setAra(e.target.value)} />
          <div role="tablist" aria-orientation="vertical">
            {gorunenBolumler.map((b) => (
              <button key={b.id} type="button" role="tab" aria-selected={b.id === bolum} className="dt-row w-full text-left" onClick={() => setBolum(b.id)}>
                {b.ad}
              </button>
            ))}
            {!gorunenBolumler.length && <p className="p-2 text-[12px] dt-soluk">Eşleşen ayar yok.</p>}
          </div>
        </nav>
        <div className="min-h-0 overflow-auto" role="tabpanel">
          <div className="dt-dock-baslik">
            Yayın ayarları › {BOLUMLER.find((b) => b.id === bolum)?.ad}
          </div>
          {!pr ? (
            <p className="p-3 text-[12px] dt-soluk">Profil okunuyor…</p>
          ) : bolum === "video" ? (
            <div className="dt-form">
              <label htmlFor="ay-taban">Temel (tuval) çözünürlük</label>
              <BoyutAlani id="ay-taban" deger={pr.video.taban} hazir={TABAN_HAZIR} onUygula={(v) => void guncelle({ video: { taban: v } })} />
              <label htmlFor="ay-cikisc">Çıkış (ölçekli) çözünürlük</label>
              <BoyutAlani id="ay-cikisc" deger={pr.video.cikis} hazir={CIKIS_HAZIR} onUygula={(v) => void guncelle({ video: { cikis: v } })} />
              <label htmlFor="ay-olcek">Ölçek filtresi</label>
              <select id="ay-olcek" className="dt-input w-72" value={pr.video.olcek_filtresi} onChange={(e) => void guncelle({ video: { olcek_filtresi: e.target.value } })}>
                {Object.entries(OLCEK_ADI).map(([k, a]) => (
                  <option key={k} value={k}>
                    {a}
                  </option>
                ))}
              </select>
              <label htmlFor="ay-fps">Kare hızı</label>
              <select id="ay-fps" className="dt-input w-40" value={pr.fps} onChange={(e) => void guncelle({ fps: Number(e.target.value) })}>
                {KARE_HIZLARI.map((f) => (
                  <option key={f} value={f}>
                    {f} FPS
                  </option>
                ))}
              </select>
              <label htmlFor="ay-dikey">Dikey tuval</label>
              <BoyutAlani id="ay-dikey" deger={pr.video.dikey_taban} hazir={DIKEY_HAZIR} onUygula={(v) => void guncelle({ video: { dikey_taban: v } })} />
              <span />
              <span className="text-[11px] dt-soluk">
                Sahneler temel çözünürlükte düzenlenir; kodlayıcılara çıkış çözünürlüğü gider. Motor çalışırken değiştirilirse (yayın/kayıt yoksa) motor yeni ayarlarla yeniden başlar; yayın ya da kayıt
                sürerken değişmez. Dikey tuval motor açılışında etkinleştirilir.
              </span>
            </div>
          ) : bolum === "cikis" ? (
            <>
              <div className="dt-form">
                <span className="dt-etiket">Kip</span>
                <span className="flex gap-3" role="radiogroup" aria-label="Çıkış kipi">
                  {(["basit", "gelismis", "uzman"] as const).map((k) => (
                    <label key={k} className="inline-flex items-center gap-1.5">
                      <input type="radio" name="kip" checked={pr.cikis.kip === k} onChange={() => void guncelle({ cikis: { kip: k } })} />
                      {k === "basit" ? "Basit" : k === "gelismis" ? "Gelişmiş" : "Uzman"}
                    </label>
                  ))}
                </span>
                <label htmlFor="ay-kod">Video kodlayıcı</label>
                <select id="ay-kod" className="dt-input w-72" value={pr.cikis.kodlayici} onChange={(e) => void guncelle({ cikis: { kodlayici: e.target.value } })}>
                  <option value="otomatik">Otomatik (NVENC varsa o, yoksa x264)</option>
                  {(p!.videoKodlayicilari ?? []).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.ad} · {k.kodek}
                      {k.donanim ? " · donanım" : ""}
                    </option>
                  ))}
                  {!p!.videoKodlayicilari && pr.cikis.kodlayici !== "otomatik" && <option value={pr.cikis.kodlayici}>{pr.cikis.kodlayici}</option>}
                </select>
                {!p!.videoKodlayicilari && (
                  <>
                    <span />
                    <span className="text-[11px] dt-soluk">Kodlayıcı listesi motor çalışırken kurulu OBS'ten okunur (yalnız bu sistemde gerçekten kullanılabilenler).</span>
                  </>
                )}
                <label htmlFor="ay-bh">Bit hızı (yatay)</label>
                <SayiAlani id="ay-bh" deger={pr.cikis.bit_hizi_ana} en_az={200} en_cok={100000} birim="kbps" onUygula={(v) => void guncelle({ cikis: { bit_hizi_ana: v } })} />
                <label htmlFor="ay-bhd">Bit hızı (dikey)</label>
                <SayiAlani id="ay-bhd" deger={pr.cikis.bit_hizi_dikey} en_az={200} en_cok={100000} birim="kbps" onUygula={(v) => void guncelle({ cikis: { bit_hizi_dikey: v } })} />
                <label htmlFor="ay-sbh">Ses bit hızı</label>
                <SayiAlani id="ay-sbh" deger={pr.cikis.ses_bit_hizi} en_az={32} en_cok={512} birim="kbps" onUygula={(v) => void guncelle({ cikis: { ses_bit_hizi: v } })} />
                {pr.cikis.kip !== "basit" && (
                  <>
                    <label htmlFor="ay-ak">Anahtar kare aralığı</label>
                    <SayiAlani id="ay-ak" deger={pr.cikis.anahtar_kare_sn} en_az={1} en_cok={10} birim="sn" onUygula={(v) => void guncelle({ cikis: { anahtar_kare_sn: v } })} />
                  </>
                )}
                <span className="dt-etiket">Kodlama paylaşımı</span>
                <span className="text-[12px]">
                  Aynı tuval ve bit hızını kullanan hedefler tek kodlayıcıyı paylaşır; farklı bit hızı isteyen hedef için ayrı kodlayıcı açılır.
                  {motorKodlayicilari?.length ? <span className="dt-soluk"> Şu an: {motorKodlayicilari.join(", ")}</span> : null}
                </span>
              </div>
              {pr.cikis.kip === "uzman" && (
                <div className="border-t border-[color:var(--dt-line)]">
                  <div className="dt-dock-baslik">Kodlayıcı ayarları (Uzman)</div>
                  {pr.cikis.kodlayici === "otomatik" ? (
                    <p className="p-3 text-[12px] dt-soluk">Uzman ayarları için yukarıdan belirli bir kodlayıcı seçin.</p>
                  ) : !p!.calisiyor ? (
                    <p className="p-3 text-[12px] dt-soluk">Kodlayıcının özellik formu motor çalışırken okunur.</p>
                  ) : (
                    <OzellikGovdesi key={pr.cikis.kodlayici} oku={kodlayiciOku} yaz={kodlayiciYaz} bos="Bu kodlayıcının ayarı yok." />
                  )}
                  <p className="px-3 pb-2 text-[11px] dt-soluk">Uzman ayarları temel ayarların (bit hızı, anahtar kare) üzerine yazılır ve kendiliğinden değiştirilmez.</p>
                </div>
              )}
            </>
          ) : bolum === "kayit" ? (
            <div className="dt-form">
              <label htmlFor="ay-kb">Biçim</label>
              <select id="ay-kb" className="dt-input w-80" value={pr.kayit.bicim} onChange={(e) => void guncelle({ kayit: { bicim: e.target.value } })}>
                {(p!.kayitBicimleri ?? [{ ad: pr.kayit.bicim }]).map((b) => (
                  <option key={b.ad} value={b.ad}>
                    {b.ad}
                    {b.aciklama ? ` — ${b.aciklama}` : ""}
                  </option>
                ))}
              </select>
              <span className="dt-etiket">Ses izleri</span>
              <span className="flex flex-wrap gap-3">
                {pr.iz_adlari.map((a, i) => (
                  <label key={i} className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={pr.kayit.izler.includes(i)}
                      onChange={(e) => {
                        const izler = e.target.checked ? [...pr.kayit.izler, i].sort() : pr.kayit.izler.filter((x) => x !== i);
                        if (!izler.length) return onToast("En az bir iz kaydedilmeli");
                        void guncelle({ kayit: { izler } });
                      }}
                    />
                    {i + 1} · {a}
                  </label>
                ))}
              </span>
              <label htmlFor="ay-kk">Klasör</label>
              <input
                id="ay-kk"
                className="dt-input"
                placeholder="Boş: Videolar\Yayin Motoru"
                defaultValue={pr.kayit.klasor ?? ""}
                key={pr.kayit.klasor ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if ((v || null) !== (pr.kayit.klasor ?? null)) void guncelle({ kayit: { klasor: v || null } });
                }}
              />
              <span className="dt-etiket">Kodlayıcı</span>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={pr.kayit.ayri_kodlayici} onChange={(e) => void guncelle({ kayit: { ayri_kodlayici: e.target.checked } })} />
                Kayıt için ayrı kodlayıcı (yayın kodlayıcısını kullanma) — kaydı duraklatmak için gerekli
              </label>
              <label htmlFor="ay-bdk">Otomatik bölme (süre)</label>
              <SayiAlani id="ay-bdk" deger={pr.kayit.bolme_dk} en_az={0} en_cok={1440} birim="dk (0 = kapalı)" onUygula={(v) => void guncelle({ kayit: { bolme_dk: v } })} />
              <label htmlFor="ay-bmb">Otomatik bölme (boyut)</label>
              <SayiAlani id="ay-bmb" deger={pr.kayit.bolme_mb} en_az={0} en_cok={1048576} birim="MB (0 = kapalı)" onUygula={(v) => void guncelle({ kayit: { bolme_mb: v } })} />
              <span />
              <span className="text-[11px] dt-soluk">
                Çok izli kayıt: seçilen her iz dosyada ayrı ses akışıdır. Tam yol girin (ör. D:\Kayıtlar). Kayıt sırasında Denetimler'deki makasla elle de bölünebilir; yeni dosya aynı klasöre tarih-saatli adla yazılır.
              </span>
            </div>
          ) : bolum === "tekrar" ? (
            <div className="dt-form">
              <label htmlFor="ay-ts">Süre</label>
              <SayiAlani id="ay-ts" deger={pr.tekrar_sn} en_az={5} en_cok={600} birim="sn" onUygula={(v) => void guncelle({ tekrar_sn: v })} />
              <span className="dt-etiket">Dikey tuval</span>
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={pr.tekrar_dikey} onChange={(e) => void guncelle({ tekrar_dikey: e.target.checked })} />
                Dikey tuval için de tekrar arabelleği (kısa video; "Tekrarı kaydet" ikisini de yazar)
              </label>
              <span />
              <span className="text-[11px] dt-soluk">Son bu kadar saniye bellekte tutulur; "Tekrarı kaydet" diske yazar (dikey: kayıt klasörü\Dikey).</span>
            </div>
          ) : bolum === "ses" ? (
            <div className="dt-form">
              <span className="dt-etiket">Karışım (iz) adları</span>
              <span className="grid grid-cols-3 gap-1.5">
                {pr.iz_adlari.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span className="dt-birim w-5">{i + 1}</span>
                    <input
                      className="dt-input w-28"
                      aria-label={`İz ${i + 1} adı`}
                      maxLength={24}
                      defaultValue={a}
                      key={`${i}-${a}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== a) {
                          const adlar = [...pr.iz_adlari];
                          adlar[i] = v;
                          void guncelle({ iz_adlari: adlar });
                        }
                      }}
                    />
                  </span>
                ))}
              </span>
              <label htmlFor="ay-orn">Örnekleme hızı</label>
              <select id="ay-orn" className="dt-input w-40" value={pr.ses.ornekleme} onChange={(e) => void guncelle({ ses: { ornekleme: Number(e.target.value) } })}>
                <option value={44100}>44,1 kHz</option>
                <option value={48000}>48 kHz</option>
              </select>
              <label htmlFor="ay-hop">Kanallar</label>
              <select id="ay-hop" className="dt-input w-40" value={pr.ses.hoparlor} onChange={(e) => void guncelle({ ses: { hoparlor: e.target.value } })}>
                {Object.entries(HOPARLOR_ADI).map(([k, a]) => (
                  <option key={k} value={k}>
                    {a}
                  </option>
                ))}
              </select>
              <span />
              <span className="text-[11px] dt-soluk">Örnekleme hızı ve kanallar motor yeniden başlayınca uygulanır (çıktı yoksa kendiliğinden).</span>
              <label htmlFor="ay-iz">İzleme aygıtı</label>
              {ses?.izlemeAygitlari?.length ? (
                <select
                  id="ay-iz"
                  className="dt-input w-80"
                  value={pr.izleme_aygiti?.id ?? ses.izlemeSecili?.id ?? ""}
                  onChange={(e) => {
                    const a = ses.izlemeAygitlari!.find((x) => x.id === e.target.value);
                    if (a) void guncelle({ izleme_aygiti: { id: a.id, ad: a.ad } });
                  }}
                >
                  {ses.izlemeAygitlari.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.ad}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[12px] dt-soluk">Aygıt listesi motor çalışırken okunur.</span>
              )}
              <span />
              <span className="text-[11px] dt-soluk">Kaynakların hangi karışıma gideceği Gelişmiş Ses Özellikleri'nde, hedeflerin hangi karışımı alacağı Çoklu yayın'dadır.</span>
            </div>
          ) : bolum === "gelismis" ? (
            <div className="dt-form">
              <span className="dt-etiket col-span-2 font-semibold">Video</span>
              <label htmlFor="ay-rb">Renk biçimi</label>
              <select id="ay-rb" className="dt-input w-72" value={pr.video.renk_bicimi} onChange={(e) => void guncelle({ video: { renk_bicimi: e.target.value } })}>
                {Object.entries(BICIM_ADI).map(([k, a]) => (
                  <option key={k} value={k}>
                    {a}
                  </option>
                ))}
              </select>
              <label htmlFor="ay-ru">Renk uzayı</label>
              <select id="ay-ru" className="dt-input w-72" value={pr.video.renk_uzayi} onChange={(e) => void guncelle({ video: { renk_uzayi: e.target.value } })}>
                {Object.entries(UZAY_ADI).map(([k, a]) => (
                  <option key={k} value={k} disabled={k.startsWith("2100") && !["p010", "i010"].includes(pr.video.renk_bicimi)}>
                    {a}
                    {k.startsWith("2100") && !["p010", "i010"].includes(pr.video.renk_bicimi) ? " — 10 bit biçim gerekir" : ""}
                  </option>
                ))}
              </select>
              <label htmlFor="ay-ra">Renk aralığı</label>
              <select id="ay-ra" className="dt-input w-72" value={pr.video.renk_araligi} onChange={(e) => void guncelle({ video: { renk_araligi: e.target.value } })}>
                <option value="kismi">Sınırlı (kısmi)</option>
                <option value="tam">Tam</option>
              </select>
              <span className="dt-etiket col-span-2 mt-2 font-semibold">Ağ (RTMP hedefleri)</span>
              <label htmlFor="ay-ip">Bağlanılacak IP</label>
              <input
                id="ay-ip"
                className="dt-input w-72"
                placeholder="default"
                defaultValue={pr.ag.bagla_ip}
                key={pr.ag.bagla_ip}
                onBlur={(e) => {
                  const v = e.target.value.trim() || "default";
                  if (v !== pr.ag.bagla_ip) void guncelle({ ag: { bagla_ip: v } });
                }}
              />
              <label htmlFor="ay-ipa">IP ailesi</label>
              <select id="ay-ipa" className="dt-input w-40" value={pr.ag.ip_ailesi} onChange={(e) => void guncelle({ ag: { ip_ailesi: e.target.value } })}>
                <option value="IPv4+IPv6">IPv4 ve IPv6</option>
                <option value="IPv4">Yalnız IPv4</option>
                <option value="IPv6">Yalnız IPv6</option>
              </select>
              {(
                [
                  ["dinamik_bit_hizi", "Tıkanıklıkta bit hızını dinamik düşür"],
                  ["yeni_soket_dongusu", "Yeni ağ kodunu kullan"],
                  ["dusuk_gecikme", "Düşük gecikme kipi"],
                ] as const
              ).map(([k, a]) => (
                <label key={k} className="col-span-2 inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={pr.ag[k]} onChange={(e) => void guncelle({ ag: { [k]: e.target.checked } })} />
                  {a}
                </label>
              ))}
              <span className="dt-etiket col-span-2 mt-2 font-semibold">Yeniden bağlanma</span>
              <label className="col-span-2 inline-flex items-center gap-1.5">
                <input type="checkbox" checked={pr.ag.yeniden_baglan} onChange={(e) => void guncelle({ ag: { yeniden_baglan: e.target.checked } })} />
                Bağlantı koparsa otomatik yeniden bağlan
              </label>
              <label htmlFor="ay-rg">Deneme aralığı</label>
              <SayiAlani id="ay-rg" deger={pr.ag.deneme_gecikmesi_sn} en_az={1} en_cok={30} birim="sn" devreDisi={!pr.ag.yeniden_baglan} onUygula={(v) => void guncelle({ ag: { deneme_gecikmesi_sn: v } })} />
              <label htmlFor="ay-rd">En çok deneme</label>
              <SayiAlani id="ay-rd" deger={pr.ag.en_cok_deneme} en_az={0} en_cok={10000} devreDisi={!pr.ag.yeniden_baglan} onUygula={(v) => void guncelle({ ag: { en_cok_deneme: v } })} />
              <span />
              <span className="text-[11px] dt-soluk">
                Renk ayarları motor yeniden başlayınca uygulanır; HDR (Rec. 2100) 10 bit biçim ister ve kodlayıcının da desteklemesi gerekir. Ağ ayarları bir hedef başlatılırken uygulanır.
              </span>
            </div>
          ) : bolum === "uzak" ? (
            <UzaktanDenetim onToast={onToast} />
          ) : bolum === "coklu" ? (
            <div className="flex flex-col gap-2 p-3">
              {ms?.sinirlar && (
                <p className="text-[11px] dt-soluk">
                  Doğrulanmış sınırlar ({ms.sinirlar.dogrulama}): Kick en çok {ms.sinirlar.kickMaxKbps} kbps; YouTube anahtar kare en çok {ms.sinirlar.youtubeMaxKeyintSn} sn. Diğer platformlar için
                  resmi önerileri platformun kendi sayfasından doğrulayın.
                </p>
              )}
              {(ms?.destinations ?? []).map((h) => (
                <HedefKarti key={h.id} h={h} profil={pr} sinirlar={ms?.sinirlar} onGuncelle={(d) => void guncelle(d)} onToast={onToast} onDegisti={() => void yukle()} />
              ))}
              <YeniHedef durum={ms} onToast={onToast} onDegisti={() => void yukle()} />
            </div>
          ) : (
            <div className="p-3 text-[12px]">
              <p>Kısayollar (sahneye geç, kaynak göster/gizle, bas-konuş, bas-sustur, yayın/kayıt) eylem kayıt defterinden atanır.</p>
              <button type="button" className="dt-btn mt-2" onClick={() => onGit?.("hotkeys")}>
                Kısayollar sayfasını aç
              </button>
            </div>
          )}
        </div>
      </div>
    </Pencere>
  );
}
