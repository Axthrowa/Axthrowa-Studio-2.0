import CopyUrl from "@/components/axthrowa/CopyUrl";
import { DEFAULT_SOCIALS, SOCIAL_META } from "../../lib/socials";
import EdgePanel from "./EdgePanel";
import CanliDuzenlemeSeridi from "./CanliDuzenlemeSeridi";
import LivePreview from "./LivePreview";
import { Pin, PinOff } from "lucide-react";
import SettingsSection, { ayarBolumuAc } from "./SettingsSection";
import { Toast } from "@/components/axthrowa/Toast";
import { clearNotice } from "../../lib/notices";
import { PARCA_AYARI, Field, Select, TemplatePicker } from "./sahne/sahneOrtak";
import type { SahneAyarlariProps } from "./sahne/sahneOrtak";
export type { SahneAyarlariProps } from "./sahne/sahneOrtak";
import { MetinBolumu, GeriSayimBolumu, ArkaPlanBolumu, VideoBolumu } from "./sahne/SahneMetinBolumleri";
import { YoutubeBolumu, FonMuzigiBolumu, LogoBolumu } from "./sahne/SahneMedyaBolumleri";
import { BoyutlarBolumu, GorunurlukBolumu, ParcacikBolumu, JenerikBolumu } from "./sahne/SahneGorunumBolumleri";
import { ChatAyarlariBolumu } from "./sahne/SohbetAyarBolumu";

/** Giriş/Çıkış/Mola/Chat ekranlarının ayar ve önizleme görünümü. */
export default function SahneAyarlari(p: SahneAyarlariProps) {
  const { PART_LABELS, handlePreviewCountdownEnd, hiddenParts, inputs, notices, obsConnected, obsUrl, openExternal, panelsPinned, previewOn, resonanceOverlayUrl, restoreAllParts, restorePart, scenes, screen, secOrder, sectionHidden, setActiveNav, setPanelsPinned, setPreviewOn, settings, showToast, transitions, tt, update } = p;
  return (
  <div
    className={
      "relative grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden py-4 " +
      (panelsPinned ? "px-4 xl:grid-cols-[380px_1fr_340px]" : "px-6")
    }
  >
    <CanliDuzenlemeSeridi className="absolute left-1/2 top-1 z-30 -translate-x-1/2" />
    <EdgePanel
      side="left"
      pinned={panelsPinned}
      width={380}
      label="Ayar paneli — fareyi getir"
      // A3: 1366×768'de bölümler kapalıyken kaydırma gerekmesin diye aralıklar sıkı
      className="custom-scrollbar flex flex-col gap-0.5 overflow-y-auto rounded-2xl border border-white/[0.05] bg-panel-card/50 p-3"
    >
      {screen !== "chat" && (
        <>
          {(screen === "starting" || screen === "ending" || screen === "brb") && (
            <TemplatePicker
              screen={screen}
              settings={settings}
              onApply={update}
              onToast={showToast}
            />
          )}
          {(screen === "starting" || screen === "ending" || screen === "brb") && (
            <div className="my-1.5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="col-span-2 flex items-center justify-between gap-2">
                <p
                  className="truncate text-ui-2 axt-etiket font-bold text-white/70"
                  title="Video ve arka plan her ekranda ayrı kaydedilir."
                >
                  Sık kullanılan · yalnız {screen === "starting" ? "Giriş" : screen === "ending" ? "Çıkış" : "Mola"}
                </p>
                <button type="button" className="max-w-[45%] shrink-0 truncate text-xs font-semibold text-panel-accent" onClick={() => ayarBolumuAc("logo")}>
                  Logo: {settings.logoFile || "seç"}
                </button>
              </div>
              <Field label={tt("field.title")} value={settings.title || ""} onChange={(v) => update({ title: v })} />
              {screen === "brb" ? (
                <Field
                  label="Mola (dk)"
                  type="number"
                  value={String(settings.brbMinutes ?? 5)}
                  onChange={(v) => {
                    sessionStorage.removeItem("brb_end_" + (settings.brbMinutes || 5));
                    sessionStorage.removeItem("brb_end_" + (Number(v) || 5));
                    update({ brbMinutes: Number(v) || 5 });
                  }}
                />
              ) : (
                <Field label={tt("field.sub")} value={settings.sub || ""} onChange={(v) => update({ sub: v })} />
              )}
              <div>
                <label className="mb-1 block text-xs text-panel-muted">{tt("field.bg")}</label>
                <select
                  aria-label={tt("field.bg")}
                  className="h-9 w-full rounded-xl border border-white/[0.12] bg-ui-s1 px-3 text-sm text-white"
                  value={settings.bgStyle || "mix"}
                  onChange={(e) => update({ bgStyle: e.target.value })}
                >
                  <option value="mix">{tt("bg.mix")}</option>
                  <option value="accent">{tt("bg.accent")}</option>
                  <option value="dark">{tt("bg.dark")}</option>
                  <option value="image">{tt("bg.image")}</option>
                  <option value="video">{tt("bg.video")}</option>
                  <option value="youtube">{tt("bg.youtube")}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-xs text-white/80">
                Müzik
                <input
                  aria-label="Müzik sesi"
                  type="range"
                  min={0}
                  max={100}
                  className="min-w-0 flex-1"
                  value={settings.musicVolume ?? 70}
                  onChange={(e) => update({ musicVolume: Number(e.target.value) })}
                />
                <span className="w-8 text-right tabular-nums">{settings.musicVolume ?? 70}</span>
              </label>
            </div>
          )}
          {!sectionHidden("metin") && (
            <MetinBolumu {...p} />
          )}

          {!sectionHidden("geriSayim") && (
            <GeriSayimBolumu {...p} />
          )}

          {!sectionHidden("arkaPlan") && (
            <ArkaPlanBolumu {...p} />
          )}

          {settings.bgStyle === "video" && settings.transparent && (
            <p className="rounded-md border border-panel-cta/40 bg-panel-cta/10 px-2 py-1.5 text-ui-2 text-orange-100">
              &quot;Şeffaf arka plan&quot; açıkken video gizlenir. Videoyu görmek için
              şeffaflığı kapat.
            </p>
          )}

          {!sectionHidden("video") && (
            <VideoBolumu {...p} />
          )}


          {!sectionHidden("youtube") && (
            <YoutubeBolumu {...p} />
          )}

          {!sectionHidden("fonMuzigi") && (
            <FonMuzigiBolumu {...p} />
          )}

          {!sectionHidden("logo") && (
            <LogoBolumu {...p} />
          )}

          {!sectionHidden("boyutlar") && (
            <BoyutlarBolumu {...p} />
          )}

          {!sectionHidden("gorunurluk") && (
            <GorunurlukBolumu {...p} />
          )}

          {!sectionHidden("parcacik") && (
            <ParcacikBolumu {...p} />
          )}

          {screen === "ending" && !sectionHidden("jenerik") && (
            <JenerikBolumu {...p} />
          )}
        </>
      )}

      {screen === "chat" && !sectionHidden("chatAyarlari") && (
        <ChatAyarlariBolumu {...p} />
      )}
    </EdgePanel>

    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[color:var(--panel-bg-deep)] shadow-glass">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-black/30 px-4 py-2.5 text-xs text-panel-muted">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full transition-colors ${
              previewOn ? "bg-emerald-400 shadow-glow-sm" : "bg-neutral-500"
            }`}
          />
          <span className="font-display text-ui-2 font-bold text-white">
            {previewOn ? tt("preview.on") : tt("preview.off")}
          </span>
          <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.2 text-ui-2 font-mono text-panel-muted">
            1080P STUDIO
          </span>
        </div>
        <div className="flex items-center gap-4">
          <label
            className="flex cursor-pointer items-center gap-2 text-xs text-white/90 transition hover:text-white"
            title="Kapatınca video çözme ve parçacık çizimi durur; CPU/RAM belirgin düşer. Öğeleri sürükleyip konumlamak için açık olması gerekir."
          >
            <input
              type="checkbox"
              checked={previewOn}
              onChange={(e) => setPreviewOn(e.target.checked)}
              className="size-3.5 rounded border-white/20 text-panel-accent focus:ring-panel-accent/40"
            />
            <span className="text-ui-2 font-medium">{tt("preview.toggle")}</span>
          </label>
          <button
            type="button"
            onClick={() => setPanelsPinned((v) => !v)}
            title={
              panelsPinned
                ? "Yan panelleri kenara gizle (önizleme büyür)"
                : "Yan panelleri sabitle (hep açık kalsın)"
            }
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-ui-2 font-semibold text-white/80 transition hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white"
          >
            {panelsPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            <span>{panelsPinned ? "Panelleri gizle" : "Panelleri sabitle"}</span>
          </button>
          <a
            className="inline-flex items-center gap-1 rounded-lg border border-panel-accent/30 bg-panel-accent/15 px-2.5 py-1 text-ui-2 font-semibold text-panel-accent transition hover:border-panel-accent/50 hover:bg-panel-accent/25"
            href={obsUrl}
            onClick={(e) => {
              e.preventDefault();
              void openExternal(obsUrl);
            }}
          >
            {tt("preview.openObs")}
          </a>
        </div>
      </div>
      {notices.length > 0 && (
        <div className="space-y-2 px-3 py-3">
          {notices.map((n) => (
            <Toast
              key={n.id}
              variant={n.level}
              title={n.text}
              className="text-xs"
              onClose={() => clearNotice(n.id)}
            >
              {n.hint}
            </Toast>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {previewOn || screen === "chat" ? (
          <LivePreview
            screen={screen}
            settings={settings}
            onPatch={update}
            onCountdownEnd={(live) => void handlePreviewCountdownEnd(live)}
            onPartSelect={(k) => {
              const a = PARCA_AYARI[k];
              if (a && !ayarBolumuAc(a.bolum, a.alan)) showToast(`${PART_LABELS[k] || k} ayarları gizli; Düzen'den gösterebilirsin.`);
            }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-panel-muted">
              Önizleme kapalı — video çözme ve parçacık çizimi durdu.
            </p>
            <p className="text-ui-2 text-panel-muted">
              OBS çıktısı bundan etkilenmez. Öğeleri sürükleyerek konumlamak için
              önizlemeyi tekrar aç.
            </p>
            <button
              type="button"
              className="rounded-md bg-panel-accent/80 px-3 py-1.5 text-xs font-medium text-white"
              onClick={() => setPreviewOn(true)}
            >
              Önizlemeyi aç
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-panel-border px-3 py-2">
        {hiddenParts.length === 0 ? (
          <span className="text-ui-2 text-panel-muted">
            Gizlenen parça yok — kapattıkların buraya düşer, tek tıkla geri gelir.
          </span>
        ) : (
          <>
            <span className="text-ui-2 text-panel-muted">Gizlenenler:</span>
            {hiddenParts.map((k) => (
              <button
                key={k}
                type="button"
                className="rounded-full border border-panel-border bg-black/40 px-2.5 py-1 text-ui-2 text-white transition hover:border-panel-accent hover:text-panel-accent"
                onClick={() => restorePart(k)}
                title="Yeniden göster"
              >
                + {PART_LABELS[k] || k}
              </button>
            ))}
            <button
              type="button"
              className="ml-auto rounded-full bg-panel-accent/90 px-2.5 py-1 text-ui-2 font-semibold text-ui-accent-ink"
              onClick={restoreAllParts}
            >
              Tümünü geri getir
            </button>
          </>
        )}
      </div>
    </section>

    <EdgePanel
      side="right"
      pinned={panelsPinned}
      width={340}
      label="Görünüm paneli — fareyi getir"
      className="custom-scrollbar flex flex-col space-y-4 overflow-y-auto rounded-2xl border border-white/[0.05] bg-panel-card/50 p-4"
    >
      {!sectionHidden("obsUrl") && (
        <SettingsSection id="obsUrl" title={tt("sec.obsUrl")} style={secOrder("obsUrl", true)}>
      <p className="text-ui-2 text-panel-muted">
        URL: <code className="text-white/80">http://127.0.0.1:8843/starting?obs=1</code> — uygulama açık olmalı. Genişlik 1920, Yükseklik 1080.
      </p>
      <CopyUrl
        url={obsUrl}
        onCopied={() => showToast("Kopyalandı")}
        onOpened={(u, s) => showToast(s === "opened" ? "Önizleme tarayıcıda açıldı" : s === "copied" ? "Tarayıcı açılamadı — adres kopyalandı" : "Önizleme açılamadı: " + u)}
      />
        </SettingsSection>
      )}

      {!sectionHidden("resonance") && (
        <SettingsSection id="resonance" title={tt("sec.resonance")} style={secOrder("resonance", true)}>
      <p className="text-ui-2 text-panel-muted">
        Spotify / YouTube Music now-playing. Eklenti uygulamanın içinde, üstteki
        <b className="text-white/80"> Müzik</b> sekmesinde çalışır.
      </p>
      <button
        type="button"
        className="w-full rounded-md bg-panel-accent px-2 py-2 text-sm text-black"
        onClick={() => {
          setActiveNav("music");
        }}
      >
        Müzik sekmesini aç
      </button>
      <CopyUrl
        url={resonanceOverlayUrl}
        onCopied={() => showToast("Kopyalandı")}
        onOpened={(u, s) => showToast(s === "opened" ? "Önizleme tarayıcıda açıldı" : s === "copied" ? "Tarayıcı açılamadı — adres kopyalandı" : "Önizleme açılamadı: " + u)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.lyricsEnabled === true && settings.visible?.lyrics !== false}
          onChange={(e) =>
            update({
              lyricsEnabled: e.target.checked,
              visible: { ...(settings.visible || {}), lyrics: true },
            })
          }
        />
        Bu ekranda şarkı sözlerini göster
      </label>
      <p className="text-ui-2 text-panel-muted">
        Söz boyutu, rengi ve zamanlaması Müzik sayfasında (Resonance) ayarlanır.
      </p>
      <p className="text-ui-2 text-panel-muted">
        Ayrı OBS kaynağı isterseniz yukarıdaki adresi kullan. Gerekmez — “Şimdi Çalıyor”
        widget’ı zaten Giriş/Mola/Çıkış ekranlarında.
      </p>
        </SettingsSection>
      )}

      {!sectionHidden("obsWs") && (
        <SettingsSection id="obsWs" title={tt("sec.obsWs")} style={secOrder("obsWs", true)}>
      <p className="text-xs text-panel-muted">
        {obsConnected
          ? "Bağlı — sahneler / hotkey’ler hazır"
          : "Bağlı değil — Dashboard → OBS WebSocket"}
      </p>

      <Select
        label="Sayaç bitince / dönüş sahnesi (oyun) — giriş sayacı"
        value={settings.obs?.sceneOnEnd || ""}
        options={scenes}
        onChange={(v) => update({ obs: { ...(settings.obs || {}), sceneOnEnd: v } })}
      />
      {!scenes.length && (
        <p className="text-ui-2 text-panel-muted">Sahne listesi için Dashboard’dan OBS’e bağlan (veya sahne adını elle yaz)</p>
      )}
      <Field
        label="Oyun / dönüş sahne adı (elle)"
        value={settings.obs?.sceneOnEnd || settings.obs?.sceneMap?.game || ""}
        onChange={(v) =>
          update({
            obs: {
              ...(settings.obs || {}),
              sceneOnEnd: v,
              sceneMap: { ...(settings.obs?.sceneMap || {}), game: v },
            },
          })
        }
      />
      <Select
        label="BRB sahnesi (molaya geçince)"
        value={settings.obs?.brbScene || settings.obs?.sceneMap?.brb || ""}
        options={scenes}
        onChange={(v) =>
          update({
            obs: {
              ...(settings.obs || {}),
              brbScene: v,
              sceneMap: { ...(settings.obs?.sceneMap || {}), brb: v },
            },
          })
        }
      />
      <Select
        label="Geçiş"
        value={settings.obs?.transition || ""}
        options={transitions}
        onChange={(v) => update({ obs: { ...(settings.obs || {}), transition: v } })}
      />
      <Field
        label="Geçiş ms"
        value={String(settings.obs?.transitionMs ?? 300)}
        onChange={(v) => update({ obs: { ...(settings.obs || {}), transitionMs: Number(v) || 300 } })}
        type="number"
      />
      <Select
        label="Mikrofon"
        value={settings.obs?.micInput || ""}
        options={inputs.map((i) => i.name)}
        onChange={(v) => update({ obs: { ...(settings.obs || {}), micInput: v, muteMicOnBrb: true } })}
      />
      <div className="mt-3 rounded-lg bg-white/[0.04] p-3 text-xs">
        <p className="text-panel-muted">
          Sahne, ses, kaynak görünürlüğü ve OBS kısayolları artık kendi sekmesinde.
        </p>
        <button
          type="button"
          className="mt-2 w-full rounded-md bg-panel-accent px-3 py-2 text-sm font-medium text-ui-accent-ink"
          onClick={() => {
            setActiveNav("hotkeys");
          }}
        >
          Kısayollar sekmesini aç
        </button>
      </div>
        </SettingsSection>
      )}

      {!sectionHidden("sosyal") && (
        <SettingsSection id="sosyal" title={tt("sec.sosyal")} style={secOrder("sosyal", true)}>
          <div className="space-y-2">
            {Object.keys(SOCIAL_META).map((key) => {
              const isEnabled = !!settings.socials?.[key]?.enabled;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2.5 rounded-xl border p-2 transition-all ${
                    isEnabled
                      ? "border-panel-accent/40 bg-panel-accent/[0.05]"
                      : "border-white/[0.06] bg-black/30"
                  }`}
                >
                  <input
                    aria-label={SOCIAL_META[key as keyof typeof SOCIAL_META]?.label || key}
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) =>
                      update({
                        socials: {
                          ...DEFAULT_SOCIALS,
                          ...settings.socials,
                          [key]: {
                            ...settings.socials?.[key],
                            enabled: e.target.checked,
                            handle: settings.socials?.[key]?.handle || "",
                          },
                        },
                      })
                    }
                    className="size-3.5 rounded border-white/20 text-panel-accent focus:ring-panel-accent/40"
                  />
                  <span className="w-16 truncate font-mono text-ui-2 axt-etiket font-bold text-panel-muted">
                    {key}
                  </span>
                  <input
                    className="h-7 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/40 px-2 text-xs text-white placeholder:text-panel-muted outline-none transition-colors focus:border-panel-accent/60"
                    value={settings.socials?.[key]?.handle || ""}
                    placeholder="kullanıcı"
                    onChange={(e) =>
                      update({
                        socials: {
                          ...DEFAULT_SOCIALS,
                          ...settings.socials,
                          [key]: {
                            enabled: true,
                            handle: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        </SettingsSection>
      )}
    </EdgePanel>
  </div>
  );
}
